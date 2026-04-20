import { PrismaClient, StatusZamowienia, StatusZlecenia, TypPauzy, TypTransakcji } from '@prisma/client';
import type { RequestHandler } from 'express';

const prisma = new PrismaClient();
const STATUSY_ZAMKNIETE_ZAMOWIEN: StatusZamowienia[] = ['GOTOWE', 'WYDANE', 'ZAMKNIETE', 'ANULOWANE'];
const STATUSY_MASZYN: StatusZlecenia[] = ['W_TOKU', 'PAUZA', 'STOP'];

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function diffMinutes(start: Date | null | undefined, stop: Date | null | undefined) {
  if (!start || !stop) {
    return 0;
  }

  return Math.max(0, Math.round((stop.getTime() - start.getTime()) / 60000));
}

function percent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;

  if (hours <= 0) {
    return `${mins} min`;
  }

  return `${hours} h ${String(mins).padStart(2, '0')} min`;
}

function formatRelativeTime(date: Date) {
  const deltaSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  const abs = Math.abs(deltaSeconds);

  if (abs < 60) {
    return deltaSeconds >= 0 ? 'przed chwila' : 'za chwile';
  }

  const units = [
    { limit: 3600, seconds: 60, label: 'min' },
    { limit: 86400, seconds: 3600, label: 'godz.' },
    { limit: 604800, seconds: 86400, label: 'dni' },
  ];

  for (const unit of units) {
    if (abs < unit.limit) {
      const value = Math.round(abs / unit.seconds);
      return deltaSeconds >= 0 ? `${value} ${unit.label} temu` : `za ${value} ${unit.label}`;
    }
  }

  const weeks = Math.round(abs / 604800);
  return deltaSeconds >= 0 ? `${weeks} tyg. temu` : `za ${weeks} tyg.`;
}

function plannedMinutesFromOrder(iloscPlan: number, normaSztGodz: number, planowanyStart: Date | null, planowanyStop: Date | null) {
  if (normaSztGodz > 0 && iloscPlan > 0) {
    return Math.max(1, Math.round((iloscPlan / normaSztGodz) * 60));
  }

  return diffMinutes(planowanyStart, planowanyStop);
}

async function pobierzAlertyMagazynowe() {
  const since30Days = addDays(startOfToday(), -30);
  const [surowce, transakcje] = await Promise.all([
    prisma.surowiec.findMany({
      where: { aktywny: true },
      select: { id: true, nazwa: true, jednostka: true },
      orderBy: { nazwa: 'asc' },
    }),
    prisma.transakcjaMagazynowa.findMany({
      where: {
        surowiec: { aktywny: true },
        OR: [{ typ: 'PRZYJECIE' }, { typ: 'WYDANIE' }, { typ: 'KOREKTA' }],
      },
      select: {
        surowiecId: true,
        typ: true,
        ilosc: true,
        utworzonyW: true,
      },
    }),
  ]);

  const mapa = new Map<
    number,
    {
      stan: number;
      wydanie30Dni: number;
      ostatniRuch: Date | null;
    }
  >();

  for (const surowiec of surowce) {
    mapa.set(surowiec.id, { stan: 0, wydanie30Dni: 0, ostatniRuch: null });
  }

  for (const transakcja of transakcje) {
    const rekord = mapa.get(transakcja.surowiecId);
    if (!rekord) {
      continue;
    }

    const ilosc = Number(transakcja.ilosc);

    if (transakcja.typ === TypTransakcji.WYDANIE) {
      rekord.stan -= ilosc;
      if (transakcja.utworzonyW >= since30Days) {
        rekord.wydanie30Dni += ilosc;
      }
    } else {
      rekord.stan += ilosc;
    }

    if (!rekord.ostatniRuch || transakcja.utworzonyW > rekord.ostatniRuch) {
      rekord.ostatniRuch = transakcja.utworzonyW;
    }
  }

  const alerty = surowce
    .map((surowiec) => {
      const rekord = mapa.get(surowiec.id) ?? { stan: 0, wydanie30Dni: 0, ostatniRuch: null };
      const srednieDzienneWydanie = rekord.wydanie30Dni / 30;
      const progOstrzegawczy = srednieDzienneWydanie > 0 ? srednieDzienneWydanie * 7 : 0;
      let poziom: 'krytyczny' | 'ostrzegawczy' | null = null;
      let komunikat = '';

      if (rekord.stan <= 0) {
        poziom = 'krytyczny';
        komunikat = 'Stan surowca spadl do zera lub ponizej zera.';
      } else if (progOstrzegawczy > 0 && rekord.stan <= progOstrzegawczy) {
        poziom = 'ostrzegawczy';
        komunikat = 'Zapas starczy orientacyjnie na mniej niz 7 dni pracy.';
      }

      if (!poziom) {
        return null;
      }

      return {
        id: surowiec.id,
        surowiec: surowiec.nazwa,
        jednostka: surowiec.jednostka,
        stanAktualny: Number(rekord.stan.toFixed(2)),
        srednieDzienneZuzycie: Number(srednieDzienneWydanie.toFixed(2)),
        poziom,
        komunikat,
        ostatniRuch: rekord.ostatniRuch,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a || !b) {
        return 0;
      }

      if (a.poziom !== b.poziom) {
        return a.poziom === 'krytyczny' ? -1 : 1;
      }

      return a.stanAktualny - b.stanAktualny;
    });

  return {
    liczbaAlertow: alerty.length,
    alerty,
  };
}

