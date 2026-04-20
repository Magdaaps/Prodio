import { Prisma, PrismaClient, StatusZamowieniaDostawcy } from '@prisma/client';
import type { RequestHandler } from 'express';

const prisma = new PrismaClient();

type TypMagazynu = 'SUROWCE' | 'PRODUKTY';

function parseIntValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseNumberValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseDateValue(value: unknown, endOfDay = false): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseNumberValue(value) ?? 0;
  if (typeof value === 'object' && value !== null && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  return Number(value) || 0;
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ` ${currency}`;
}

async function wygenerujNumerDokumentu(prefix: string) {
  const year = new Date().getFullYear();
  const prefixWithYear = `${prefix}/${year}/`;
  const count = await prisma.transakcjaMagazynowa.count({
    where: { numer: { startsWith: prefixWithYear } },
  });
  return `${prefixWithYear}${String(count + 1).padStart(4, '0')}`;
}

async function wygenerujNumerZamowieniaDostawcy() {
  const year = new Date().getFullYear();
  const prefixWithYear = `ZD/${year}/`;
  const count = await prisma.zamowienieDostawcy.count({
    where: { numer: { startsWith: prefixWithYear } },
  });
  return `${prefixWithYear}${String(count + 1).padStart(4, '0')}`;
}

async function pobierzStanSurowcaWMagazynie(magazynId: number, surowiecId: number) {
  const transakcje = await prisma.transakcjaMagazynowa.findMany({
    where: {
      surowiecId,
      OR: [{ magazynId }, { magazynDocelId: magazynId }],
    },
    select: {
      typ: true,
      ilosc: true,
      magazynId: true,
      magazynDocelId: true,
    },
  });

  return transakcje.reduce((sum, transakcja) => {
    const ilosc = toNumber(transakcja.ilosc);

    if (transakcja.typ === 'PRZYJECIE' && transakcja.magazynId === magazynId) return sum + ilosc;
    if (transakcja.typ === 'WYDANIE' && transakcja.magazynId === magazynId) return sum - ilosc;
    if (transakcja.typ === 'KOREKTA' && transakcja.magazynId === magazynId) return sum + ilosc;
    if (transakcja.typ === 'PRZENIESIENIE' && transakcja.magazynId === magazynId) return sum - ilosc;
    if (transakcja.typ === 'PRZENIESIENIE' && transakcja.magazynDocelId === magazynId) return sum + ilosc;

    return sum;
  }, 0);
}

async function pobierzMapeZlecen() {
  const zlecenia = await prisma.zlecenieProdukcyjne.findMany({
    select: {
      id: true,
      numer: true,
      zamowienieId: true,
    },
  });

  return new Map(zlecenia.map((zlecenie) => [zlecenie.id, zlecenie]));
}

function pobierzParametryPaginacji(req: Parameters<RequestHandler>[0]) {
  const page = Math.max(1, parseIntValue(req.query.page) ?? 1);
  const limit = Math.min(100, Math.max(1, parseIntValue(req.query.limit) ?? 30));
  return { page, limit, skip: (page - 1) * limit };
}

function pobierzFiltrDat(req: Parameters<RequestHandler>[0]) {
  const dataOd = parseDateValue(req.query.dataOd);
  const dataDo = parseDateValue(req.query.dataDo, true);
  if (!dataOd && !dataDo) return undefined;

  return {
    gte: dataOd,
    lte: dataDo,
  };
}

