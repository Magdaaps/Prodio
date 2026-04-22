import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function wygenerujUnikalneIdProdioZamowienia(): Promise<string> {
  for (let proba = 0; proba < 20; proba += 1) {
    const kandydat = `ZAM-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`;
    const istniejace = await prisma.zamowienie.findUnique({
      where: { idProdio: kandydat },
      select: { id: true },
    });

    if (!istniejace) {
      return kandydat;
    }
  }

  throw new Error('Nie udalo sie wygenerowac unikalnego ID Prodio dla zamowienia');
}

export async function pobierzZamowienia(req: Request, res: Response): Promise<void> {
  try {
    const strona = Math.max(1, parseInt(String(req.query.strona ?? '1')));
    const iloscNaStrone = Math.min(100, parseInt(String(req.query.iloscNaStrone ?? '20')));
    const szukaj = String(req.query.szukaj ?? '');
    const status = req.query.status as string | undefined;
    const sortPole = String(req.query.sortPole ?? 'id');
    const sortKierunek = req.query.sortKierunek === 'asc' ? 'asc' : ('desc' as const);
    const where: Record<string, unknown> = {};
    if (szukaj) where.OR = [{ idProdio: { contains: szukaj, mode: 'insensitive' } }, { zewnetrznyNumer: { contains: szukaj, mode: 'insensitive' } }];
    if (status) where.status = status;
    const [dane, lacznie] = await Promise.all([prisma.zamowienie.findMany({ where, skip: (strona - 1) * iloscNaStrone, take: iloscNaStrone, orderBy: { [sortPole]: sortKierunek }, include: { klient: { select: { id: true, nazwa: true } }, pozycje: { include: { produkt: { select: { id: true, nazwa: true, idProdio: true, zdjecie: true } } } } } }), prisma.zamowienie.count({ where })]);
    res.json({ sukces: true, dane, lacznie, strona, iloscNaStrone });
  } catch (blad) {
    console.error('[pobierzZamowienia]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' });
  }
}

export async function pobierzLiczbeZaleglychZamowien(_req: Request, res: Response): Promise<void> {
  try {
    const dzisiaj = new Date();
    dzisiaj.setHours(0, 0, 0, 0);

    const liczba = await prisma.zamowienie.count({
      where: {
        oczekiwanaData: { lt: dzisiaj },
        status: { notIn: ['GOTOWE', 'WYDANE', 'ZAMKNIETE', 'ANULOWANE'] },
      },
    });

    res.json({ sukces: true, dane: { liczba } });
  } catch (blad) {
    console.error('[pobierzLiczbeZaleglychZamowien]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac liczby zaleglych zamowien.' });
  }
}

