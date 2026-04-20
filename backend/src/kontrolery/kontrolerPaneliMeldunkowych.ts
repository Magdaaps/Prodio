import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function pobierzPanele(req: Request, res: Response): Promise<void> {
  try {
    const strona = Math.max(1, parseInt(String(req.query.strona ?? '1')));
    const iloscNaStrone = Math.min(100, parseInt(String(req.query.iloscNaStrone ?? '50')));
    const szukaj = String(req.query.szukaj ?? '');
    const sortPole = String(req.query.sortPole ?? 'id');
    const sortKierunek = req.query.sortKierunek === 'asc' ? 'asc' : ('desc' as const);
    const where = szukaj ? { nazwa: { contains: szukaj, mode: 'insensitive' as const } } : {};
    const [dane, lacznie] = await Promise.all([
      prisma.panelMeldunkowy.findMany({
        where,
        skip: (strona - 1) * iloscNaStrone,
        take: iloscNaStrone,
        orderBy: { [sortPole]: sortKierunek },
        include: { _count: { select: { maszyny: true } } }
      }),
      prisma.panelMeldunkowy.count({ where })
    ]);
    res.json({ sukces: true, dane, lacznie, strona, iloscNaStrone });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'BÄąâ€šĂ„â€¦d serwera' }); }
}

export async function pobierzPanel(req: Request, res: Response): Promise<void> {
  try {
    const panel = await prisma.panelMeldunkowy.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { maszyny: true }
    });
    if (!panel) { res.status(404).json({ sukces: false, wiadomosc: 'Panel meldunkowy nie istnieje' }); return; }
    res.json({ sukces: true, dane: panel });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'BÄąâ€šĂ„â€¦d serwera' }); }
}

export async function utworzPanel(req: Request, res: Response): Promise<void> {
  try {
    const { nazwa, login, haslo, geolokalizacjaWlaczona, pokazLokalizacjeTimeline } = req.body;
    if (!nazwa) { res.status(400).json({ sukces: false, wiadomosc: 'Nazwa jest wymagana' }); return; }
    const panel = await prisma.panelMeldunkowy.create({
      data: {
        nazwa,
        login: login || null,
        haslo: haslo || null,
        geolokalizacjaWlaczona: geolokalizacjaWlaczona ?? false,
        pokazLokalizacjeTimeline: pokazLokalizacjeTimeline ?? false,
      }
    });
    res.status(201).json({ sukces: true, dane: panel });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'BÄąâ€šĂ„â€¦d serwera' }); }
}

export async function zaktualizujPanel(req: Request, res: Response): Promise<void> {
  try {
    const { nazwa, login, haslo, geolokalizacjaWlaczona, pokazLokalizacjeTimeline } = req.body;
    const panel = await prisma.panelMeldunkowy.update({
      where: { id: parseInt(req.params.id) },
      data: {
        nazwa,
        login: login || null,
        haslo: haslo || null,
        geolokalizacjaWlaczona,
        pokazLokalizacjeTimeline,
      }
    });
    res.json({ sukces: true, dane: panel });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'BÄąâ€šĂ„â€¦d serwera' }); }
}

export async function usunPanel(req: Request, res: Response): Promise<void> {
  try {
    const panel = await prisma.panelMeldunkowy.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ sukces: true, dane: panel });
  } catch { res.status(500).json({ sukces: false, wiadomosc: 'BÄąâ€šĂ„â€¦d serwera' }); }
}
