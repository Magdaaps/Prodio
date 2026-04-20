import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function pobierzPracownikow(req: Request, res: Response): Promise<void> {
  try {
    const strona = Math.max(1, parseInt(String(req.query.strona ?? '1')));
    const iloscNaStrone = Math.min(100, parseInt(String(req.query.iloscNaStrone ?? '20')));
    const szukaj = String(req.query.szukaj ?? '');
    const sortPole = String(req.query.sortPole ?? 'id');
    const sortKierunek = req.query.sortKierunek === 'asc' ? 'asc' : ('desc' as const);
    const where = szukaj ? { OR: [{ imie: { contains: szukaj, mode: 'insensitive' as const } }, { nazwisko: { contains: szukaj, mode: 'insensitive' as const } }, { stanowisko: { contains: szukaj, mode: 'insensitive' as const } }] } : {};
    const [dane, lacznie] = await Promise.all([prisma.pracownik.findMany({ where, skip: (strona - 1) * iloscNaStrone, take: iloscNaStrone, orderBy: { [sortPole]: sortKierunek } }), prisma.pracownik.count({ where })]);
    res.json({ sukces: true, dane, lacznie, strona, iloscNaStrone });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}
export async function pobierzPracownika(req: Request, res: Response): Promise<void> {
  try {
    const pracownik = await prisma.pracownik.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!pracownik) { res.status(404).json({ sukces: false, wiadomosc: 'Pracownik nie istnieje' }); return; }
    res.json({ sukces: true, dane: pracownik });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}
export async function utworzPracownika(req: Request, res: Response): Promise<void> {
  try {
    const { imie, nazwisko, pin, kodQr, stanowisko, stawkaGodzinowa, kolorAvatara, aktywny } = req.body;
    if (!imie || !nazwisko) { res.status(400).json({ sukces: false, wiadomosc: 'Imię i nazwisko są wymagane' }); return; }
    const pracownik = await prisma.pracownik.create({ data: { imie, nazwisko, pin, kodQr, stanowisko, stawkaGodzinowa: stawkaGodzinowa ? parseFloat(stawkaGodzinowa) : undefined, kolorAvatara, aktywny } });
    res.status(201).json({ sukces: true, dane: pracownik });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}
export async function zaktualizujPracownika(req: Request, res: Response): Promise<void> {
  try {
    const { imie, nazwisko, pin, kodQr, stanowisko, stawkaGodzinowa, kolorAvatara, aktywny } = req.body;
    const pracownik = await prisma.pracownik.update({ where: { id: parseInt(req.params.id) }, data: { imie, nazwisko, pin, kodQr, stanowisko, stawkaGodzinowa: stawkaGodzinowa ? parseFloat(stawkaGodzinowa) : undefined, kolorAvatara, aktywny } });
    res.json({ sukces: true, dane: pracownik });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}
export async function usunPracownika(req: Request, res: Response): Promise<void> {
  try {
    await prisma.pracownik.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ sukces: true, wiadomosc: 'Pracownik usunięty' });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}
