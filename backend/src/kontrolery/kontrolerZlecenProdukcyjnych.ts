import { Request, Response } from 'express';
import { PrismaClient, StatusZlecenia } from '@prisma/client';

const prisma = new PrismaClient();

const STATUSY_UKONCZONE: StatusZlecenia[] = ['GOTOWE', 'ANULOWANE'];

function parseIntValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseNullableIntValue(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseNumberValue(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseDateValue(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function parseIntArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => parseInt(String(item), 10))
    .filter((item) => !Number.isNaN(item));
}

function formatujNumerZlecenia(kolejnosc: number, zamowienieId: number, year: number) {
  return `${kolejnosc}/${zamowienieId}/${year}`;
}

async function wygenerujNumerZlecenia(zamowienieId: number) {
  const liczbaIstniejacych = await prisma.zlecenieProdukcyjne.count({
    where: { zamowienieId },
  });

  return formatujNumerZlecenia(liczbaIstniejacych + 1, zamowienieId, new Date().getFullYear());
}

function obliczPlanowanyCzasGodziny(iloscPlan: number, normaSztGodz: number) {
  if (iloscPlan <= 0 || normaSztGodz <= 0) return 0;
  return iloscPlan / normaSztGodz;
}

function obliczRzeczywistyCzasGodziny(
  historia: Array<{ czasStart: Date; czasStop: Date | null }>
) {
  return historia.reduce((sum, wpis) => {
    if (!wpis.czasStop) return sum;
    return sum + (wpis.czasStop.getTime() - wpis.czasStart.getTime()) / 1000 / 60 / 60;
  }, 0);
}

function obliczKosztyDlaZlecenia(zlecenie: {
  iloscPlan: number;
  iloscWykonana: number;
  iloscBrakow: number;
  normaSztGodz: unknown;
  maszyna: { kosztRbh: unknown; kosztUstawiania: unknown };
  historiaWydajnosci: Array<{
    czasStart: Date;
    czasStop: Date | null;
    kosztMaszynyPln: unknown;
    kosztPracownikaPln: unknown;
  }>;
  przypisaniPracownicy: Array<{ stawkaGodzinowa: unknown }>;
  zamowienie: {
    pozycje: Array<{
      produkt: {
        bomSurowcow: Array<{
          ilosc: unknown;
          surowiec: { cena: unknown; nazwa: string; jednostka: string };
        }>;
      };
    }>;
  };
}) {
  const normaSztGodz = parseNumberValue(zlecenie.normaSztGodz);
  const planowanyCzasGodziny = obliczPlanowanyCzasGodziny(zlecenie.iloscPlan, normaSztGodz);
  const kosztMaszynyRbh = parseNumberValue(zlecenie.maszyna.kosztRbh);
  const kosztUstawiania = parseNumberValue(zlecenie.maszyna.kosztUstawiania);
  const stawkiPracownikow = zlecenie.przypisaniPracownicy.reduce(
    (sum, pracownik) => sum + parseNumberValue(pracownik.stawkaGodzinowa),
    0
  );

  const zrealizowanyCzasGodziny = obliczRzeczywistyCzasGodziny(zlecenie.historiaWydajnosci);
  const zrealizowanyKosztMaszyny = zlecenie.historiaWydajnosci.reduce(
    (sum, wpis) => sum + parseNumberValue(wpis.kosztMaszynyPln),
    0
  );
  const zrealizowanyKosztPracownikow = zlecenie.historiaWydajnosci.reduce(
    (sum, wpis) => sum + parseNumberValue(wpis.kosztPracownikaPln),
    0
  );

  const planowanyKosztMaszyny = planowanyCzasGodziny * kosztMaszynyRbh;
  const planowanyKosztPracownikow = planowanyCzasGodziny * stawkiPracownikow;
  const sumaPlanowana = planowanyKosztMaszyny + planowanyKosztPracownikow + kosztUstawiania;
  const sumaRzeczywista = zrealizowanyKosztMaszyny + zrealizowanyKosztPracownikow + kosztUstawiania;

  const iloscDobra = Math.max(0, zlecenie.iloscWykonana - zlecenie.iloscBrakow);
  const kosztNaDobryProduktPlan = iloscDobra > 0 ? sumaPlanowana / iloscDobra : 0;
  const kosztNaDobryProduktReal = iloscDobra > 0 ? sumaRzeczywista / iloscDobra : 0;

  const pozycjaProduktowa = zlecenie.zamowienie.pozycje[0];
  const surowce = (pozycjaProduktowa?.produkt.bomSurowcow ?? []).map((pozycja) => {
    const iloscNaProdukt = parseNumberValue(pozycja.ilosc);
    const cena = parseNumberValue(pozycja.surowiec.cena);
    const planowanaIlosc = iloscNaProdukt * zlecenie.iloscPlan;
    const realnaIlosc = iloscNaProdukt * zlecenie.iloscWykonana;

    return {
      nazwa: pozycja.surowiec.nazwa,
      jednostka: pozycja.surowiec.jednostka,
      planowanaIlosc,
      realnaIlosc,
      odchylenieIlosci: realnaIlosc - planowanaIlosc,
      planowanyKoszt: planowanaIlosc * cena,
      zrealizowanyKoszt: realnaIlosc * cena,
    };
  });

  const planowanyKosztSurowcow = surowce.reduce((sum, pozycja) => sum + pozycja.planowanyKoszt, 0);
  const zrealizowanyKosztSurowcow = surowce.reduce((sum, pozycja) => sum + pozycja.zrealizowanyKoszt, 0);

  return {
    kpi: {
      produkty: {
        plan: zlecenie.iloscPlan,
        wykonane: zlecenie.iloscWykonana,
        procent: zlecenie.iloscPlan > 0 ? (zlecenie.iloscWykonana / zlecenie.iloscPlan) * 100 : 0,
      },
      brakowosc: {
        iloscBrakow: zlecenie.iloscBrakow,
        procent: zlecenie.iloscWykonana > 0 ? (zlecenie.iloscBrakow / zlecenie.iloscWykonana) * 100 : 0,
      },
      czas: {
        planowanyGodziny: planowanyCzasGodziny,
        zrealizowanyGodziny: zrealizowanyCzasGodziny,
        procent: planowanyCzasGodziny > 0 ? (zrealizowanyCzasGodziny / planowanyCzasGodziny) * 100 : 0,
      },
    },
    tabelaKosztow: [
      {
        klucz: 'suma-operacje',
        etykieta: 'Suma z maszyn/operacji',
        poziom: 0,
        suma: true,
        planowanyCzas: planowanyCzasGodziny,
        planowanyKoszt: planowanyKosztMaszyny + planowanyKosztPracownikow,
        zrealizowanyCzas: zrealizowanyCzasGodziny,
        zrealizowanyKoszt: zrealizowanyKosztMaszyny + zrealizowanyKosztPracownikow,
      },
      {
        klucz: 'maszyny',
        etykieta: 'w tym maszyny',
        poziom: 1,
        planowanyCzas: planowanyCzasGodziny,
        planowanyKoszt: planowanyKosztMaszyny,
        zrealizowanyCzas: zrealizowanyCzasGodziny,
        zrealizowanyKoszt: zrealizowanyKosztMaszyny,
      },
      {
        klucz: 'pracownicy',
        etykieta: 'w tym pracownicy',
        poziom: 1,
        planowanyCzas: planowanyCzasGodziny,
        planowanyKoszt: planowanyKosztPracownikow,
        zrealizowanyCzas: zrealizowanyCzasGodziny,
        zrealizowanyKoszt: zrealizowanyKosztPracownikow,
      },
      {
        klucz: 'ustawianie',
        etykieta: 'Suma z ustawiania',
        poziom: 0,
        suma: true,
        planowanyCzas: 0,
        planowanyKoszt: kosztUstawiania,
        zrealizowanyCzas: 0,
        zrealizowanyKoszt: kosztUstawiania,
      },
      {
        klucz: 'suma-laczna',
        etykieta: 'Suma laczna',
        poziom: 0,
        suma: true,
        planowanyCzas: planowanyCzasGodziny,
        planowanyKoszt: sumaPlanowana,
        zrealizowanyCzas: zrealizowanyCzasGodziny,
        zrealizowanyKoszt: sumaRzeczywista,
      },
      {
        klucz: 'dobry-produkt',
        etykieta: 'Dla gotowego produktu',
        poziom: 0,
        planowanyCzas: iloscDobra,
        planowanyKoszt: kosztNaDobryProduktPlan,
        zrealizowanyCzas: iloscDobra,
        zrealizowanyKoszt: kosztNaDobryProduktReal,
      },
      {
        klucz: 'surowce',
        etykieta: 'Surowce',
        poziom: 0,
        suma: true,
        planowanyCzas: 0,
        planowanyKoszt: planowanyKosztSurowcow,
        zrealizowanyCzas: 0,
        zrealizowanyKoszt: zrealizowanyKosztSurowcow,
      },
      {
        klucz: 'calkowity',
        etykieta: 'Calkowity koszt zamowienia',
        poziom: 0,
        suma: true,
        planowanyCzas: planowanyCzasGodziny,
        planowanyKoszt: sumaPlanowana + planowanyKosztSurowcow,
        zrealizowanyCzas: zrealizowanyCzasGodziny,
        zrealizowanyKoszt: sumaRzeczywista + zrealizowanyKosztSurowcow,
      },
    ],
    zuzycieSurowcow: surowce,
  };
}

async function pobierzZlecenieZRelacjami(id: number) {
  const zlecenie = await prisma.zlecenieProdukcyjne.findUnique({
    where: { id },
    include: {
      maszyna: true,
      zamowienie: {
        include: {
          klient: true,
          pozycje: {
            include: {
              produkt: {
                include: {
                  grupa: true,
                  bomSurowcow: {
                    include: {
                      surowiec: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      historiaWydajnosci: {
        orderBy: { czasStart: 'desc' },
      },
    },
  });

  if (!zlecenie) return null;

  const przypisaniPracownicy = zlecenie.przypisaniPracownicyIds.length
    ? await prisma.pracownik.findMany({
        where: { id: { in: zlecenie.przypisaniPracownicyIds } },
        orderBy: [{ imie: 'asc' }, { nazwisko: 'asc' }],
      })
    : [];

  const poprzednik = zlecenie.poprzednikId
    ? await prisma.zlecenieProdukcyjne.findUnique({
        where: { id: zlecenie.poprzednikId },
        select: {
          id: true,
          numer: true,
          status: true,
          iloscPlan: true,
          iloscWykonana: true,
        },
      })
    : null;

  return { ...zlecenie, przypisaniPracownicy, poprzednik };
}

async function walidujPoprzednik(
  aktualneId: number | null,
  poprzednikId: number | null | undefined,
  status: StatusZlecenia | undefined
) {
  if (!poprzednikId || status !== 'W_TOKU') return null;
  if (aktualneId && aktualneId === poprzednikId) {
    return 'Zlecenie nie moze wskazywac siebie jako poprzednika.';
  }

  const poprzednik = await prisma.zlecenieProdukcyjne.findUnique({
    where: { id: poprzednikId },
    select: { status: true, iloscPlan: true, iloscWykonana: true },
  });

  if (!poprzednik) return 'Wybrany poprzednik nie istnieje.';

  const zakonczony =
    poprzednik.status === 'GOTOWE' || poprzednik.iloscWykonana >= poprzednik.iloscPlan;

  return zakonczony ? null : 'Nie mozna uruchomic zlecenia, dopoki poprzednik nie jest gotowy.';
}

export async function pobierzListeZlecenProdukcyjnych(req: Request, res: Response): Promise<void> {
  try {
    const strona = Math.max(1, parseInt(String(req.query.strona ?? '1'), 10));
    const iloscNaStrone = Math.min(100, parseInt(String(req.query.iloscNaStrone ?? '30'), 10));
    const szukaj = String(req.query.szukaj ?? '').trim();
    const pokazNieaktywne = req.query.pokazNieaktywne === 'true';
    const ukryjGotowe = req.query.ukryjGotowe === 'true';

    const where: Record<string, unknown> = {};

    if (!pokazNieaktywne) where.aktywne = true;
    if (ukryjGotowe) where.status = { notIn: STATUSY_UKONCZONE };

    if (szukaj) {
      where.OR = [
        { numer: { contains: szukaj, mode: 'insensitive' } },
        { zamowienie: { idProdio: { contains: szukaj, mode: 'insensitive' } } },
        { zamowienie: { zewnetrznyNumer: { contains: szukaj, mode: 'insensitive' } } },
        { zamowienie: { klient: { nazwa: { contains: szukaj, mode: 'insensitive' } } } },
        {
          zamowienie: {
            pozycje: {
              some: {
                produkt: { nazwa: { contains: szukaj, mode: 'insensitive' } },
              },
            },
          },
        },
      ];
    }

    const [dane, lacznie] = await Promise.all([
      prisma.zlecenieProdukcyjne.findMany({
        where,
        skip: (strona - 1) * iloscNaStrone,
        take: iloscNaStrone,
        orderBy: [{ utworzonyW: 'desc' }],
        include: {
          zamowienie: {
            include: {
              klient: true,
              pozycje: {
                include: {
                  produkt: { include: { grupa: true } },
                },
              },
            },
          },
        },
      }),
      prisma.zlecenieProdukcyjne.count({ where }),
    ]);

    const poprzednikiIds = dane
      .map((item) => item.poprzednikId)
      .filter((item): item is number => typeof item === 'number');

    const poprzedniki = poprzednikiIds.length
      ? await prisma.zlecenieProdukcyjne.findMany({
          where: { id: { in: poprzednikiIds } },
          select: {
            id: true,
            numer: true,
            status: true,
            iloscPlan: true,
            iloscWykonana: true,
          },
        })
      : [];

    const mapaPoprzednikow = new Map(poprzedniki.map((item) => [item.id, item]));

    const wynik = dane.map((item) => {
      const produkt = item.zamowienie.pozycje[0]?.produkt ?? null;
      const poprzednik = item.poprzednikId ? mapaPoprzednikow.get(item.poprzednikId) ?? null : null;

      return {
        id: item.id,
        numer:
          item.numer ||
          formatujNumerZlecenia(item.id, item.zamowienieId, item.utworzonyW.getFullYear()),
        status: item.status,
        aktywne: item.aktywne,
        iloscPlan: item.iloscPlan,
        iloscWykonana: item.iloscWykonana,
        maszynaKoncowa: item.maszynaKoncowa,
        zamowienieId: item.zamowienieId,
        idProdio: item.zamowienie.idProdio,
        zewnetrznyNumer: item.zamowienie.zewnetrznyNumer,
        klient: item.zamowienie.klient
          ? { id: item.zamowienie.klient.id, nazwa: item.zamowienie.klient.nazwa }
          : null,
        produkt: produkt
          ? {
              id: produkt.id,
              nazwa: produkt.nazwa,
              grupa: produkt.grupa ? { id: produkt.grupa.id, nazwa: produkt.grupa.nazwa } : null,
              zdjecie: produkt.zdjecie,
            }
          : null,
        poprzednik: poprzednik
          ? {
              id: poprzednik.id,
              numer: poprzednik.numer,
              status: poprzednik.status,
              iloscPlan: poprzednik.iloscPlan,
              iloscWykonana: poprzednik.iloscWykonana,
              procent:
                poprzednik.iloscPlan > 0
                  ? (poprzednik.iloscWykonana / poprzednik.iloscPlan) * 100
                  : 0,
            }
          : null,
      };
    });

    res.json({ sukces: true, dane: wynik, lacznie, strona, iloscNaStrone });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac zlecen produkcyjnych.' });
  }
}

export async function pobierzZlecenieProdukcyjne(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const zlecenie = await pobierzZlecenieZRelacjami(id);

    if (!zlecenie) {
      res.status(404).json({ sukces: false, wiadomosc: 'Zlecenie produkcyjne nie istnieje.' });
      return;
    }

    const koszty = obliczKosztyDlaZlecenia(zlecenie);
    const kandydaciPoprzednika = await prisma.zlecenieProdukcyjne.findMany({
      where: { zamowienieId: zlecenie.zamowienieId, id: { not: zlecenie.id } },
      select: {
        id: true,
        numer: true,
        status: true,
        iloscPlan: true,
        iloscWykonana: true,
      },
      orderBy: { utworzonyW: 'asc' },
    });

    res.json({
      sukces: true,
      dane: { ...zlecenie, koszty, kandydaciPoprzednika },
    });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac szczegolow zlecenia.' });
  }
}

export async function inicjalizujZleceniaDlaZamowienia(req: Request, res: Response): Promise<void> {
  try {
    const zamowienieId = parseIntValue(req.body.zamowienieId);

    if (!zamowienieId) {
      res.status(400).json({ sukces: false, wiadomosc: 'Identyfikator zamowienia jest wymagany.' });
      return;
    }

    const wynik = await prisma.$transaction(async (tx) => {
      const liczbaIstniejacych = await tx.zlecenieProdukcyjne.count({
        where: { zamowienieId },
      });

      if (liczbaIstniejacych > 0) {
        return { utworzono: false, liczbaNowych: 0 };
      }

      const zamowienie = await tx.zamowienie.findUnique({
        where: { id: zamowienieId },
        include: {
          pozycje: {
            include: {
              produkt: {
                include: {
                  bomOperacji: {
                    orderBy: { kolejnosc: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

      if (!zamowienie) {
        throw new Error('NOT_FOUND');
      }

      let numerKolejny = 1;
      let liczbaNowych = 0;

      for (const pozycja of zamowienie.pozycje) {
        const produkt = pozycja.produkt;
        const operacje = produkt?.bomOperacji ?? [];

        let poprzednikId: number | null = null;

        for (const operacja of operacje) {
          const zlecenie: { id: number } = await tx.zlecenieProdukcyjne.create({
            data: {
              numer: formatujNumerZlecenia(numerKolejny, zamowienieId, new Date().getFullYear()),
              zamowienieId,
              maszynaId: operacja.maszynaId,
              status: 'STOP',
              aktywne: true,
              iloscPlan: Number(pozycja.ilosc ?? 0),
              iloscWykonana: 0,
              iloscBrakow: 0,
              planowanyStart: null,
              planowanyStop: zamowienie.oczekiwanaData ?? null,
              poprzednikId,
              normaSztGodz: parseNumberValue(operacja.normaSztGodz),
              przypisaniPracownicyIds: [],
              tagi: operacja.tagi ?? [],
              parametry: operacja.parametry ?? null,
              uwagi: null,
              maszynaKoncowa: operacja.maszynaKoncowa,
            },
            select: { id: true },
          });

          poprzednikId = zlecenie.id;
          numerKolejny += 1;
          liczbaNowych += 1;
        }
      }

      return { utworzono: true, liczbaNowych };
    });

    res.status(201).json({ sukces: true, dane: wynik });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ sukces: false, wiadomosc: 'Zamowienie nie istnieje.' });
      return;
    }

    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie zainicjalizowac zlecen dla zamowienia.' });
  }
}

export async function utworzZlecenieProdukcyjne(req: Request, res: Response): Promise<void> {
  try {
    const zamowienieId = parseIntValue(req.body.zamowienieId);
    const maszynaId = parseIntValue(req.body.maszynaId);

    if (!zamowienieId || !maszynaId) {
      res.status(400).json({ sukces: false, wiadomosc: 'Zamowienie i maszyna sa wymagane.' });
      return;
    }

    const status = (req.body.status as StatusZlecenia | undefined) ?? 'STOP';
    const poprzednikId = parseNullableIntValue(req.body.poprzednikId);
    const bladPoprzednika = await walidujPoprzednik(null, poprzednikId ?? undefined, status);

    if (bladPoprzednika) {
      res.status(400).json({ sukces: false, wiadomosc: bladPoprzednika });
      return;
    }

    const zlecenie = await prisma.zlecenieProdukcyjne.create({
      data: {
        numer: await wygenerujNumerZlecenia(zamowienieId),
        zamowienieId,
        maszynaId,
        status,
        aktywne: req.body.aktywne ?? true,
        iloscPlan: parseIntValue(req.body.iloscPlan) ?? 0,
        iloscWykonana: parseIntValue(req.body.iloscWykonana) ?? 0,
        iloscBrakow: parseIntValue(req.body.iloscBrakow) ?? 0,
        planowanyStart: parseDateValue(req.body.planowanyStart),
        planowanyStop: parseDateValue(req.body.planowanyStop),
        poprzednikId,
        normaSztGodz: parseNumberValue(req.body.normaSztGodz),
        przypisaniPracownicyIds: parseIntArray(req.body.przypisaniPracownicyIds),
        tagi: parseStringArray(req.body.tagi),
        parametry: req.body.parametry ? String(req.body.parametry) : undefined,
        uwagi: req.body.uwagi ? String(req.body.uwagi) : undefined,
        maszynaKoncowa: req.body.maszynaKoncowa ?? false,
      },
    });

    res.status(201).json({ sukces: true, dane: zlecenie });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie utworzyc zlecenia produkcyjnego.' });
  }
}

export async function zaktualizujZlecenieProdukcyjne(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const status = req.body.status as StatusZlecenia | undefined;
    const poprzednikId = parseNullableIntValue(req.body.poprzednikId);
    const bladPoprzednika = await walidujPoprzednik(id, poprzednikId ?? undefined, status);

    if (bladPoprzednika) {
      res.status(400).json({ sukces: false, wiadomosc: bladPoprzednika });
      return;
    }

    const zlecenie = await prisma.zlecenieProdukcyjne.update({
      where: { id },
      data: {
        maszynaId: parseIntValue(req.body.maszynaId),
        status,
        aktywne: req.body.aktywne,
        iloscPlan: parseIntValue(req.body.iloscPlan),
        iloscWykonana: parseIntValue(req.body.iloscWykonana),
        iloscBrakow: parseIntValue(req.body.iloscBrakow),
        planowanyStart: parseDateValue(req.body.planowanyStart),
        planowanyStop: parseDateValue(req.body.planowanyStop),
        poprzednikId,
        normaSztGodz:
          req.body.normaSztGodz !== undefined ? parseNumberValue(req.body.normaSztGodz) : undefined,
        przypisaniPracownicyIds:
          req.body.przypisaniPracownicyIds !== undefined
            ? parseIntArray(req.body.przypisaniPracownicyIds)
            : undefined,
        tagi: req.body.tagi !== undefined ? parseStringArray(req.body.tagi) : undefined,
        parametry:
          req.body.parametry !== undefined ? (req.body.parametry ? String(req.body.parametry) : null) : undefined,
        uwagi: req.body.uwagi !== undefined ? (req.body.uwagi ? String(req.body.uwagi) : null) : undefined,
        maszynaKoncowa: req.body.maszynaKoncowa,
      },
    });

    res.json({ sukces: true, dane: zlecenie });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie zapisac zlecenia produkcyjnego.' });
  }
}

export async function usunZlecenieProdukcyjne(req: Request, res: Response): Promise<void> {
  try {
    await prisma.zlecenieProdukcyjne.delete({ where: { id: parseInt(req.params.id, 10) } });
    res.json({ sukces: true, wiadomosc: 'Zlecenie produkcyjne zostalo usuniete.' });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie usunac zlecenia produkcyjnego.' });
  }
}
