import { PrismaClient } from '@prisma/client';
import type { RequestHandler } from 'express';

const prisma = new PrismaClient();

function parseIntValue(value: unknown, fallback?: number) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseBooleanValue(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (String(value).toLowerCase() === 'true') return true;
  if (String(value).toLowerCase() === 'false') return false;
  return undefined;
}

function parseString(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

export const pobierzDostawcow: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, parseIntValue(req.query.page, 1) ?? 1);
    const limit = Math.min(100, Math.max(1, parseIntValue(req.query.limit, 20) ?? 20));
    const skip = (page - 1) * limit;
    const szukaj = String(req.query.szukaj ?? '').trim();
    const aktywny = parseBooleanValue(req.query.aktywny);

    const where = {
      ...(aktywny === undefined ? {} : { aktywny }),
      ...(szukaj
        ? {
            OR: [
              { nazwa: { contains: szukaj, mode: 'insensitive' as const } },
              { email: { contains: szukaj, mode: 'insensitive' as const } },
              { telefon: { contains: szukaj, mode: 'insensitive' as const } },
              { osobaKontaktowa: { contains: szukaj, mode: 'insensitive' as const } },
              { miasto: { contains: szukaj, mode: 'insensitive' as const } },
              { nip: { contains: szukaj, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [dostawcy, total] = await Promise.all([
      prisma.dostawca.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nazwa: 'asc' },
        include: {
          _count: {
            select: {
              zamowieniaDostawcy: true,
              surowceDostawcy: true,
            },
          },
        },
      }),
      prisma.dostawca.count({ where }),
    ]);

    res.json({
      sukces: true,
      dane: dostawcy.map((dostawca) => ({
        id: dostawca.id,
        nazwa: dostawca.nazwa,
        ulica: dostawca.ulica,
        kodPocztowy: dostawca.kodPocztowy,
        miasto: dostawca.miasto,
        kraj: dostawca.kraj,
        email: dostawca.email,
        telefon: dostawca.telefon,
        nip: dostawca.nip,
        osobaKontaktowa: dostawca.osobaKontaktowa,
        aktywny: dostawca.aktywny,
        liczbaZamowien: dostawca._count.zamowieniaDostawcy,
        liczbaSurowcow: dostawca._count.surowceDostawcy,
      })),
      total,
      page,
      limit,
    });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac dostawcow.' });
  }
};

export const dodajDostawce: RequestHandler = async (req, res) => {
  try {
    const nazwa = parseString(req.body.nazwa);

    if (!nazwa) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nazwa dostawcy jest wymagana.' });
      return;
    }

    const dostawca = await prisma.dostawca.create({
      data: {
        nazwa,
        ulica: parseString(req.body.ulica),
        kodPocztowy: parseString(req.body.kodPocztowy),
        miasto: parseString(req.body.miasto),
        kraj: parseString(req.body.kraj),
        email: parseString(req.body.email),
        telefon: parseString(req.body.telefon),
        nip: parseString(req.body.nip),
        osobaKontaktowa: parseString(req.body.osobaKontaktowa),
        aktywny: parseBooleanValue(req.body.aktywny) ?? true,
      },
    });

    res.status(201).json({ sukces: true, dane: dostawca });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie dodac dostawcy.' });
  }
};

export const zaktualizujDostawce: RequestHandler = async (req, res) => {
  try {
    const id = parseIntValue(req.params.id);
    if (!id) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nieprawidlowe id dostawcy.' });
      return;
    }

    if (req.body.nazwa !== undefined && !parseString(req.body.nazwa)) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nazwa dostawcy nie moze byc pusta.' });
      return;
    }

    const dostawca = await prisma.dostawca.update({
      where: { id },
      data: {
        nazwa: req.body.nazwa !== undefined ? parseString(req.body.nazwa) : undefined,
        ulica: req.body.ulica !== undefined ? parseString(req.body.ulica) ?? null : undefined,
        kodPocztowy: req.body.kodPocztowy !== undefined ? parseString(req.body.kodPocztowy) ?? null : undefined,
        miasto: req.body.miasto !== undefined ? parseString(req.body.miasto) ?? null : undefined,
        kraj: req.body.kraj !== undefined ? parseString(req.body.kraj) ?? null : undefined,
        email: req.body.email !== undefined ? parseString(req.body.email) ?? null : undefined,
        telefon: req.body.telefon !== undefined ? parseString(req.body.telefon) ?? null : undefined,
        nip: req.body.nip !== undefined ? parseString(req.body.nip) ?? null : undefined,
        osobaKontaktowa:
          req.body.osobaKontaktowa !== undefined ? parseString(req.body.osobaKontaktowa) ?? null : undefined,
        aktywny: parseBooleanValue(req.body.aktywny),
      },
    });

    res.json({ sukces: true, dane: dostawca });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie zapisac dostawcy.' });
  }
};

export const usunDostawce: RequestHandler = async (req, res) => {
  try {
    const id = parseIntValue(req.params.id);
    if (!id) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nieprawidlowe id dostawcy.' });
      return;
    }

    const liczbaZamowien = await prisma.zamowienieDostawcy.count({
      where: { dostawcaId: id },
    });

    if (liczbaZamowien > 0) {
      res.status(400).json({
        sukces: false,
        wiadomosc: 'Nie mozna usunac dostawcy, ktory ma powiazane zamowienia.',
      });
      return;
    }

    await prisma.dostawca.delete({ where: { id } });
    res.json({ sukces: true, wiadomosc: 'Dostawca zostal usuniety.' });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie usunac dostawcy.' });
  }
};

export const pobierzSurowceDostawcy: RequestHandler = async (req, res) => {
  try {
    const id = parseIntValue(req.params.id);
    if (!id) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nieprawidlowe id dostawcy.' });
      return;
    }

    const surowce = await prisma.surowiecDostawca.findMany({
      where: { dostawcaId: id },
      orderBy: { surowiec: { nazwa: 'asc' } },
      include: {
        surowiec: {
          select: {
            id: true,
            nazwa: true,
            jednostka: true,
            aktywny: true,
          },
        },
      },
    });

    res.json({
      sukces: true,
      dane: surowce.map((rekord) => ({
        id: rekord.id,
        cenaZakupu: Number(rekord.cenaZakupu),
        waluta: rekord.waluta,
        surowiec: rekord.surowiec,
      })),
    });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Nie udalo sie pobrac surowcow dostawcy.' });
  }
};
