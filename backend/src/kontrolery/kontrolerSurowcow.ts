import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseDecimal(wartosc: unknown): number | undefined {
  if (wartosc === undefined || wartosc === null || wartosc === '') return undefined;
  return parseFloat(String(wartosc));
}

export async function pobierzSurowce(req: Request, res: Response): Promise<void> {
  try {
    const strona = Math.max(1, parseInt(String(req.query.strona ?? '1')));
    const iloscNaStrone = Math.min(100, parseInt(String(req.query.iloscNaStrone ?? '20')));
    const szukaj = String(req.query.szukaj ?? '');
    const sortPole = String(req.query.sortPole ?? 'id');
    const sortKierunek = req.query.sortKierunek === 'asc' ? 'asc' : ('desc' as const);
    const where = szukaj ? { nazwa: { contains: szukaj, mode: 'insensitive' as const } } : {};
    const [dane, lacznie] = await Promise.all([
      prisma.surowiec.findMany({ where, skip: (strona - 1) * iloscNaStrone, take: iloscNaStrone, orderBy: { [sortPole]: sortKierunek } }),
      prisma.surowiec.count({ where })
    ]);
    res.json({ sukces: true, dane, lacznie, strona, iloscNaStrone });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}

export async function pobierzSurowiec(req: Request, res: Response): Promise<void> {
  try {
    const surowiec = await prisma.surowiec.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { surowceDostawcy: { include: { dostawca: true } } }
    });
    if (!surowiec) { res.status(404).json({ sukces: false, wiadomosc: 'Surowiec nie istnieje' }); return; }
    res.json({ sukces: true, dane: surowiec });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}

export async function utworzSurowiec(req: Request, res: Response): Promise<void> {
  try {
    const { nazwa, jednostka, cena, waluta, vat, aktywny } = req.body;
    if (!nazwa) { res.status(400).json({ sukces: false, wiadomosc: 'Nazwa jest wymagana' }); return; }
    const surowiec = await prisma.surowiec.create({
      data: { nazwa, jednostka, cena: parseDecimal(cena), waluta, vat, aktywny }
    });
    res.status(201).json({ sukces: true, dane: surowiec });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}

export async function zaktualizujSurowiec(req: Request, res: Response): Promise<void> {
  try {
    const { nazwa, jednostka, cena, waluta, vat, aktywny } = req.body;
    const surowiec = await prisma.surowiec.update({
      where: { id: parseInt(req.params.id) },
      data: { nazwa, jednostka, cena: parseDecimal(cena), waluta, vat, aktywny }
    });
    res.json({ sukces: true, dane: surowiec });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}

export async function usunSurowiec(req: Request, res: Response): Promise<void> {
  try {
    await prisma.surowiec.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ sukces: true, wiadomosc: 'Surowiec usunięty' });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}