async function pobierzKontekstProdukcji() {
  const teraz = new Date();
  const dzisiaj = startOfToday();
  const za7Dni = addDays(dzisiaj, 7);

  const [
    maszyny,
    zlecenia,
    aktywneRejestracje,
    otwartePauzy,
    historia,
    dniWolne,
    nadchodzaceZamowienia,
    zalegleZamowienia,
    alertyMagazynowe,
  ] = await Promise.all([
    prisma.maszyna.findMany({
      where: { aktywna: true },
      orderBy: [{ kolejnosc: 'asc' }, { nazwa: 'asc' }],
      select: { id: true, nazwa: true },
    }),
    prisma.zlecenieProdukcyjne.findMany({
      where: {
        aktywne: true,
        status: { in: STATUSY_MASZYN },
      },
      orderBy: [{ zaktualizowanyW: 'desc' }, { id: 'desc' }],
      include: {
        maszyna: { select: { id: true, nazwa: true } },
        zamowienie: {
          select: {
            id: true,
            idProdio: true,
            klient: { select: { id: true, nazwa: true } },
            pozycje: {
              take: 1,
              select: {
                ilosc: true,
                produkt: { select: { id: true, nazwa: true } },
              },
            },
          },
        },
        historiaWydajnosci: {
          orderBy: [{ czasStart: 'desc' }],
          take: 6,
          select: {
            czasStart: true,
            czasStop: true,
          },
        },
      },
    }),
    prisma.rejestraCzasPracy.findMany({
      where: { wyjscie: null },
      orderBy: [{ wejscie: 'asc' }],
      include: {
        pracownik: {
          select: {
            id: true,
            imie: true,
            nazwisko: true,
            kolorAvatara: true,
            stanowisko: true,
          },
        },
      },
    }),
    prisma.pauza.findMany({
      where: { czasStop: null },
      select: {
        id: true,
        pracownikId: true,
        czasStart: true,
        typPauzy: true,
        powod: true,
      },
    }),
    prisma.historiaWydajnosci.findMany({
      orderBy: [{ czasStart: 'desc' }],
      take: 10,
      include: {
        zlecenie: {
          select: {
            id: true,
            numer: true,
            maszyna: { select: { id: true, nazwa: true } },
          },
        },
      },
    }),
    prisma.dzienWolny.findMany({
      where: {
        data: {
          gte: dzisiaj,
          lte: za7Dni,
        },
      },
      take: 8,
      orderBy: [{ data: 'asc' }],
      include: {
        pracownik: {
          select: {
            id: true,
            imie: true,
            nazwisko: true,
            kolorAvatara: true,
          },
        },
      },
    }),
    prisma.zamowienie.findMany({
      where: {
        oczekiwanaData: {
          gte: dzisiaj,
          lte: za7Dni,
        },
        status: { notIn: STATUSY_ZAMKNIETE_ZAMOWIEN },
      },
      take: 6,
      orderBy: [{ oczekiwanaData: 'asc' }],
      include: {
        klient: { select: { id: true, nazwa: true } },
        pozycje: {
          select: {
            ilosc: true,
            produkt: { select: { id: true, nazwa: true } },
          },
          take: 2,
        },
      },
    }),
    prisma.zamowienie.findMany({
      where: {
        oczekiwanaData: { lt: dzisiaj },
        status: { notIn: STATUSY_ZAMKNIETE_ZAMOWIEN },
      },
      take: 6,
      orderBy: [{ oczekiwanaData: 'asc' }],
      include: {
        klient: { select: { id: true, nazwa: true } },
      },
    }),
    pobierzAlertyMagazynowe(),
  ]);

  const pracownikIds = [...new Set(zlecenia.flatMap((item) => item.przypisaniPracownicyIds))];
  const pracownicyZeZleceniami = pracownikIds.length
    ? await prisma.pracownik.findMany({
        where: { id: { in: pracownikIds } },
        select: {
          id: true,
          imie: true,
          nazwisko: true,
          kolorAvatara: true,
        },
      })
    : [];

  const mapaPracownikow = new Map(pracownicyZeZleceniami.map((pracownik) => [pracownik.id, pracownik]));
  const mapaPauz = new Map(otwartePauzy.map((pauza) => [pauza.pracownikId, pauza]));
  const mapaZlecenPoMaszynie = new Map<number, (typeof zlecenia)[number]>();

  for (const zlecenie of zlecenia) {
    if (!mapaZlecenPoMaszynie.has(zlecenie.maszynaId)) {
      mapaZlecenPoMaszynie.set(zlecenie.maszynaId, zlecenie);
    }
  }

  const mapaZlecenPoPracowniku = new Map<number, (typeof zlecenia)[number]>();
  for (const zlecenie of zlecenia) {
    for (const pracownikId of zlecenie.przypisaniPracownicyIds) {
      if (!mapaZlecenPoPracowniku.has(pracownikId)) {
        mapaZlecenPoPracowniku.set(pracownikId, zlecenie);
      }
    }
  }

  const maszynyZProdukcja = maszyny.map((maszyna) => {
    const zlecenie = mapaZlecenPoMaszynie.get(maszyna.id);
    const pracownik = zlecenie?.przypisaniPracownicyIds.length
      ? mapaPracownikow.get(zlecenie.przypisaniPracownicyIds[0]) ?? null
      : null;
    const ostatniStart = zlecenie?.historiaWydajnosci[0]?.czasStart ?? zlecenie?.planowanyStart ?? zlecenie?.utworzonyW ?? null;
    const czasTrwaniaMinuty = ostatniStart ? diffMinutes(ostatniStart, teraz) : 0;
    const planMinuty = zlecenie
      ? plannedMinutesFromOrder(zlecenie.iloscPlan, Number(zlecenie.normaSztGodz), zlecenie.planowanyStart, zlecenie.planowanyStop)
      : 0;
    const wykonaniePlanu = zlecenie ? percent(zlecenie.iloscWykonana, zlecenie.iloscPlan) : 0;
    const obciazenieCzasowe = zlecenie && planMinuty > 0 ? Math.min(100, Math.round((czasTrwaniaMinuty / planMinuty) * 100)) : 0;
    const jakosc = zlecenie ? percent(zlecenie.iloscWykonana, zlecenie.iloscWykonana + zlecenie.iloscBrakow) : 0;

    return {
      id: maszyna.id,
      nazwa: maszyna.nazwa,
      status: zlecenie?.status ?? 'STOP',
      pracownik: pracownik
        ? {
            id: pracownik.id,
            imie: pracownik.imie,
            nazwisko: pracownik.nazwisko,
            kolorAvatara: pracownik.kolorAvatara,
          }
        : null,
      zlecenie: zlecenie
        ? {
            id: zlecenie.id,
            numer: zlecenie.numer,
            klient: zlecenie.zamowienie.klient,
            produkt: zlecenie.zamowienie.pozycje[0]?.produkt ?? null,
          }
        : null,
      czasTrwaniaMinuty,
      czasTrwaniaTekst: formatDuration(czasTrwaniaMinuty),
      warstwyWykorzystania: [
        { etykieta: 'Obciazenie', wartosc: obciazenieCzasowe, kolor: '#F97316' },
        { etykieta: 'Wykonanie', wartosc: wykonaniePlanu, kolor: '#FB923C' },
        { etykieta: 'Jakosc', wartosc: jakosc, kolor: '#FDBA74' },
      ],
    };
  });

  const pracownicy = aktywneRejestracje.map((rejestracja) => {
    const powiazaneZlecenie = mapaZlecenPoPracowniku.get(rejestracja.pracownikId) ?? null;
    const otwartaPauza = mapaPauz.get(rejestracja.pracownikId);
    const czasOdLogowaniaMinuty = diffMinutes(rejestracja.wejscie, teraz);

    return {
      id: rejestracja.pracownik.id,
      imie: rejestracja.pracownik.imie,
      nazwisko: rejestracja.pracownik.nazwisko,
      kolorAvatara: rejestracja.pracownik.kolorAvatara,
      maszyna: powiazaneZlecenie?.maszyna ?? null,
      czasOdLogowaniaMinuty,
      czasOdLogowaniaTekst: formatDuration(czasOdLogowaniaMinuty),
      status: otwartaPauza ? 'PRZERWA' : 'AKTYWNY',
      statusOpis: otwartaPauza ? otwartaPauza.powod ?? otwartaPauza.typPauzy : 'Pracuje na hali',
    };
  });

  const timeline = [
    ...historia.flatMap((wpis) => {
      const zdarzenia = [
        {
          id: `start-${wpis.id}`,
          typ: 'START',
          data: wpis.czasStart,
          tytul: `Start ${wpis.zlecenie.numer}`,
          opis: `Maszyna ${wpis.zlecenie.maszyna.nazwa}`,
        },
      ];

      if (wpis.czasStop) {
        zdarzenia.push({
          id: `stop-${wpis.id}`,
          typ: 'STOP',
          data: wpis.czasStop,
          tytul: `Stop ${wpis.zlecenie.numer}`,
          opis: `Maszyna ${wpis.zlecenie.maszyna.nazwa}`,
        });
      }

      return zdarzenia;
    }),
    ...otwartePauzy.map((pauza) => ({
      id: `pauza-${pauza.id}`,
      typ: 'PAUZA',
      data: pauza.czasStart,
      tytul: 'Pauza pracownika',
      opis: pauza.powod ?? pauza.typPauzy,
    })),
  ]
    .sort((a, b) => b.data.getTime() - a.data.getTime())
    .slice(0, 10)
    .map((zdarzenie) => ({
      ...zdarzenie,
      relatywnie: formatRelativeTime(zdarzenie.data),
    }));

  return {
    aktywneZlecenia: zlecenia.filter((item) => item.status === 'W_TOKU').length,
    zleceniaPauza: zlecenia.filter((item) => item.status === 'PAUZA').length,
    zleceniaStop: zlecenia.filter((item) => item.status === 'STOP').length,
    pracownicyNaHali: pracownicy.length,
    alertyMagazynowe: alertyMagazynowe.liczbaAlertow,
    maszyny: maszynyZProdukcja,
    pracownicy,
    timeline,
    biuro: {
      nadchodzaceZamowienia: nadchodzaceZamowienia.map((zamowienie) => ({
        id: zamowienie.id,
        idProdio: zamowienie.idProdio,
        klient: zamowienie.klient,
        oczekiwanaData: zamowienie.oczekiwanaData,
        pozycje: zamowienie.pozycje.map((pozycja) => ({
          ilosc: pozycja.ilosc,
          produkt: pozycja.produkt,
        })),
      })),
      zalegleZamowienia: zalegleZamowienia.map((zamowienie) => ({
        id: zamowienie.id,
        idProdio: zamowienie.idProdio,
        klient: zamowienie.klient,
        oczekiwanaData: zamowienie.oczekiwanaData,
        status: zamowienie.status,
      })),
      dniWolne: dniWolne.map((dzien) => ({
        id: dzien.id,
        data: dzien.data,
        przyczyna: dzien.przyczyna,
        zatwierdzony: dzien.zatwierdzony,
        pracownik: dzien.pracownik,
      })),
    },
  };
}

