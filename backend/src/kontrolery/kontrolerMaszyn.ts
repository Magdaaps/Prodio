import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseDecimal(wartosc: unknown): number | undefined {
  if (wartosc === undefined || wartosc === null || wartosc === '') return undefined;
  return parseFloat(String(wartosc));
}

function parsePanelId(wartosc: unknown): number | null | undefined {
  if (wartosc === undefined) return undefined;
  if (wartosc === null || wartosc === '') return null;
  return parseInt(String(wartosc));
}

function buildPanelCreateInput(panelId: number | null | undefined) {
  if (panelId === undefined || panelId === null) {
    return undefined;
  }

  return {
    connect: {
      id: panelId,
    },
  };
}

function buildPanelUpdateInput(panelId: number | null | undefined) {
  if (panelId === undefined) {
    return undefined;
  }

  if (panelId === null) {
    return {
      disconnect: true,
    };
  }

  return {
    connect: {
      id: panelId,
    },
  };
}

export async function pobierzMaszyny(req: Request, res: Response): Promise<void> {
  try {
    const strona = Math.max(1, parseInt(String(req.query.strona ?? '1')));
    const iloscNaStrone = Math.min(100, parseInt(String(req.query.iloscNaStrone ?? '20')));
    const szukaj = String(req.query.szukaj ?? '');
    const sortPole = String(req.query.sortPole ?? 'id');
    const sortKierunek = req.query.sortKierunek === 'asc' ? 'asc' : ('desc' as const);
    const where = szukaj ? { nazwa: { contains: szukaj, mode: 'insensitive' as const } } : {};
    const [dane, lacznie] = await Promise.all([
      prisma.maszyna.findMany({ where, skip: (strona - 1) * iloscNaStrone, take: iloscNaStrone, orderBy: { [sortPole]: sortKierunek }, include: { panel: true } }),
      prisma.maszyna.count({ where })
    ]);
    res.json({ sukces: true, dane, lacznie, strona, iloscNaStrone });
  } catch (e) { console.error('pobierzMaszyny:', e); res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}

export async function pobierzMaszyne(req: Request, res: Response): Promise<void> {
  try {
    const maszyna = await prisma.maszyna.findUnique({ where: { id: parseInt(req.params.id) }, include: { panel: true } });
    if (!maszyna) { res.status(404).json({ sukces: false, wiadomosc: 'Maszyna nie istnieje' }); return; }
    res.json({ sukces: true, dane: maszyna });
  } catch (e) { console.error('pobierzMaszyne:', e); res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}

export async function utworzMaszyne(req: Request, res: Response): Promise<void> {
  try {
    const { nazwa, panelId, kosztRbh, kosztUstawiania, waluta, aktywna, maszynaKoncowa, kolejnosc, uwagi, iloscZmian, iloscGodzinDzien } = req.body;
    if (!nazwa) { res.status(400).json({ sukces: false, wiadomosc: 'Nazwa jest wymagana' }); return; }
    const przetworzonePanelId = parsePanelId(panelId);
    const maszyna = await prisma.maszyna.create({
      data: {
        nazwa,
        ...(buildPanelCreateInput(przetworzonePanelId) ? { panel: buildPanelCreateInput(przetworzonePanelId) } : {}),
        kosztRbh: parseDecimal(kosztRbh) ?? 0,
        kosztUstawiania: parseDecimal(kosztUstawiania) ?? 0,
        waluta: waluta ?? 'PLN',
        aktywna: aktywna ?? true,
        maszynaKoncowa: maszynaKoncowa ?? false,
        kolejnosc: kolejnosc ?? 0,
        uwagi: uwagi ?? null,
        iloscZmian: iloscZmian !== undefined ? parseInt(String(iloscZmian)) : 1,
        iloscGodzinDzien: iloscGodzinDzien !== undefined ? parseInt(String(iloscGodzinDzien)) : 8,
      }
    });
    res.status(201).json({ sukces: true, dane: maszyna });
  } catch (e) { console.error('utworzMaszyne:', e); res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}

export async function zaktualizujMaszyne(req: Request, res: Response): Promise<void> {
  try {
    const { nazwa, panelId, kosztRbh, kosztUstawiania, waluta, aktywna, maszynaKoncowa, kolejnosc, uwagi, iloscZmian, iloscGodzinDzien } = req.body;
    const data: Record<string, unknown> = {};
    if (panelId !== undefined) data.panel = buildPanelUpdateInput(parsePanelId(panelId));
    if (kosztRbh !== undefined) data.kosztRbh = parseDecimal(kosztRbh) ?? 0;
    if (kosztUstawiania !== undefined) data.kosztUstawiania = parseDecimal(kosztUstawiania) ?? 0;
    if (waluta !== undefined) data.waluta = waluta;
    if (aktywna !== undefined) data.aktywna = aktywna;
    if (maszynaKoncowa !== undefined) data.maszynaKoncowa = maszynaKoncowa;
    if (kolejnosc !== undefined) data.kolejnosc = kolejnosc;
    if (nazwa !== undefined) data.nazwa = nazwa;
    if (uwagi !== undefined) data.uwagi = uwagi ?? null;
    if (iloscZmian !== undefined) data.iloscZmian = parseInt(String(iloscZmian));
    if (iloscGodzinDzien !== undefined) data.iloscGodzinDzien = parseInt(String(iloscGodzinDzien));
    const maszyna = await prisma.maszyna.update({
      where: { id: parseInt(req.params.id) },
      data,
    });
    res.json({ sukces: true, dane: maszyna });
  } catch (e) { console.error('zaktualizujMaszyne:', e); res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}

export async function usunMaszyne(req: Request, res: Response): Promise<void> {
  try {
    await prisma.maszyna.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ sukces: true, wiadomosc: 'Maszyna usunięta' });
  } catch (e) { console.error('usunMaszyne:', e); res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' }); }
}
