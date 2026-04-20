import { PrismaClient, StatusZlecenia } from '@prisma/client';
import type { Request, Response } from 'express';

const prisma = new PrismaClient();

const STATUSY_OTWARTE: StatusZlecenia[] = ['STOP', 'W_TOKU', 'PAUZA'];

function parseIntValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseNumberValue(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseBooleanValue(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

function parseDateValue(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function differenceSeconds(start: Date, stop: Date | null) {
  if (!stop) return 0;
  return Math.max(0, Math.floor((stop.getTime() - start.getTime()) / 1000));
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((safe % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const secs = (safe % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
}

function formatPercent(value: number) {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

async function pobierzMapePracownikow(ids: number[]) {
  if (ids.length === 0) {
    return new Map<number, { id: number; imie: string; nazwisko: string; aktywny: boolean }>();
  }

  const pracownicy = await prisma.pracownik.findMany({
    where: { id: { in: ids } },
    select: { id: true, imie: true, nazwisko: true, aktywny: true },
  });

  return new Map(pracownicy.map((pracownik) => [pracownik.id, pracownik]));
}

async function pobierzMapePauz(pracownikIds: number[], dataOd?: Date, dataDo?: Date) {
  if (pracownikIds.length === 0) {
    return new Map<number, Array<{ czasStart: Date; czasStop: Date | null; powod: string | null; geolokalizacja: string | null }>>();
  }

  const where: Record<string, unknown> = {
    pracownikId: { in: pracownikIds },
  };

  const czasStart: Record<string, Date> = {};

  if (dataOd) {
    czasStart.gte = dataOd;
  }

  if (dataDo) {
    czasStart.lte = dataDo;
  }

  if (Object.keys(czasStart).length > 0) {
    where.czasStart = czasStart;
  }

  const pauzy = await prisma.pauza.findMany({
    where,
    select: {
      pracownikId: true,
      czasStart: true,
      czasStop: true,
      powod: true,
      geolokalizacja: true,
    },
    orderBy: { czasStart: 'desc' },
  });

  const mapa = new Map<number, Array<{ czasStart: Date; czasStop: Date | null; powod: string | null; geolokalizacja: string | null }>>();

  for (const pauza of pauzy) {
    const lista = mapa.get(pauza.pracownikId) ?? [];
    lista.push(pauza);
    mapa.set(pauza.pracownikId, lista);
  }

  return mapa;
}

export async function pobierzHistoriePracy(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)));
    const pracownikId = parseIntValue(req.query.pracownikId);
    const maszynaId = parseIntValue(req.query.maszynaId);
    const klientId = parseIntValue(req.query.klientId);
    const produktId = parseIntValue(req.query.produktId);
    const zlecenieId = parseIntValue(req.query.zlecenieId);
    const dataOd = parseDateValue(req.query.dataOd);
    const dataDo = parseDateValue(req.query.dataDo);
    const tylkoZBrakami = parseBooleanValue(req.query.tylkoZBrakami);
    const tylkoOtwarte = parseBooleanValue(req.query.tylkoOtwarte);
    const ukryjNieaktywnych = parseBooleanValue(req.query.ukryjNieaktywnych);

    const where: Record<string, unknown> = {};

    if (pracownikId !== undefined) {
      where.pracownikId = pracownikId;
    }

    if (tylkoZBrakami) {
      where.iloscBrakow = { gt: 0 };
    }

    if (dataOd || dataDo) {
      const czasStart: Record<string, Date> = {};
      if (dataOd) czasStart.gte = dataOd;
      if (dataDo) czasStart.lte = dataDo;
      where.czasStart = czasStart;
    }

    const zlecenieWhere: Record<string, unknown> = {};

    if (zlecenieId !== undefined) {
      zlecenieWhere.id = zlecenieId;
    }

    if (maszynaId !== undefined) {
      zlecenieWhere.maszynaId = maszynaId;
    }

    if (tylkoOtwarte) {
      zlecenieWhere.status = { in: STATUSY_OTWARTE };
    }

    const zamowienieWhere: Record<string, unknown> = {};
    if (klientId !== undefined) {
      zamowienieWhere.klientId = klientId;
    }

    if (produktId !== undefined) {
      zamowienieWhere.pozycje = { some: { produktId } };
    }

    if (Object.keys(zamowienieWhere).length > 0) {
      zlecenieWhere.zamowienie = zamowienieWhere;
    }

    if (Object.keys(zlecenieWhere).length > 0) {
      where.zlecenie = zlecenieWhere;
    }

    const [wpisy, total] = await Promise.all([
      prisma.historiaWydajnosci.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ czasStart: 'desc' }, { id: 'desc' }],
        include: {
          zlecenie: {
            include: {
              maszyna: {
                include: {
                  panel: true,
                },
              },
              zamowienie: {
                include: {
                  klient: true,
                  pozycje: {
                    include: {
                      produkt: {
                        include: {
                          grupa: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.historiaWydajnosci.count({ where }),
    ]);

    const pracownicyIds = wpisy
      .map((wpis) => wpis.pracownikId)
      .filter((value): value is number => typeof value === 'number');

    const [mapaPracownikow, mapaPauz] = await Promise.all([
      pobierzMapePracownikow([...new Set(pracownicyIds)]),
      pobierzMapePauz([...new Set(pracownicyIds)], dataOd, dataDo),
    ]);

    const dane = wpisy
      .map((wpis) => {
        const pracownik = wpis.pracownikId ? mapaPracownikow.get(wpis.pracownikId) ?? null : null;
        if (ukryjNieaktywnych && pracownik && !pracownik.aktywny) {
          return null;
        }

        const produkt = wpis.zlecenie.zamowienie.pozycje[0]?.produkt ?? null;
        const czasSekundy = differenceSeconds(wpis.czasStart, wpis.czasStop);
        const powiazanePauzy = (wpis.pracownikId ? mapaPauz.get(wpis.pracownikId) : undefined) ?? [];
        const pauzyWZakresie = powiazanePauzy.filter((pauza) => {
          const pauzaStop = pauza.czasStop ?? pauza.czasStart;
          return pauza.czasStart >= wpis.czasStart && (!wpis.czasStop || pauzaStop <= wpis.czasStop);
        });
        const pauzaSekundy = pauzyWZakresie.reduce(
          (sum, pauza) => sum + differenceSeconds(pauza.czasStart, pauza.czasStop),
          0
        );
        const czasBezPauzSekundy = Math.max(0, czasSekundy - pauzaSekundy);
        const normaSztGodz = parseNumberValue(wpis.zlecenie.normaSztGodz);
        const normatywnyCzasSekundy =
          normaSztGodz > 0 ? Math.round((wpis.iloscWykonana / normaSztGodz) * 3600) : 0;
        const wydajnosc =
          normatywnyCzasSekundy > 0 && czasBezPauzSekundy > 0
            ? (normatywnyCzasSekundy / czasBezPauzSekundy) * 100
            : 0;

        return {
          id: wpis.id,
          numerZlecenia: wpis.zlecenie.numer,
          zewnetrznyNumerZamowienia: wpis.zlecenie.zamowienie.zewnetrznyNumer,
          idProdio: wpis.zlecenie.zamowienie.idProdio,
          klient: wpis.zlecenie.zamowienie.klient
            ? {
                id: wpis.zlecenie.zamowienie.klient.id,
                nazwa: wpis.zlecenie.zamowienie.klient.nazwa,
              }
            : null,
          grupaProduktow: produkt?.grupa
            ? {
                id: produkt.grupa.id,
                nazwa: produkt.grupa.nazwa,
              }
            : null,
          produkt: produkt
            ? {
                id: produkt.id,
                nazwa: produkt.nazwa,
              }
            : null,
          panelMeldunkowy: wpis.zlecenie.maszyna.panel
            ? {
                id: wpis.zlecenie.maszyna.panel.id,
                nazwa: wpis.zlecenie.maszyna.panel.nazwa,
              }
            : null,
          maszynaOperacja: {
            id: wpis.zlecenie.maszyna.id,
            nazwa: wpis.zlecenie.maszyna.nazwa,
          },
          pracownik: pracownik
            ? {
                id: pracownik.id,
                imie: pracownik.imie,
                nazwisko: pracownik.nazwisko,
                aktywny: pracownik.aktywny,
              }
            : null,
          iloscPlan: wpis.zlecenie.iloscPlan,
          iloscWykonana: wpis.iloscWykonana,
          czasSekundy,
          czasBezPauzSekundy,
          pauzaSekundy,
          pauzaMinuty: Math.round(pauzaSekundy / 60),
          powodyPrzerw: [...new Set(pauzyWZakresie.map((pauza) => pauza.powod).filter(Boolean))],
          normatywnyCzasSekundy,
          wydajnoscProcent: Number(wydajnosc.toFixed(2)),
          wydajnoscTekst: `${formatPercent(wydajnosc)}% (${wpis.iloscWykonana})`,
          start: wpis.czasStart,
          stop: wpis.czasStop,
          typOperacji: wpis.zlecenie.maszyna.maszynaKoncowa ? 'Koncowa' : 'Standard',
          tagi: wpis.zlecenie.tagi,
          kosztMaszynyPln: parseNumberValue(wpis.kosztMaszynyPln),
          kosztPracownikaPln: parseNumberValue(wpis.kosztPracownikaPln),
          maBraki: wpis.iloscBrakow > 0,
          braki: wpis.iloscBrakow,
          opisBrakow: wpis.opisBrakow,
          operacjaKoncowa: wpis.zlecenie.maszynaKoncowa,
          produkcjaNaMagazyn: !wpis.zlecenie.zamowienie.klientId,
          geolokalizacjaStart: pauzyWZakresie[0]?.geolokalizacja ?? null,
          geolokalizacjaStop: pauzyWZakresie[pauzyWZakresie.length - 1]?.geolokalizacja ?? null,
          dodaneRecznie: wpis.dodanoRecznie,
          utworzyl: req.uzytkownik
            ? `${req.uzytkownik.email}${wpis.dodanoRecznie ? ' (manualnie)' : ''}`
            : null,
          statusZlecenia: wpis.zlecenie.status,
          zlecenieId: wpis.zlecenie.id,
          zamowienieId: wpis.zlecenie.zamowienie.id,
          klientId: wpis.zlecenie.zamowienie.klientId,
          produktId: produkt?.id ?? null,
          grupaProduktowId: produkt?.grupaId ?? null,
          pracownikId: wpis.pracownikId,
          formatowanyCzas: formatDuration(czasSekundy),
          formatowanyCzasBezPauz: formatDuration(czasBezPauzSekundy),
          formatowanaPauza: formatDuration(pauzaSekundy),
          formatowanyNormatywnyCzas: formatDuration(normatywnyCzasSekundy),
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);

    res.json({
      dane,
      total,
      strona: page,
      limit,
    });
  } catch {
    res.status(500).json({ wiadomosc: 'Nie udalo sie pobrac historii pracy.' });
  }
}

export async function utworzManualnyWpisHistoriiPracy(req: Request, res: Response): Promise<void> {
  try {
    const zlecenieId = parseIntValue(req.body.zlecenieId);
    const pracownikId = parseIntValue(req.body.pracownikId);
    const iloscWykonana = parseIntValue(req.body.iloscWykonana) ?? 0;
    const iloscBrakow = parseIntValue(req.body.iloscBrakow) ?? 0;
    const czasStart = parseDateValue(req.body.czasStart);
    const czasStop = parseDateValue(req.body.czasStop);

    if (!zlecenieId || !czasStart) {
      res.status(400).json({ wiadomosc: 'Zlecenie oraz czas start sa wymagane.' });
      return;
    }

    if (czasStop && czasStop < czasStart) {
      res.status(400).json({ wiadomosc: 'Czas stop nie moze byc wczesniejszy niz czas start.' });
      return;
    }

    const zlecenie = await prisma.zlecenieProdukcyjne.findUnique({
      where: { id: zlecenieId },
      include: {
        maszyna: true,
      },
    });

    if (!zlecenie) {
      res.status(404).json({ wiadomosc: 'Zlecenie produkcyjne nie istnieje.' });
      return;
    }

    let pracownik = null;
    if (pracownikId) {
      pracownik = await prisma.pracownik.findUnique({ where: { id: pracownikId } });
      if (!pracownik) {
        res.status(404).json({ wiadomosc: 'Pracownik nie istnieje.' });
        return;
      }
    }

    const czasSekundy = differenceSeconds(czasStart, czasStop ?? null);
    const kosztMaszynyPln = Number(((czasSekundy / 3600) * parseNumberValue(zlecenie.maszyna.kosztRbh)).toFixed(2));
    const kosztPracownikaPln = Number(
      ((czasSekundy / 3600) * parseNumberValue(pracownik?.stawkaGodzinowa ?? 0)).toFixed(2)
    );

    const wpis = await prisma.historiaWydajnosci.create({
      data: {
        zlecenieId,
        pracownikId: pracownikId ?? null,
        iloscWykonana,
        iloscBrakow,
        opisBrakow: req.body.opisBrakow ? String(req.body.opisBrakow) : null,
        czasStart,
        czasStop: czasStop ?? null,
        kosztMaszynyPln,
        kosztPracownikaPln,
        dodanoRecznie: true,
      },
    });

    await prisma.zlecenieProdukcyjne.update({
      where: { id: zlecenieId },
      data: {
        iloscWykonana: { increment: iloscWykonana },
        iloscBrakow: { increment: iloscBrakow },
      },
    });

    res.status(201).json({ dane: wpis, wiadomosc: 'Manualny wpis historii pracy zostal dodany.' });
  } catch {
    res.status(500).json({ wiadomosc: 'Nie udalo sie utworzyc manualnego wpisu historii pracy.' });
  }
}

export async function pobierzRaportDziennyHistoriiPracy(req: Request, res: Response): Promise<void> {
  try {
    const data = parseDateValue(req.query.data);
    if (!data) {
      res.status(400).json({ wiadomosc: 'Podaj parametr data w formacie YYYY-MM-DD.' });
      return;
    }

    const dataOd = startOfDay(data);
    const dataDo = endOfDay(data);

    const wpisy = await prisma.historiaWydajnosci.findMany({
      where: {
        czasStart: {
          gte: dataOd,
          lte: dataDo,
        },
      },
      include: {
        zlecenie: {
          select: {
            normaSztGodz: true,
          },
        },
      },
      orderBy: { czasStart: 'asc' },
    });

    const pracownicyIds = wpisy
      .map((wpis) => wpis.pracownikId)
      .filter((value): value is number => typeof value === 'number');
    const mapaPracownikow = await pobierzMapePracownikow([...new Set(pracownicyIds)]);

    const agregaty = new Map<
      number,
      {
        pracownikId: number;
        pracownik: string;
        sumaCzasuSekundy: number;
        ilosc: number;
        sumaWydajnosci: number;
        liczbaWpisowZWydajnoscia: number;
        liczbaBrakow: number;
      }
    >();

    for (const wpis of wpisy) {
      if (!wpis.pracownikId) {
        continue;
      }

      const pracownik = mapaPracownikow.get(wpis.pracownikId);
      const nazwaPracownika = pracownik
        ? `${pracownik.imie} ${pracownik.nazwisko}`
        : `Pracownik #${wpis.pracownikId}`;
      const aktualny = agregaty.get(wpis.pracownikId) ?? {
        pracownikId: wpis.pracownikId,
        pracownik: nazwaPracownika,
        sumaCzasuSekundy: 0,
        ilosc: 0,
        sumaWydajnosci: 0,
        liczbaWpisowZWydajnoscia: 0,
        liczbaBrakow: 0,
      };

      const czasSekundy = differenceSeconds(wpis.czasStart, wpis.czasStop);
      const normatywnyCzasSekundy =
        parseNumberValue(wpis.zlecenie.normaSztGodz) > 0
          ? (wpis.iloscWykonana / parseNumberValue(wpis.zlecenie.normaSztGodz)) * 3600
          : 0;
      const wydajnosc =
        czasSekundy > 0 && normatywnyCzasSekundy > 0 ? (normatywnyCzasSekundy / czasSekundy) * 100 : 0;

      aktualny.sumaCzasuSekundy += czasSekundy;
      aktualny.ilosc += wpis.iloscWykonana;
      aktualny.liczbaBrakow += wpis.iloscBrakow;

      if (wydajnosc > 0) {
        aktualny.sumaWydajnosci += wydajnosc;
        aktualny.liczbaWpisowZWydajnoscia += 1;
      }

      agregaty.set(wpis.pracownikId, aktualny);
    }

    const dane = Array.from(agregaty.values())
      .map((item) => ({
        pracownikId: item.pracownikId,
        pracownik: item.pracownik,
        sumaCzasuSekundy: item.sumaCzasuSekundy,
        sumaCzasu: formatDuration(item.sumaCzasuSekundy),
        ilosc: item.ilosc,
        wydajnoscSrednia:
          item.liczbaWpisowZWydajnoscia > 0 ? Number((item.sumaWydajnosci / item.liczbaWpisowZWydajnoscia).toFixed(2)) : 0,
        liczbaBrakow: item.liczbaBrakow,
      }))
      .sort((a, b) => b.ilosc - a.ilosc);

    res.json({
      data: data.toISOString().slice(0, 10),
      dane,
    });
  } catch {
    res.status(500).json({ wiadomosc: 'Nie udalo sie pobrac raportu dziennego.' });
  }
}
