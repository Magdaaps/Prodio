import { PrismaClient } from '@prisma/client';
import type { RequestHandler } from 'express';

const prisma = new PrismaClient() as any;

type TypAnalizy = 'WEJSCIE' | 'WYJSCIE' | 'CZAS_PRACY';

function parseIntValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseDateValue(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseDecimalValue(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const parsed = Number(String(value).replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
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

function startOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

function endOfMonth(year: number, month: number) {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function diffMinutes(start: Date, stop: Date | null | undefined) {
  if (!stop) {
    return 0;
  }

  return Math.max(0, Math.round((stop.getTime() - start.getTime()) / 60000));
}

function diffSeconds(start: Date, stop: Date | null | undefined) {
  if (!stop) {
    return 0;
  }

  return Math.max(0, Math.round((stop.getTime() - start.getTime()) / 1000));
}

function overlapMinutes(
  rangeStart: Date,
  rangeEnd: Date | null | undefined,
  pauseStart: Date,
  pauseEnd: Date | null | undefined
) {
  if (!rangeEnd || !pauseEnd) {
    return 0;
  }

  const start = Math.max(rangeStart.getTime(), pauseStart.getTime());
  const end = Math.min(rangeEnd.getTime(), pauseEnd.getTime());

  if (end <= start) {
    return 0;
  }

  return Math.round((end - start) / 60000);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date | null | undefined) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatDurationMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const mins = (safe % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

function formatDurationSeconds(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((safe % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const secs = (safe % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
}

function normalizeMonthParams(rokValue: unknown, miesiacValue: unknown) {
  const now = new Date();
  const rok = parseIntValue(rokValue) ?? now.getFullYear();
  const miesiac = parseIntValue(miesiacValue) ?? now.getMonth() + 1;
  return {
    rok,
    miesiac: Math.min(12, Math.max(1, miesiac)),
  };
}

function getPolishWeekday(date: Date) {
  return new Intl.DateTimeFormat('pl-PL', { weekday: 'long' }).format(date);
}

export const pobierzRejestracje: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)));
    const pracownikId = parseIntValue(req.query.pracownikId);
    const dataOd = parseDateValue(req.query.dataOd);
    const dataDo = parseDateValue(req.query.dataDo);
    const zmiana = req.query.zmiana ? String(req.query.zmiana) : undefined;

    const where: Record<string, unknown> = {};

    if (pracownikId !== undefined) {
      where.pracownikId = pracownikId;
    }

    if (zmiana) {
      where.zmiana = zmiana;
    }

    if (dataOd || dataDo) {
      const wejscie: Record<string, Date> = {};
      if (dataOd) wejscie.gte = startOfDay(dataOd);
      if (dataDo) wejscie.lte = endOfDay(dataDo);
      where.wejscie = wejscie;
    }

    const [rejestracje, total] = await Promise.all([
      prisma.rejestraCzasPracy.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ wejscie: 'desc' }, { id: 'desc' }],
        include: {
          pracownik: {
            select: {
              id: true,
              imie: true,
              nazwisko: true,
              aktywny: true,
            },
          },
        },
      }),
      prisma.rejestraCzasPracy.count({ where }),
    ]);

    const pracownikIds = [...new Set(rejestracje.map((item: any) => item.pracownikId))];
    let zakresStart: Date | null = null;
    let zakresStop: Date | null = null;

    for (const item of rejestracje as any[]) {
      if (!zakresStart || item.wejscie < zakresStart) {
        zakresStart = item.wejscie;
      }

      const candidate = item.wyjscie ?? item.wejscie;
      if (!zakresStop || candidate > zakresStop) {
        zakresStop = candidate;
      }
    }

    const pauzy =
      pracownikIds.length > 0 && zakresStart && zakresStop
        ? await prisma.pauza.findMany({
            where: {
              pracownikId: { in: pracownikIds },
              czasStart: { lte: zakresStop },
              OR: [{ czasStop: null }, { czasStop: { gte: zakresStart } }],
            },
            select: {
              id: true,
              pracownikId: true,
              czasStart: true,
              czasStop: true,
            },
          })
        : [];

    const mapaPauz = new Map<number, any[]>();
    for (const pauza of pauzy) {
      const lista = mapaPauz.get(pauza.pracownikId) ?? [];
      lista.push(pauza);
      mapaPauz.set(pauza.pracownikId, lista);
    }

    const dane = rejestracje.map((rejestracja: any) => {
      const czasPracyMinuty = diffMinutes(rejestracja.wejscie, rejestracja.wyjscie);
      const powiazanePauzy = mapaPauz.get(rejestracja.pracownikId) ?? [];
      const czasPauzyMinuty = powiazanePauzy.reduce(
        (sum, pauza) =>
          sum +
          overlapMinutes(
            rejestracja.wejscie,
            rejestracja.wyjscie,
            pauza.czasStart,
            pauza.czasStop
          ),
        0
      );
      const czasBezPauzMinuty = Math.max(0, czasPracyMinuty - czasPauzyMinuty);
      const nadgodzinyMinuty = Math.round(parseDecimalValue(rejestracja.nadgodziny) * 60);
      const pauzaProcent =
        czasPracyMinuty > 0 ? Number(((czasPauzyMinuty / czasPracyMinuty) * 100).toFixed(2)) : 0;

      return {
        id: rejestracja.id,
        pracownikId: rejestracja.pracownikId,
        pracownik: rejestracja.pracownik,
        wejscie: rejestracja.wejscie,
        wyjscie: rejestracja.wyjscie,
        wejscieWyglad: rejestracja.wejscieWyglad,
        wyjscieWyglad: rejestracja.wyjscieWyglad,
        zmiana: rejestracja.zmiana,
        nadgodziny: parseDecimalValue(rejestracja.nadgodziny),
        nadgodzinyMinuty,
        czasPracyMinuty,
        czasBezPauzMinuty,
        czasPauzyMinuty,
        pauzaProcent,
      };
    });

    res.json({
      dane,
      total,
      strona: page,
      limit,
    });
  } catch {
    res.status(500).json({ wiadomosc: 'Nie udalo sie pobrac rejestracji czasu pracy.' });
  }
};