async function pobierzMetrykiProdukcji() {
  const teraz = new Date();
  const [zlecenia, maszynyAktywne] = await Promise.all([
    prisma.zlecenieProdukcyjne.findMany({
      where: {
        aktywne: true,
        status: { in: STATUSY_MASZYN },
      },
      take: 8,
      orderBy: [{ zaktualizowanyW: 'desc' }],
      include: {
        zamowienie: {
          select: {
            idProdio: true,
            pozycje: {
              take: 1,
              select: {
                produkt: { select: { nazwa: true } },
              },
            },
          },
        },
        historiaWydajnosci: {
          select: {
            czasStart: true,
            czasStop: true,
          },
        },
      },
    }),
    prisma.maszyna.count({ where: { aktywna: true } }),
  ]);

  const porownanieCzasu = zlecenia.map((zlecenie) => {
    const planowaneMinuty = plannedMinutesFromOrder(
      zlecenie.iloscPlan,
      Number(zlecenie.normaSztGodz),
      zlecenie.planowanyStart,
      zlecenie.planowanyStop
    );
    const rzeczywisteMinuty = zlecenie.historiaWydajnosci.reduce(
      (suma, wpis) => suma + diffMinutes(wpis.czasStart, wpis.czasStop ?? teraz),
      0
    );

    return {
      id: zlecenie.id,
      etykieta: zlecenie.numer,
      zamowienie: zlecenie.zamowienie.idProdio,
      produkt: zlecenie.zamowienie.pozycje[0]?.produkt?.nazwa ?? null,
      planowaneMinuty,
      rzeczywisteMinuty,
    };
  });

  const sumaPlan = zlecenia.reduce((suma, item) => suma + item.iloscPlan, 0);
  const sumaWykonana = zlecenia.reduce((suma, item) => suma + item.iloscWykonana, 0);
  const sumaBrakow = zlecenia.reduce((suma, item) => suma + item.iloscBrakow, 0);
  const sumaPlanowanychMinut = porownanieCzasu.reduce((suma, item) => suma + item.planowaneMinuty, 0);
  const sumaRzeczywistychMinut = porownanieCzasu.reduce((suma, item) => suma + item.rzeczywisteMinuty, 0);
  const aktywneMaszyny = zlecenia.filter((item) => item.status === 'W_TOKU').length;

  const wykonaniePlanu = percent(sumaWykonana, sumaPlan);
  const wydajnosc = sumaRzeczywistychMinut > 0 ? Math.min(100, Math.round((sumaPlanowanychMinut / sumaRzeczywistychMinut) * 100)) : 0;
  const jakosc = percent(sumaWykonana, sumaWykonana + sumaBrakow);
  const dostepnosc = percent(aktywneMaszyny, maszynyAktywne);
  const oee = Math.round((dostepnosc * wydajnosc * jakosc) / 10000);

  return {
    porownanieCzasu,
    kpi: [
      { etykieta: 'Wydajnosc', wartosc: wydajnosc, cel: 85 },
      { etykieta: 'OEE', wartosc: oee, cel: 75 },
      { etykieta: 'Wykonanie planu', wartosc: wykonaniePlanu, cel: 90 },
    ],
    podsumowanie: {
      dostepnosc,
      wydajnosc,
      jakosc,
      oee,
      wykonaniePlanu,
    },
  };
}

