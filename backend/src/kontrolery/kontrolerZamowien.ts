import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    const [dane, lacznie] = await Promise.all([prisma.zamowienie.findMany({ where, skip: (strona - 1) * iloscNaStrone, take: iloscNaStrone, orderBy: { [sortPole]: sortKierunek }, include: { klient: { select: { id: true, nazwa: true } }, pozycje: { include: { produkt: { select: { id: true, nazwa: true, idProdio: true } } } } } }), prisma.zamowienie.count({ where })]);
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
    if (!idProdio) { res.status(400).json({ sukces: false, wiadomosc: 'idProdio jest wymagane' }); return; }
    const zamowienie = await prisma.zamowienie.create({ data: { idProdio, zewnetrznyNumer, klientId: klientId ? parseInt(klientId) : undefined, status, oczekiwanaData: oczekiwanaData ? new Date(oczekiwanaData) : undefined, uwagi, pozycje: pozycje?.length ? { create: pozycje.map((p: { produktId: number; ilosc: number; cena?: number }) => ({ produktId: parseInt(String(p.produktId)), ilosc: p.ilosc, cena: p.cena })) } : undefined } });
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