export const pobierzPauzy: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)));
    const pracownikId = parseIntValue(req.query.pracownikId);
    const typPauzy = req.query.typPauzy ? String(req.query.typPauzy) : undefined;
    const dataOd = parseDateValue(req.query.dataOd);
    const dataDo = parseDateValue(req.query.dataDo);

    const where: Record<string, unknown> = {};

    if (pracownikId !== undefined) {
      where.pracownikId = pracownikId;
    }

    if (typPauzy) {
      where.typPauzy = typPauzy;
    }

    if (dataOd || dataDo) {
      const czasStart: Record<string, Date> = {};
      if (dataOd) czasStart.gte = startOfDay(dataOd);
      if (dataDo) czasStart.lte = endOfDay(dataDo);
      where.czasStart = czasStart;
    }

    const [pauzy, total] = await Promise.all([
      prisma.pauza.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ czasStart: 'desc' }, { id: 'desc' }],
        include: {
          pracownik: {
            select: {
              id: true,
              imie: true,
              nazwisko: true,
              aktywny: true,
            },
          },
        },
      }),
      prisma.pauza.count({ where }),
    ]);

    const dane = pauzy.map((pauza: any) => {
      const czasPauzySekundy = diffSeconds(pauza.czasStart, pauza.czasStop);
      return {
        id: pauza.id,
        pracownikId: pauza.pracownikId,
        pracownik: pauza.pracownik,
        powod: pauza.powod,
        typPauzy: pauza.typPauzy,
        czasStart: pauza.czasStart,
        czasStop: pauza.czasStop,
        geolokalizacja: pauza.geolokalizacja,
        ip: pauza.ip,
        czasPauzySekundy,
        czasPauzyMinuty: Math.round(czasPauzySekundy / 60),
      };
    });

    res.json({
      dane,
      total,
      strona: page,
      limit,
    });
  } catch {
    res.status(500).json({ wiadomosc: 'Nie udalo sie pobrac historii pauz.' });
  }
};