export async function pobierzZamowienieZgrupowane(req: Request, res: Response): Promise<void> {
  try {
    const numer = String(req.query.numer ?? '').trim();

    if (!numer) {
      res.status(400).json({ sukces: false, wiadomosc: 'Numer zewnetrzny jest wymagany.' });
      return;
    }

    const zamowienia = await prisma.zamowienie.findMany({
      where: {
        OR: [{ zewnetrznyNumer: numer }, { grupa: { numer } }],
      },
      orderBy: [{ utworzonyW: 'asc' }, { id: 'asc' }],
      include: {
        klient: { select: { id: true, nazwa: true } },
        pozycje: {
          include: {
            produkt: {
              select: {
                id: true,
                idProdio: true,
                nazwa: true,
                dodatkoweOznaczenia: true,
                cena: true,
                stawkaVat: true,
                zdjecie: true,
                bomSurowcow: {
                  include: {
                    surowiec: {
                      select: {
                        id: true,
                        nazwa: true,
                        jednostka: true,
                        cena: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        zlecenia: {
          include: {
            maszyna: true,
          },
        },
      },
    });

    if (zamowienia.length === 0) {
      res.status(404).json({ sukces: false, wiadomosc: 'Nie znaleziono zamowien dla wskazanego numeru.' });
      return;
    }

    const pierwszyKlient = zamowienia.find((zamowienie) => zamowienie.klient)?.klient ?? null;

    res.json({
      sukces: true,
      dane: {
        numer,
        klient: pierwszyKlient,
        utworzonyW: zamowienia[0]?.utworzonyW ?? null,
        oczekiwanaData: zamowienia.reduce<Date | null>((najpozniejsza, zamowienie) => {
          if (!zamowienie.oczekiwanaData) {
            return najpozniejsza;
          }

          if (!najpozniejsza || zamowienie.oczekiwanaData > najpozniejsza) {
            return zamowienie.oczekiwanaData;
          }

          return najpozniejsza;
        }, null),
        zamowienia,
      },
    });
  } catch (blad) {
    console.error('[pobierzZamowienieZgrupowane]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function zaktualizujZamowienieZgrupowane(req: Request, res: Response): Promise<void> {
  try {
    const numer = String(req.query.numer ?? '').trim();

    if (!numer) {
      res.status(400).json({ sukces: false, wiadomosc: 'Numer zewnetrzny jest wymagany.' });
      return;
    }

    const zamowienia = await prisma.zamowienie.findMany({
      where: {
        OR: [{ zewnetrznyNumer: numer }, { grupa: { numer } }],
      },
      select: { id: true },
    });

    if (zamowienia.length === 0) {
      res.status(404).json({ sukces: false, wiadomosc: 'Nie znaleziono zamowien do aktualizacji.' });
      return;
    }

    const { zewnetrznyNumer, klientId, oczekiwanaData, uwagi } = req.body as {
      zewnetrznyNumer?: string;
      klientId?: string | null;
      oczekiwanaData?: string | null;
      uwagi?: string | null;
    };

    await prisma.zamowienie.updateMany({
      where: {
        id: { in: zamowienia.map((zamowienie) => zamowienie.id) },
      },
      data: {
        zewnetrznyNumer: zewnetrznyNumer?.trim() || null,
        klientId: klientId ? parseInt(klientId, 10) : null,
        oczekiwanaData: oczekiwanaData ? new Date(oczekiwanaData) : null,
        uwagi: uwagi?.trim() || null,
      },
    });

    res.json({
      sukces: true,
      dane: {
        liczbaZamowien: zamowienia.length,
      },
    });
  } catch (blad) {
    console.error('[zaktualizujZamowienieZgrupowane]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function pobierzZamowienie(req: Request, res: Response): Promise<void> {
  try {
    const zamowienie = await prisma.zamowienie.findUnique({ where: { id: parseInt(req.params.id) }, include: { klient: true, pozycje: { include: { produkt: true } }, zlecenia: { include: { maszyna: true } } } });
    if (!zamowienie) { res.status(404).json({ sukces: false, wiadomosc: 'Zamówienie nie istnieje' }); return; }
    res.json({ sukces: true, dane: zamowienie });
  } catch (blad) {
    console.error('[pobierzZamowienie]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' });
  }
}
export async function utworzZamowienie(req: Request, res: Response): Promise<void> {
  try {
    const { idProdio, zewnetrznyNumer, klientId, status, oczekiwanaData, uwagi, pozycje } = req.body;
    const finalneIdProdio = String(idProdio ?? '').trim() || await wygenerujUnikalneIdProdioZamowienia();
    const zamowienie = await prisma.zamowienie.create({ data: { idProdio: finalneIdProdio, zewnetrznyNumer, klientId: klientId ? parseInt(klientId) : undefined, status, oczekiwanaData: oczekiwanaData ? new Date(oczekiwanaData) : undefined, uwagi, pozycje: pozycje?.length ? { create: pozycje.map((p: { produktId: number; ilosc: number; cena?: number }) => ({ produktId: parseInt(String(p.produktId)), ilosc: p.ilosc, cena: p.cena })) } : undefined } });
    res.status(201).json({ sukces: true, dane: zamowienie });
  } catch (blad) {
    console.error('[utworzZamowienie]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' });
  }
}
export async function zaktualizujZamowienie(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const istniejace = await prisma.zamowienie.findUnique({ where: { id }, select: { id: true } });
    if (!istniejace) { res.status(404).json({ sukces: false, wiadomosc: 'Zamówienie nie istnieje' }); return; }
    const { zewnetrznyNumer, klientId, status, oczekiwanaData, uwagi } = req.body;
    const zamowienie = await prisma.zamowienie.update({ where: { id }, data: { zewnetrznyNumer, klientId: klientId ? parseInt(klientId) : undefined, status, oczekiwanaData: oczekiwanaData ? new Date(oczekiwanaData) : undefined, uwagi } });
    res.json({ sukces: true, dane: zamowienie });
  } catch (blad) {
    console.error('[zaktualizujZamowienie]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' });
  }
}
export async function usunZamowienie(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const istniejace = await prisma.zamowienie.findUnique({ where: { id }, select: { id: true } });
    if (!istniejace) { res.status(404).json({ sukces: false, wiadomosc: 'Zamówienie nie istnieje' }); return; }
    await prisma.zamowienie.delete({ where: { id } });
    res.json({ sukces: true, wiadomosc: 'Zamówienie usunięte' });
  } catch (blad) {
    console.error('[usunZamowienie]', blad);
    res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' });
  }
}