async function pobierzStanMeldunkowy(pracownikId: number) {
  const teraz = new Date();
  const [pracownik, rejestracja, pauza, zlecenie] = await Promise.all([
    prisma.pracownik.findUnique({
      where: { id: pracownikId },
      select: {
        id: true,
        imie: true,
        nazwisko: true,
        kolorAvatara: true,
        stanowisko: true,
        aktywny: true,
      },
    }),
    prisma.rejestraCzasPracy.findFirst({
      where: {
        pracownikId,
        wyjscie: null,
      },
      orderBy: [{ wejscie: 'desc' }],
    }),
    prisma.pauza.findFirst({
      where: {
        pracownikId,
        czasStop: null,
      },
      orderBy: [{ czasStart: 'desc' }],
    }),
    prisma.zlecenieProdukcyjne.findFirst({
      where: {
        aktywne: true,
        przypisaniPracownicyIds: { has: pracownikId },
      },
      orderBy: [{ zaktualizowanyW: 'desc' }],
      include: {
        maszyna: { select: { id: true, nazwa: true } },
        zamowienie: {
          select: {
            id: true,
            idProdio: true,
            klient: { select: { id: true, nazwa: true } },
            pozycje: {
              take: 1,
              select: {
                produkt: { select: { id: true, nazwa: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!pracownik) {
    return null;
  }

  const status = pauza ? 'PAUZA' : rejestracja ? 'START' : 'STOP';

  return {
    pracownik,
    status,
    czasOdLogowaniaMinuty: rejestracja ? diffMinutes(rejestracja.wejscie, teraz) : 0,
    czasOdLogowaniaTekst: rejestracja ? formatDuration(diffMinutes(rejestracja.wejscie, teraz)) : '0 min',
    aktywnaPauza: pauza
      ? {
          id: pauza.id,
          czasStart: pauza.czasStart,
          typPauzy: pauza.typPauzy,
          powod: pauza.powod,
        }
      : null,
    zlecenie: zlecenie
      ? {
          id: zlecenie.id,
          numer: zlecenie.numer,
          status: zlecenie.status,
          maszyna: zlecenie.maszyna,
          zamowienie: zlecenie.zamowienie,
          produkt: zlecenie.zamowienie.pozycje[0]?.produkt ?? null,
        }
      : null,
  };
}

export const pobierzPulpit: RequestHandler = async (_req, res) => {
  try {
    const dzisiaj = startOfToday();
    const [kontekst, metryki, alerty] = await Promise.all([
      pobierzKontekstProdukcji(),
      pobierzMetrykiProdukcji(),
      pobierzAlertyMagazynowe(),
    ]);

    const [zleceniaGotowe, zamowieniaWRealizacji, transakcjeNaDzisiaj, listaAktywnychZlecen] = await Promise.all([
      prisma.zlecenieProdukcyjne.count({
        where: { status: 'GOTOWE', aktywne: true },
      }),
      prisma.zamowienie.count({
        where: { status: 'W_REALIZACJI' },
      }),
      prisma.transakcjaMagazynowa.count({
        where: { utworzonyW: { gte: dzisiaj } },
      }),
      prisma.zlecenieProdukcyjne.findMany({
        where: {
          status: 'W_TOKU',
          aktywne: true,
        },
        orderBy: [{ zaktualizowanyW: 'desc' }, { id: 'desc' }],
        take: 8,
        include: {
          maszyna: {
            select: {
              id: true,
              nazwa: true,
            },
          },
          zamowienie: {
            select: {
              id: true,
              idProdio: true,
              klient: {
                select: {
                  id: true,
                  nazwa: true,
                },
              },
              pozycje: {
                take: 1,
                select: {
                  ilosc: true,
                  produkt: {
                    select: {
                      id: true,
                      nazwa: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    res.json({
      sukces: true,
      dane: {
        aktywneZlecenia: kontekst.aktywneZlecenia,
        zleceniaGotowe,
        zamowieniaWRealizacji,
        pracownicyNaHali: kontekst.pracownicyNaHali,
        alertyMagazynowe: alerty.liczbaAlertow,
        transakcjeNaDzisiaj,
        listaAktywnychZlecen: listaAktywnychZlecen.map((zlecenie) => ({
          id: zlecenie.id,
          numer: zlecenie.numer,
          status: zlecenie.status,
          iloscPlan: zlecenie.iloscPlan,
          iloscWykonana: zlecenie.iloscWykonana,
          klient: zlecenie.zamowienie.klient,
          maszyna: zlecenie.maszyna,
          zamowienie: {
            id: zlecenie.zamowienie.id,
            idProdio: zlecenie.zamowienie.idProdio,
          },
          produkt: zlecenie.zamowienie.pozycje[0]?.produkt ?? null,
          iloscZamowiona: zlecenie.zamowienie.pozycje[0]?.ilosc ?? null,
        })),
        statusyMaszyn: {
          wToku: kontekst.aktywneZlecenia,
          pauza: kontekst.zleceniaPauza,
          stop: kontekst.zleceniaStop,
        },
        metryki: metryki.podsumowanie,
      },
    });
  } catch (blad) {
    console.error('[pobierzPulpit]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac danych pulpitu.' });
  }
};

export const pobierzProdukcjePulpitu: RequestHandler = async (_req, res) => {
  try {
    const dane = await pobierzKontekstProdukcji();
    res.json({ sukces: true, dane });
  } catch (blad) {
    console.error('[pobierzProdukcjePulpitu]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac danych produkcyjnych pulpitu.' });
  }
};

export const pobierzMetrykiPulpitu: RequestHandler = async (_req, res) => {
  try {
    const dane = await pobierzMetrykiProdukcji();
    res.json({ sukces: true, dane });
  } catch (blad) {
    console.error('[pobierzMetrykiPulpitu]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac metryk pulpitu.' });
  }
};

export const pobierzAlertyPulpitu: RequestHandler = async (_req, res) => {
  try {
    const dane = await pobierzAlertyMagazynowe();
    res.json({ sukces: true, dane });
  } catch (blad) {
    console.error('[pobierzAlertyPulpitu]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac alertow magazynowych.' });
  }
};

export const zalogujDoPaneluMeldunkowego: RequestHandler = async (req, res) => {
  try {
    const identyfikator = String(req.body.identyfikator ?? '').trim();

    if (!identyfikator) {
      res.status(400).json({ sukces: false, wiadomosc: 'Podaj PIN lub numer pracownika.' });
      return;
    }

    const pracownikId = Number.parseInt(identyfikator, 10);
    const pracownik = await prisma.pracownik.findFirst({
      where: {
        aktywny: true,
        OR: [
          { pin: identyfikator },
          ...(Number.isNaN(pracownikId) ? [] : [{ id: pracownikId }]),
        ],
      },
      select: { id: true },
    });

    if (!pracownik) {
      res.status(404).json({ sukces: false, wiadomosc: 'Nie znaleziono aktywnego pracownika dla podanego PIN-u lub numeru.' });
      return;
    }

    const stan = await pobierzStanMeldunkowy(pracownik.id);
    res.json({ sukces: true, dane: stan });
  } catch (blad) {
    console.error('[zalogujDoPaneluMeldunkowego]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie zalogowac do panelu meldunkowego.' });
  }
};

export const wykonajAkcjePaneluMeldunkowego: RequestHandler = async (req, res) => {
  try {
    const pracownikId = Number.parseInt(String(req.body.pracownikId ?? ''), 10);
    const akcja = String(req.body.akcja ?? '').trim().toUpperCase() as 'START' | 'PAUZA' | 'STOP';

    if (!Number.isFinite(pracownikId) || !['START', 'PAUZA', 'STOP'].includes(akcja)) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nieprawidlowe dane akcji panelu meldunkowego.' });
      return;
    }

    const teraz = new Date();
    const [pracownik, aktywnaRejestracja, aktywnaPauza, aktywneZlecenie] = await Promise.all([
      prisma.pracownik.findUnique({ where: { id: pracownikId }, select: { id: true, aktywny: true } }),
      prisma.rejestraCzasPracy.findFirst({
        where: {
          pracownikId,
          wyjscie: null,
        },
        orderBy: [{ wejscie: 'desc' }],
      }),
      prisma.pauza.findFirst({
        where: {
          pracownikId,
          czasStop: null,
        },
        orderBy: [{ czasStart: 'desc' }],
      }),
      prisma.zlecenieProdukcyjne.findFirst({
        where: {
          aktywne: true,
          przypisaniPracownicyIds: { has: pracownikId },
        },
        orderBy: [{ zaktualizowanyW: 'desc' }],
        select: { id: true, status: true },
      }),
    ]);

    if (!pracownik?.aktywny) {
      res.status(404).json({ sukces: false, wiadomosc: 'Pracownik nie istnieje lub jest nieaktywny.' });
      return;
    }

    if (akcja === 'PAUZA' && !aktywnaRejestracja) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nie mozna uruchomic pauzy bez rozpoczecia pracy.' });
      return;
    }

    if (akcja === 'START') {
      await prisma.$transaction([
        ...(!aktywnaRejestracja ? [prisma.rejestraCzasPracy.create({ data: { pracownikId, wejscie: teraz, wejscieWyglad: teraz } })] : []),
        ...(aktywnaPauza ? [prisma.pauza.update({ where: { id: aktywnaPauza.id }, data: { czasStop: teraz } })] : []),
        ...(aktywneZlecenie && aktywneZlecenie.status !== 'W_TOKU' ? [prisma.zlecenieProdukcyjne.update({ where: { id: aktywneZlecenie.id }, data: { status: 'W_TOKU' } })] : []),
      ]);
    }

    if (akcja === 'PAUZA') {
      await prisma.$transaction([
        ...(!aktywnaPauza ? [prisma.pauza.create({ data: { pracownikId, czasStart: teraz, typPauzy: TypPauzy.PRZERWA_REGULAMINOWA } })] : []),
        ...(aktywneZlecenie && aktywneZlecenie.status !== 'PAUZA' ? [prisma.zlecenieProdukcyjne.update({ where: { id: aktywneZlecenie.id }, data: { status: 'PAUZA' } })] : []),
      ]);
    }

    if (akcja === 'STOP') {
      await prisma.$transaction([
        ...(aktywnaPauza ? [prisma.pauza.update({ where: { id: aktywnaPauza.id }, data: { czasStop: teraz } })] : []),
        ...(aktywnaRejestracja ? [prisma.rejestraCzasPracy.update({ where: { id: aktywnaRejestracja.id }, data: { wyjscie: teraz, wyjscieWyglad: teraz } })] : []),
        ...(aktywneZlecenie && aktywneZlecenie.status !== 'STOP' ? [prisma.zlecenieProdukcyjne.update({ where: { id: aktywneZlecenie.id }, data: { status: 'STOP' } })] : []),
      ]);
    }

    const stan = await pobierzStanMeldunkowy(pracownikId);
    res.json({ sukces: true, dane: stan });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie wykonac akcji panelu meldunkowego.' });
  }
};