export const pobierzDniWolne: RequestHandler = async (req, res) => {
  try {
    const rok = parseIntValue(req.query.rok);
    const miesiac = parseIntValue(req.query.miesiac);
    const where: Record<string, unknown> = {};

    if (rok && miesiac) {
      where.data = {
        gte: startOfMonth(rok, miesiac),
        lte: endOfMonth(rok, miesiac),
      };
    } else if (rok) {
      where.data = {
        gte: new Date(rok, 0, 1, 0, 0, 0, 0),
        lte: new Date(rok, 11, 31, 23, 59, 59, 999),
      };
    }

    const dniWolne = await prisma.dzienWolny.findMany({
      where,
      include: {
        pracownik: {
          select: {
            id: true,
            imie: true,
            nazwisko: true,
            aktywny: true,
          },
        },
      },
      orderBy: [{ data: 'asc' }, { pracownik: { nazwisko: 'asc' } }, { pracownik: { imie: 'asc' } }],
    });

    res.json(
      dniWolne.map((dzien: any) => ({
        id: dzien.id,
        pracownikId: dzien.pracownikId,
        pracownik: dzien.pracownik,
        data: dzien.data,
        dataStr: toDateKey(dzien.data),
        dzienTygodnia: getPolishWeekday(dzien.data),
        przyczyna: dzien.przyczyna,
        zatwierdzony: dzien.zatwierdzony,
      }))
    );
  } catch {
    res.status(500).json({ wiadomosc: 'Nie udalo sie pobrac dni wolnych.' });
  }
};

export const dodajDzienWolny: RequestHandler = async (req, res) => {
  try {
    const pracownikId = parseIntValue(req.body.pracownikId);
    const data = parseDateValue(req.body.data);
    const przyczyna = req.body.przyczyna ? String(req.body.przyczyna) : null;

    if (!pracownikId) {
      res.status(400).json({ wiadomosc: 'Pole pracownikId jest wymagane.' });
      return;
    }

    if (!data) {
      res.status(400).json({ wiadomosc: 'Pole data jest wymagane.' });
      return;
    }

    const pracownik = await prisma.pracownik.findUnique({
      where: { id: pracownikId },
      select: { id: true, imie: true, nazwisko: true, aktywny: true },
    });

    if (!pracownik) {
      res.status(404).json({ wiadomosc: 'Pracownik nie istnieje.' });
      return;
    }

    const rekord = await prisma.dzienWolny.create({
      data: {
        pracownikId,
        data: startOfDay(data),
        przyczyna,
      },
      include: {
        pracownik: {
          select: { id: true, imie: true, nazwisko: true, aktywny: true },
        },
      },
    });

    res.status(201).json({
      id: rekord.id,
      pracownikId: rekord.pracownikId,
      pracownik: rekord.pracownik,
      data: rekord.data,
      dataStr: toDateKey(rekord.data),
      przyczyna: rekord.przyczyna,
      zatwierdzony: rekord.zatwierdzony,
    });
  } catch {
    res.status(500).json({ wiadomosc: 'Nie udalo sie dodac dnia wolnego.' });
  }
};

export const usunDzienWolny: RequestHandler = async (req, res) => {
  try {
    const id = parseIntValue(req.params.id);

    if (!id) {
      res.status(400).json({ wiadomosc: 'Nieprawidlowe id dnia wolnego.' });
      return;
    }

    await prisma.dzienWolny.delete({ where: { id } });
    res.status(200).json({ wiadomosc: 'Dzien wolny zostal usuniety.' });
  } catch {
    res.status(500).json({ wiadomosc: 'Nie udalo sie usunac dnia wolnego.' });
  }
};

