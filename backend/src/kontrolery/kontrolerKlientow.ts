import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function pobierzKlientow(req: Request, res: Response): Promise<void> {
  try {
    const strona = Math.max(1, parseInt(String(req.query.strona ?? '1')));
    const iloscNaStrone = Math.min(100, parseInt(String(req.query.iloscNaStrone ?? '20')));
    const szukaj = String(req.query.szukaj ?? '');
    const sortPole = String(req.query.sortPole ?? 'id');
    const sortKierunek = req.query.sortKierunek === 'asc' ? 'asc' : ('desc' as const);
    const where = szukaj ? { OR: [{ nazwa: { contains: szukaj, mode: 'insensitive' as const } }, { email: { contains: szukaj, mode: 'insensitive' as const } }, { nip: { contains: szukaj, mode: 'insensitive' as const } }, { miasto: { contains: szukaj, mode: 'insensitive' as const } }] } : {};
    const [dane, lacznie] = await Promise.all([prisma.klient.findMany({ where, skip: (strona - 1) * iloscNaStrone, take: iloscNaStrone, orderBy: { [sortPole]: sortKierunek } }), prisma.klient.count({ where })]);
    res.json({ sukces: true, dane, lacznie, strona, iloscNaStrone });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}
export async function pobierzKlienta(req: Request, res: Response): Promise<void> {
  try {
    const klient = await prisma.klient.findUnique({ where: { id: parseInt(req.params.id) }, include: { zamowienia: { orderBy: { utworzonyW: 'desc' }, take: 10 } } });
    if (!klient) { res.status(404).json({ sukces: false, wiadomosc: 'Klient nie istnieje' }); return; }
    res.json({ sukces: true, dane: klient });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}
export async function utworzKlienta(req: Request, res: Response): Promise<void> {
  try {
    const { nazwa, ulica, miasto, kodPocztowy, wojewodztwo, kraj, email, telefon, nip, aktywny, dostepB2b, loginB2b, hasloB2b } = req.body;
    if (!nazwa) { res.status(400).json({ sukces: false, wiadomosc: 'Nazwa jest wymagana' }); return; }
    const klient = await prisma.klient.create({ data: { nazwa, ulica, miasto, kodPocztowy, wojewodztwo, kraj, email, telefon, nip, aktywny, dostepB2b, loginB2b, hasloB2b } });
    res.status(201).json({ sukces: true, dane: klient });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}
export async function zaktualizujKlienta(req: Request, res: Response): Promise<void> {
  try {
    const { nazwa, ulica, miasto, kodPocztowy, wojewodztwo, kraj, email, telefon, nip, aktywny, dostepB2b, loginB2b, hasloB2b } = req.body;
    const klient = await prisma.klient.update({ where: { id: parseInt(req.params.id) }, data: { nazwa, ulica, miasto, kodPocztowy, wojewodztwo, kraj, email, telefon, nip, aktywny, dostepB2b, loginB2b, hasloB2b } });
    res.json({ sukces: true, dane: klient });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}
export async function usunKlienta(req: Request, res: Response): Promise<void> {
  try {
    await prisma.klient.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ sukces: true, wiadomosc: 'Klient usunięty' });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}
