import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function pobierzGrupyProduktow(_req: Request, res: Response): Promise<void> {
  try {
    const grupyProduktow = await prisma.grupaProduktow.findMany({
      include: {
        _count: {
          select: {
            produkty: true
          }
        }
      },
      orderBy: {
        nazwa: 'asc'
      }
    });

    const dane = grupyProduktow.map((grupa) => ({
      id: grupa.id,
      nazwa: grupa.nazwa,
      liczbaProduktow: grupa._count.produkty
    }));

    res.json({ sukces: true, dane });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function utworzGrupe(req: Request, res: Response): Promise<void> {
  try {
    const { nazwa } = req.body;

    if (!nazwa || !String(nazwa).trim()) {
      res.status(400).json({ sukces: false, wiadomosc: 'nazwa jest wymagana' });
      return;
    }

    const grupa = await prisma.grupaProduktow.create({
      data: {
        nazwa: String(nazwa).trim()
      }
    });

    res.status(201).json({ sukces: true, dane: grupa });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function zaktualizujGrupe(req: Request, res: Response): Promise<void> {
  try {
    const { nazwa } = req.body;

    if (nazwa !== undefined && !String(nazwa).trim()) {
      res.status(400).json({ sukces: false, wiadomosc: 'nazwa nie moze byc pusta' });
      return;
    }

    const grupa = await prisma.grupaProduktow.update({
      where: {
        id: parseInt(req.params.id)
      },
      data: {
        nazwa: nazwa === undefined ? undefined : String(nazwa).trim()
      }
    });

    res.json({ sukces: true, dane: grupa });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function usunGrupe(req: Request, res: Response): Promise<void> {
  try {
    await prisma.grupaProduktow.delete({
      where: {
        id: parseInt(req.params.id)
      }
    });

    res.json({ sukces: true, wiadomosc: 'Grupa produktow usunieta' });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}