export const pobierzKartePracy: RequestHandler = async (req, res) => {
  try {
    const pracownikId = parseIntValue(req.query.pracownikId);
    const { rok, miesiac } = normalizeMonthParams(req.query.rok, req.query.miesiac);

    if (!pracownikId) {
      res.status(400).json({ wiadomosc: 'Parametr pracownikId jest wymagany.' });
      return;
    }

    const pracownik = await prisma.pracownik.findUnique({
      where: { id: pracownikId },
      select: {
        id: true,
        imie: true,
        nazwisko: true,
        stanowisko: true,
        aktywny: true,
      },
    });

    if (!pracownik) {
      res.status(404).json({ wiadomosc: 'Pracownik nie istnieje.' });
      return;
    }

    const dataOd = startOfMonth(rok, miesiac);
    const dataDo = endOfMonth(rok, miesiac);
    const [rejestracje, dniWolne] = await Promise.all([
      prisma.rejestraCzasPracy.findMany({
        where: {
          pracownikId,
          wejscie: {
            gte: dataOd,
            lte: dataDo,
          },
        },
        orderBy: [{ wejscie: 'asc' }, { id: 'asc' }],
      }),
      prisma.dzienWolny.findMany({
        where: {
          pracownikId,
          data: {
            gte: dataOd,
            lte: dataDo,
          },
        },
      }),
    ]);

    const dniWolneSet = new Set(dniWolne.map((item: any) => toDateKey(item.data)));
    const agregaty = new Map<
      string,
      {
        wejscie: Date | null;
        wejscieWyglad: Date | null;
        wyjscie: Date | null;
        wyjscieWyglad: Date | null;
        czasPracyMinuty: number;
        czasWygladzonyMinuty: number;
        nadgodziny: number;
        zmiana: string | null;
      }
    >();

    for (const wpis of rejestracje) {
      const klucz = toDateKey(wpis.wejscie);
      const aktualny = agregaty.get(klucz) ?? {
        wejscie: null,
        wejscieWyglad: null,
        wyjscie: null,
        wyjscieWyglad: null,
        czasPracyMinuty: 0,
        czasWygladzonyMinuty: 0,
        nadgodziny: 0,
        zmiana: null,
      };

      if (!aktualny.wejscie || wpis.wejscie < aktualny.wejscie) {
        aktualny.wejscie = wpis.wejscie;
      }

      if (wpis.wejscieWyglad && (!aktualny.wejscieWyglad || wpis.wejscieWyglad < aktualny.wejscieWyglad)) {
        aktualny.wejscieWyglad = wpis.wejscieWyglad;
      }

      if (wpis.wyjscie && (!aktualny.wyjscie || wpis.wyjscie > aktualny.wyjscie)) {
        aktualny.wyjscie = wpis.wyjscie;
      }

      if (wpis.wyjscieWyglad && (!aktualny.wyjscieWyglad || wpis.wyjscieWyglad > aktualny.wyjscieWyglad)) {
        aktualny.wyjscieWyglad = wpis.wyjscieWyglad;
      }

      aktualny.czasPracyMinuty += diffMinutes(wpis.wejscie, wpis.wyjscie);
      aktualny.czasWygladzonyMinuty += diffMinutes(wpis.wejscieWyglad ?? wpis.wejscie, wpis.wyjscieWyglad ?? wpis.wyjscie);
      aktualny.nadgodziny += parseDecimalValue(wpis.nadgodziny);
      aktualny.zmiana = aktualny.zmiana ?? wpis.zmiana ?? null;
      agregaty.set(klucz, aktualny);
    }

    const liczbaDni = getDaysInMonth(rok, miesiac);
    const dni = Array.from({ length: liczbaDni }, (_, index) => {
      const data = new Date(rok, miesiac - 1, index + 1);
      const klucz = toDateKey(data);
      const agregat = agregaty.get(klucz);
      const nadgodzinyMinuty = Math.round((agregat?.nadgodziny ?? 0) * 60);

      return {
        data: klucz,
        dzien: index + 1,
        wejscie: agregat?.wejscie ?? null,
        wejscieWyglad: agregat?.wejscieWyglad ?? null,
        wyjscie: agregat?.wyjscie ?? null,
        wyjscieWyglad: agregat?.wyjscieWyglad ?? null,
        czasPracyMinuty: agregat?.czasPracyMinuty ?? 0,
        czasWygladzonyMinuty: agregat?.czasWygladzonyMinuty ?? 0,
        nadgodziny: Number((agregat?.nadgodziny ?? 0).toFixed(2)),
        nadgodzinyMinuty,
        zmiana: agregat?.zmiana ?? null,
        dzienWolny: dniWolneSet.has(klucz),
      };
    });

    const sumy = dni.reduce(
      (acc, dzien) => {
        acc.czasPracyMinuty += dzien.czasPracyMinuty;
        acc.czasWygladzonyMinuty += dzien.czasWygladzonyMinuty;
        acc.nadgodziny += dzien.nadgodziny;
        acc.nadgodzinyMinuty += dzien.nadgodzinyMinuty;
        acc.liczbaDniWolnych += dzien.dzienWolny ? 1 : 0;
        return acc;
      },
      {
        czasPracyMinuty: 0,
        czasWygladzonyMinuty: 0,
        nadgodziny: 0,
        nadgodzinyMinuty: 0,
        liczbaDniWolnych: 0,
      }
    );

    res.json({
      pracownik,
      dni,
      sumy,
      rok,
      miesiac,
    });
  } catch {
    res.status(500).json({ wiadomosc: 'Nie udalo sie pobrac karty pracy.' });
  }
};