export const pobierzStanyMagazynowe: RequestHandler = async (req, res) => {
  try {
    const typ = String(req.query.typ ?? 'SUROWCE') as TypMagazynu;
    const magazynId = parseIntValue(req.query.magazynId);

    if (typ === 'PRODUKTY') {
      res.json({ sukces: true, dane: [] });
      return;
    }

    const surowce = await prisma.surowiec.findMany({
      orderBy: { nazwa: 'asc' },
    });

    const whereTransakcji = magazynId
      ? { OR: [{ magazynId }, { magazynDocelId: magazynId }] }
      : undefined;

    const [
      transakcje,
      aktywneZlecenia,
      zamowieniaWRealizacji,
      aktywneZamowieniaDostawcow,
    ] = await Promise.all([
      prisma.transakcjaMagazynowa.findMany({
        where: whereTransakcji,
        select: {
          typ: true,
          ilosc: true,
          cena: true,
          surowiecId: true,
          magazynId: true,
          magazynDocelId: true,
        },
      }),
      prisma.zlecenieProdukcyjne.findMany({
        where: { aktywne: true, status: { not: 'GOTOWE' } },
        select: {
          iloscPlan: true,
          zamowienie: {
            select: {
              pozycje: {
                select: {
                  ilosc: true,
                  produkt: {
                    select: {
                      bomSurowcow: {
                        select: {
                          surowiecId: true,
                          ilosc: true,
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
      prisma.zamowienie.findMany({
        where: { status: 'W_REALIZACJI' },
        select: {
          pozycje: {
            select: {
              ilosc: true,
              produkt: {
                select: {
                  bomSurowcow: {
                    select: {
                      surowiecId: true,
                      ilosc: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.zamowienieDostawcy.findMany({
        where: {
          status: {
            notIn: ['DOSTARCZONE', 'ANULOWANE'],
          },
        },
        select: {
          pozycje: {
            select: {
              surowiecId: true,
              ilosc: true,
            },
          },
        },
      }),
    ]);

    const mapaTransakcji = new Map<number, typeof transakcje>();
    for (const transakcja of transakcje) {
      const aktualne = mapaTransakcji.get(transakcja.surowiecId) ?? [];
      aktualne.push(transakcja);
      mapaTransakcji.set(transakcja.surowiecId, aktualne);
    }

    const mapaNaProdukcji = new Map<number, number>();
    for (const zlecenie of aktywneZlecenia) {
      for (const pozycja of zlecenie.zamowienie.pozycje) {
        for (const bom of pozycja.produkt.bomSurowcow) {
          const aktualne = mapaNaProdukcji.get(bom.surowiecId) ?? 0;
          mapaNaProdukcji.set(
            bom.surowiecId,
            aktualne + toNumber(bom.ilosc) * toNumber(zlecenie.iloscPlan)
          );
        }
      }
    }

    const mapaZapotrzebowania = new Map<number, number>();
    for (const zamowienie of zamowieniaWRealizacji) {
      for (const pozycja of zamowienie.pozycje) {
        for (const bom of pozycja.produkt.bomSurowcow) {
          const aktualne = mapaZapotrzebowania.get(bom.surowiecId) ?? 0;
          mapaZapotrzebowania.set(
            bom.surowiecId,
            aktualne + toNumber(bom.ilosc) * toNumber(pozycja.ilosc)
          );
        }
      }
    }

    const mapaZamowiono = new Map<number, number>();
    for (const zamowienie of aktywneZamowieniaDostawcow) {
      for (const pozycja of zamowienie.pozycje) {
        const aktualne = mapaZamowiono.get(pozycja.surowiecId) ?? 0;
        mapaZamowiono.set(pozycja.surowiecId, aktualne + toNumber(pozycja.ilosc));
      }
    }

    const dane = surowce.map((surowiec) => {
      const wpisy = mapaTransakcji.get(surowiec.id) ?? [];
      let naStan = 0;
      let sumaCenPrzyjec = 0;
      let liczbaCenPrzyjec = 0;

      for (const wpis of wpisy) {
        const ilosc = toNumber(wpis.ilosc);

        if (wpis.typ === 'PRZYJECIE') {
          naStan += ilosc;
          if (wpis.cena !== null && wpis.cena !== undefined) {
            sumaCenPrzyjec += toNumber(wpis.cena);
            liczbaCenPrzyjec += 1;
          }
          continue;
        }

        if (wpis.typ === 'WYDANIE') {
          naStan -= ilosc;
          continue;
        }

        if (wpis.typ === 'KOREKTA') {
          naStan += ilosc;
          continue;
        }

        if (wpis.typ === 'PRZENIESIENIE') {
          if (magazynId) {
            if (wpis.magazynId === magazynId) naStan -= ilosc;
            if (wpis.magazynDocelId === magazynId) naStan += ilosc;
          } else {
            naStan += 0;
          }
        }
      }

      const sredniaCena = liczbaCenPrzyjec > 0 ? sumaCenPrzyjec / liczbaCenPrzyjec : toNumber(surowiec.cena);
      const wartoscZapasow = naStan * sredniaCena;

      return {
        id: surowiec.id,
        nazwa: surowiec.nazwa,
        jednostka: surowiec.jednostka,
        waluta: surowiec.waluta,
        cena: toNumber(surowiec.cena),
        naStan,
        naProdukcji: mapaNaProdukcji.get(surowiec.id) ?? 0,
        zapotrzebowanie: mapaZapotrzebowania.get(surowiec.id) ?? 0,
        zamowiono: mapaZamowiono.get(surowiec.id) ?? 0,
        sredniaCena,
        wartoscZapasow,
        aktywny: surowiec.aktywny,
      };
    });

    res.json({ sukces: true, dane });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac stanow magazynowych.' });
  }
};

export const pobierzMagazyny: RequestHandler = async (_req, res) => {
  try {
    const magazyny = await prisma.magazyn.findMany({
      orderBy: { nazwa: 'asc' },
      include: {
        _count: {
          select: {
            transakcje: true,
            transakcjeDocelowe: true,
          },
        },
      },
    });

    res.json({
      sukces: true,
      dane: magazyny.map((magazyn) => ({
        id: magazyn.id,
        nazwa: magazyn.nazwa,
        aktywny: magazyn.aktywny,
        liczbaTransakcji: magazyn._count.transakcje + magazyn._count.transakcjeDocelowe,
      })),
    });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac magazynow.' });
  }
};

export const pobierzDostawcowMagazynu: RequestHandler = async (_req, res) => {
  try {
    const dostawcy = await prisma.dostawca.findMany({
      where: { aktywny: true },
      orderBy: { nazwa: 'asc' },
      select: {
        id: true,
        nazwa: true,
      },
    });

    res.json({ sukces: true, dane: dostawcy });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac dostawcow.' });
  }
};

export const dodajMagazyn: RequestHandler = async (req, res) => {
  try {
    const nazwa = String(req.body.nazwa ?? '').trim();
    if (!nazwa) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nazwa magazynu jest wymagana.' });
      return;
    }

    const magazyn = await prisma.magazyn.create({ data: { nazwa } });
    res.status(201).json({ sukces: true, dane: magazyn });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie dodac magazynu.' });
  }
};

export const zaktualizujMagazyn: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data: { nazwa?: string; aktywny?: boolean } = {};

    if (req.body.nazwa !== undefined) {
      const nazwa = String(req.body.nazwa).trim();
      if (!nazwa) {
        res.status(400).json({ sukces: false, wiadomosc: 'Nazwa magazynu nie moze byc pusta.' });
        return;
      }
      data.nazwa = nazwa;
    }

    if (req.body.aktywny !== undefined) {
      data.aktywny = Boolean(req.body.aktywny);
    }

    const magazyn = await prisma.magazyn.update({
      where: { id },
      data,
    });

    res.json({ sukces: true, dane: magazyn });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie zapisac magazynu.' });
  }
};

export const usunMagazyn: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [countSource, countTarget] = await Promise.all([
      prisma.transakcjaMagazynowa.count({ where: { magazynId: id } }),
      prisma.transakcjaMagazynowa.count({ where: { magazynDocelId: id } }),
    ]);

    if (countSource + countTarget > 0) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nie mozna usunac magazynu z transakcjami.' });
      return;
    }

    await prisma.magazyn.delete({ where: { id } });
    res.json({ sukces: true, wiadomosc: 'Magazyn zostal usuniety.' });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie usunac magazynu.' });
  }
};

export const pobierzPrzyjecia: RequestHandler = async (req, res) => {
  try {
    const { page, limit, skip } = pobierzParametryPaginacji(req);
    const magazynId = parseIntValue(req.query.magazynId);
    const utworzonyW = pobierzFiltrDat(req);

    const where = {
      typ: 'PRZYJECIE' as const,
      magazynId,
      utworzonyW,
    };

    const [dane, total] = await Promise.all([
      prisma.transakcjaMagazynowa.findMany({
        where,
        skip,
        take: limit,
        orderBy: { utworzonyW: 'desc' },
        include: {
          magazyn: true,
          surowiec: true,
        },
      }),
      prisma.transakcjaMagazynowa.count({ where }),
    ]);

    res.json({
      sukces: true,
      dane: dane.map((item) => ({
        id: item.id,
        numer: item.numer,
        magazyn: item.magazyn,
        surowiec: item.surowiec,
        ilosc: toNumber(item.ilosc),
        cena: item.cena !== null ? toNumber(item.cena) : null,
        uwagi: item.uwagi,
        zatwierdzone: item.zatwierdzone,
        utworzonyW: item.utworzonyW,
      })),
      total,
      page,
      limit,
    });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac przyjec.' });
  }
};

export const dodajPrzyjecie: RequestHandler = async (req, res) => {
  try {
    const magazynId = parseIntValue(req.body.magazynId);
    const surowiecId = parseIntValue(req.body.surowiecId);
    const ilosc = parseNumberValue(req.body.ilosc);
    const cena = parseNumberValue(req.body.cena);

    if (!magazynId || !surowiecId || !ilosc || ilosc <= 0) {
      res.status(400).json({ sukces: false, wiadomosc: 'Magazyn, surowiec i dodatnia ilosc sa wymagane.' });
      return;
    }

    const transakcja = await prisma.transakcjaMagazynowa.create({
      data: {
        typ: 'PRZYJECIE',
        magazynId,
        surowiecId,
        ilosc,
        cena,
        uwagi: req.body.uwagi ? String(req.body.uwagi) : undefined,
        numer: req.body.numer ? String(req.body.numer) : await wygenerujNumerDokumentu('PZ'),
        utworzylId: req.uzytkownik?.id,
      },
    });

    res.status(201).json({ sukces: true, dane: transakcja });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie dodac przyjecia.' });
  }
};

export const pobierzWydania: RequestHandler = async (req, res) => {
  try {
    const { page, limit, skip } = pobierzParametryPaginacji(req);
    const magazynId = parseIntValue(req.query.magazynId);
    const zlecenieId = parseIntValue(req.query.zlecenieId);
    const utworzonyW = pobierzFiltrDat(req);

    const where = {
      typ: 'WYDANIE' as const,
      magazynId,
      zlecenieId,
      utworzonyW,
    };

    const [dane, total, mapaZlecen] = await Promise.all([
      prisma.transakcjaMagazynowa.findMany({
        where,
        skip,
        take: limit,
        orderBy: { utworzonyW: 'desc' },
        include: {
          magazyn: true,
          surowiec: true,
        },
      }),
      prisma.transakcjaMagazynowa.count({ where }),
      pobierzMapeZlecen(),
    ]);

    res.json({
      sukces: true,
      dane: dane.map((item) => ({
        id: item.id,
        numer: item.numer,
        magazyn: item.magazyn,
        surowiec: item.surowiec,
        ilosc: toNumber(item.ilosc),
        zlecenieId: item.zlecenieId,
        zlecenie: item.zlecenieId ? mapaZlecen.get(item.zlecenieId) ?? null : null,
        uwagi: item.uwagi,
        utworzonyW: item.utworzonyW,
      })),
      total,
      page,
      limit,
    });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac wydan.' });
  }
};

export const dodajWydanie: RequestHandler = async (req, res) => {
  try {
    const magazynId = parseIntValue(req.body.magazynId);
    const surowiecId = parseIntValue(req.body.surowiecId);
    const zlecenieId = parseIntValue(req.body.zlecenieId);
    const ilosc = parseNumberValue(req.body.ilosc);

    if (!magazynId || !surowiecId || !ilosc || ilosc <= 0) {
      res.status(400).json({ sukces: false, wiadomosc: 'Magazyn, surowiec i dodatnia ilosc sa wymagane.' });
      return;
    }

    const stan = await pobierzStanSurowcaWMagazynie(magazynId, surowiecId);
    if (stan < ilosc) {
      res.status(400).json({ sukces: false, wiadomosc: 'Niewystarczajacy stan' });
      return;
    }

    const transakcja = await prisma.transakcjaMagazynowa.create({
      data: {
        typ: 'WYDANIE',
        magazynId,
        surowiecId,
        zlecenieId,
        ilosc,
        uwagi: req.body.uwagi ? String(req.body.uwagi) : undefined,
        numer: req.body.numer ? String(req.body.numer) : await wygenerujNumerDokumentu('WZ'),
        utworzylId: req.uzytkownik?.id,
      },
    });

    res.status(201).json({ sukces: true, dane: transakcja });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie dodac wydania.' });
  }
};

export const pobierzKorekty: RequestHandler = async (req, res) => {
  try {
    const { page, limit, skip } = pobierzParametryPaginacji(req);
    const magazynId = parseIntValue(req.query.magazynId);
    const utworzonyW = pobierzFiltrDat(req);

    const where = {
      typ: 'KOREKTA' as const,
      magazynId,
      utworzonyW,
    };

    const [dane, total] = await Promise.all([
      prisma.transakcjaMagazynowa.findMany({
        where,
        skip,
        take: limit,
        orderBy: { utworzonyW: 'desc' },
        include: {
          magazyn: true,
          surowiec: true,
        },
      }),
      prisma.transakcjaMagazynowa.count({ where }),
    ]);

    res.json({
      sukces: true,
      dane: dane.map((item) => ({
        id: item.id,
        numer: item.numer,
        magazyn: item.magazyn,
        surowiec: item.surowiec,
        ilosc: toNumber(item.ilosc),
        uwagi: item.uwagi,
        utworzonyW: item.utworzonyW,
      })),
      total,
      page,
      limit,
    });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac korekt.' });
  }
};

export const dodajKorekte: RequestHandler = async (req, res) => {
  try {
    const magazynId = parseIntValue(req.body.magazynId);
    const surowiecId = parseIntValue(req.body.surowiecId);
    const ilosc = parseNumberValue(req.body.ilosc);
    const uwagi = String(req.body.uwagi ?? '').trim();

    if (!magazynId || !surowiecId || !ilosc || ilosc === 0) {
      res.status(400).json({ sukces: false, wiadomosc: 'Magazyn, surowiec i niezerowa ilosc sa wymagane.' });
      return;
    }

    if (!uwagi) {
      res.status(400).json({ sukces: false, wiadomosc: 'Powod korekty jest wymagany.' });
      return;
    }

    const transakcja = await prisma.transakcjaMagazynowa.create({
      data: {
        typ: 'KOREKTA',
        magazynId,
        surowiecId,
        ilosc,
        uwagi,
        numer: req.body.numer ? String(req.body.numer) : await wygenerujNumerDokumentu('KOR'),
        utworzylId: req.uzytkownik?.id,
      },
    });

    res.status(201).json({ sukces: true, dane: transakcja });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie dodac korekty.' });
  }
};

export const pobierzPrzeniesienia: RequestHandler = async (req, res) => {
  try {
    const { page, limit, skip } = pobierzParametryPaginacji(req);
    const magazynId = parseIntValue(req.query.magazynId);
    const utworzonyW = pobierzFiltrDat(req);

    const where = {
      typ: 'PRZENIESIENIE' as const,
      ...(magazynId ? { OR: [{ magazynId }, { magazynDocelId: magazynId }] } : {}),
      utworzonyW,
    };

    const [dane, total] = await Promise.all([
      prisma.transakcjaMagazynowa.findMany({
        where,
        skip,
        take: limit,
        orderBy: { utworzonyW: 'desc' },
        include: {
          magazyn: true,
          magazynDocelowy: true,
          surowiec: true,
        },
      }),
      prisma.transakcjaMagazynowa.count({ where }),
    ]);

    res.json({
      sukces: true,
      dane: dane.map((item) => ({
        id: item.id,
        numer: item.numer,
        magazyn: item.magazyn,
        magazynDocelowy: item.magazynDocelowy,
        surowiec: item.surowiec,
        ilosc: toNumber(item.ilosc),
        uwagi: item.uwagi,
        utworzonyW: item.utworzonyW,
      })),
      total,
      page,
      limit,
    });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac przeniesien.' });
  }
};

export const dodajPrzeniesienie: RequestHandler = async (req, res) => {
  try {
    const magazynId = parseIntValue(req.body.magazynId);
    const magazynDocelId = parseIntValue(req.body.magazynDocelId);
    const surowiecId = parseIntValue(req.body.surowiecId);
    const ilosc = parseNumberValue(req.body.ilosc);

    if (!magazynId || !magazynDocelId || !surowiecId || !ilosc || ilosc <= 0) {
      res.status(400).json({ sukces: false, wiadomosc: 'Wszystkie pola przeniesienia sa wymagane.' });
      return;
    }

    if (magazynId === magazynDocelId) {
      res.status(400).json({ sukces: false, wiadomosc: 'Magazyn zrodlowy i docelowy musza byc rozne.' });
      return;
    }

    const stan = await pobierzStanSurowcaWMagazynie(magazynId, surowiecId);
    if (stan < ilosc) {
      res.status(400).json({ sukces: false, wiadomosc: 'Niewystarczajacy stan' });
      return;
    }

    const transakcja = await prisma.transakcjaMagazynowa.create({
      data: {
        typ: 'PRZENIESIENIE',
        magazynId,
        magazynDocelId,
        surowiecId,
        ilosc,
        uwagi: req.body.uwagi ? String(req.body.uwagi) : undefined,
        numer: req.body.numer ? String(req.body.numer) : await wygenerujNumerDokumentu('PT'),
        utworzylId: req.uzytkownik?.id,
      },
    });

    res.status(201).json({ sukces: true, dane: transakcja });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie dodac przeniesienia.' });
  }
};

export const pobierzZamowieniaDostawcow: RequestHandler = async (req, res) => {
  try {
    const { page, limit, skip } = pobierzParametryPaginacji(req);
    const dostawcaId = parseIntValue(req.query.dostawcaId);
    const status = req.query.status ? (String(req.query.status) as StatusZamowieniaDostawcy) : undefined;

    const where: Prisma.ZamowienieDostawcyWhereInput = {
      dostawcaId,
      status,
    };

    const [dane, total] = await Promise.all([
      prisma.zamowienieDostawcy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataZlozenia: 'desc' },
        include: {
          dostawca: true,
          pozycje: {
            include: {
              surowiec: true,
            },
          },
        },
      }),
      prisma.zamowienieDostawcy.count({ where }),
    ]);

    res.json({
      sukces: true,
      dane: dane.map((item) => ({
        id: item.id,
        numer: item.numer,
        status: item.status,
        dataZlozenia: item.dataZlozenia,
        dataDostawy: item.dataDostawy,
        uwagi: item.uwagi,
        utworzonyW: item.utworzonyW,
        dostawca: item.dostawca,
        pozycje: item.pozycje.map((pozycja: (typeof item.pozycje)[number]) => ({
          id: pozycja.id,
          surowiecId: pozycja.surowiecId,
          ilosc: toNumber(pozycja.ilosc),
          cena: pozycja.cena !== null ? toNumber(pozycja.cena) : null,
          surowiec: pozycja.surowiec,
        })),
      })),
      total,
      page,
      limit,
    });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac zamowien dostawcow.' });
  }
};

export const zaktualizujStatusZamowieniaDostawcy: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const status = String(req.body.status ?? '') as StatusZamowieniaDostawcy;

    if (!status) {
      res.status(400).json({ sukces: false, wiadomosc: 'Status jest wymagany.' });
      return;
    }

    const zamowienie = await prisma.zamowienieDostawcy.update({
      where: { id },
      data: { status },
    });

    res.json({ sukces: true, dane: zamowienie });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie zaktualizowac statusu zamowienia.' });
  }
};

export const dodajZamowienieDostawcy: RequestHandler = async (req, res) => {
  try {
    const dostawcaId = parseIntValue(req.body.dostawcaId);
    const dataDostawy = req.body.dataDostawy ? new Date(String(req.body.dataDostawy)) : undefined;
    const pozycje = Array.isArray(req.body.pozycje) ? req.body.pozycje : [];

    if (!dostawcaId || pozycje.length === 0) {
      res.status(400).json({ sukces: false, wiadomosc: 'Dostawca i co najmniej jedna pozycja sa wymagane.' });
      return;
    }

    const pozycjeDoZapisu = pozycje
      .map((pozycja: { surowiecId?: unknown; ilosc?: unknown; cena?: unknown }) => ({
        surowiecId: parseIntValue(pozycja.surowiecId),
        ilosc: parseNumberValue(pozycja.ilosc),
        cena: parseNumberValue(pozycja.cena),
      }))
      .filter((pozycja: { surowiecId?: number; ilosc?: number; cena?: number }) => pozycja.surowiecId && pozycja.ilosc && pozycja.ilosc > 0);

    if (pozycjeDoZapisu.length === 0) {
      res.status(400).json({ sukces: false, wiadomosc: 'Dodaj przynajmniej jedna poprawna pozycje.' });
      return;
    }

    const zamowienie = await prisma.zamowienieDostawcy.create({
      data: {
        numer: await wygenerujNumerZamowieniaDostawcy(),
        dostawcaId,
        dataDostawy,
        uwagi: req.body.uwagi ? String(req.body.uwagi) : undefined,
        pozycje: {
          create: pozycjeDoZapisu.map((pozycja: { surowiecId?: number; ilosc?: number; cena?: number }) => ({
            surowiecId: pozycja.surowiecId as number,
            ilosc: pozycja.ilosc as number,
            cena: pozycja.cena,
          })),
        },
      },
      include: {
        dostawca: true,
        pozycje: {
          include: {
            surowiec: true,
          },
        },
      },
    });

    res.status(201).json({ sukces: true, dane: zamowienie });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie utworzyc zamowienia dostawcy.' });
  }
};

export const usunZamowienieDostawcy: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const zamowienie = await prisma.zamowienieDostawcy.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!zamowienie) {
      res.status(404).json({ sukces: false, wiadomosc: 'Zamowienie dostawcy nie istnieje.' });
      return;
    }

    if (zamowienie.status !== 'OCZEKUJE') {
      res.status(400).json({ sukces: false, wiadomosc: 'Usunac mozna tylko zamowienia w statusie OCZEKUJE.' });
      return;
    }

    await prisma.zamowienieDostawcy.delete({ where: { id } });
    res.json({ sukces: true, wiadomosc: 'Zamowienie dostawcy zostalo usuniete.' });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie usunac zamowienia dostawcy.' });
  }
};