export const pobierzKalendarz: RequestHandler = async (req, res) => {
  try {
    const { rok, miesiac } = normalizeMonthParams(req.query.rok, req.query.miesiac);
    const typAnalizy = (req.query.typAnalizy ? String(req.query.typAnalizy) : 'CZAS_PRACY') as TypAnalizy;

    if (!['WEJSCIE', 'WYJSCIE', 'CZAS_PRACY'].includes(typAnalizy)) {
      res.status(400).json({ wiadomosc: 'Nieprawidlowy typAnalizy.' });
      return;
    }

    const dataOd = startOfMonth(rok, miesiac);
    const dataDo = endOfMonth(rok, miesiac);
    const pracownicy = await prisma.pracownik.findMany({
      where: { aktywny: true },
      orderBy: [{ nazwisko: 'asc' }, { imie: 'asc' }],
      select: {
        id: true,
        imie: true,
        nazwisko: true,
        aktywny: true,
      },
    });

    const rejestracje = await prisma.rejestraCzasPracy.findMany({
      where: {
        pracownikId: { in: pracownicy.map((pracownik: any) => pracownik.id) },
        wejscie: {
          gte: dataOd,
          lte: dataDo,
        },
      },
      orderBy: [{ wejscie: 'asc' }, { id: 'asc' }],
    });

    const agregaty = new Map<
      string,
      {
        pierwszeWejscie: Date | null;
        ostatnieWyjscie: Date | null;
        czasPracySekundy: number;
      }
    >();

    for (const wpis of rejestracje) {
      const dzien = wpis.wejscie.getDate();
      const klucz = `${wpis.pracownikId}-${dzien}`;
      const aktualny = agregaty.get(klucz) ?? {
        pierwszeWejscie: null,
        ostatnieWyjscie: null,
        czasPracySekundy: 0,
      };

      if (!aktualny.pierwszeWejscie || wpis.wejscie < aktualny.pierwszeWejscie) {
        aktualny.pierwszeWejscie = wpis.wejscie;
      }

      if (wpis.wyjscie && (!aktualny.ostatnieWyjscie || wpis.wyjscie > aktualny.ostatnieWyjscie)) {
        aktualny.ostatnieWyjscie = wpis.wyjscie;
      }

      aktualny.czasPracySekundy += diffSeconds(wpis.wejscie, wpis.wyjscie);
      agregaty.set(klucz, aktualny);
    }

    const liczbaDni = getDaysInMonth(rok, miesiac);
    const dni = Array.from({ length: liczbaDni }, (_, index) => index + 1);
    const macierz = Object.fromEntries(
      pracownicy.map((pracownik: any) => {
        const rekordDni = Object.fromEntries(
          dni.map((dzien) => {
            const agregat = agregaty.get(`${pracownik.id}-${dzien}`);
            let wartosc = '--';

            if (agregat) {
              if (typAnalizy === 'WEJSCIE') {
                wartosc = formatTime(agregat.pierwszeWejscie) ?? '--';
              } else if (typAnalizy === 'WYJSCIE') {
                wartosc = formatTime(agregat.ostatnieWyjscie) ?? '--';
              } else {
                wartosc = formatDurationSeconds(agregat.czasPracySekundy);
              }
            }

            return [dzien, wartosc];
          })
        );

        return [pracownik.id, rekordDni];
      })
    );

    res.json({
      pracownicy,
      dni,
      macierz,
      rok,
      miesiac,
      typAnalizy,
    });
  } catch {
    res.status(500).json({ wiadomosc: 'Nie udalo sie pobrac kalendarza wejsc i wyjsc.' });
  }
};
