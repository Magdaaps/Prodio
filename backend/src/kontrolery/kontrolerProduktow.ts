import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function wygenerujUnikalneIdProdio(): Promise<string> {
  for (let proba = 0; proba < 20; proba += 1) {
    const kandydat = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    const istniejacy = await prisma.produkt.findUnique({
      where: { idProdio: kandydat },
      select: { id: true },
    });

    if (!istniejacy) {
      return kandydat;
    }
  }

  throw new Error('Nie udalo sie wygenerowac unikalnego ID Prodio');
}

export async function pobierzGrupyProduktow(_req: Request, res: Response): Promise<void> {
  try {
    const dane = await prisma.grupaProduktow.findMany({ orderBy: { nazwa: 'asc' } });
    res.json({ sukces: true, dane });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function pobierzProdukty(req: Request, res: Response): Promise<void> {
  try {
    const strona = Math.max(1, parseInt(String(req.query.strona ?? '1')));
    const iloscNaStrone = Math.min(100, parseInt(String(req.query.iloscNaStrone ?? '20')));
    const szukaj = String(req.query.szukaj ?? '');
    const sortPole = String(req.query.sortPole ?? 'id');
    const sortKierunek = req.query.sortKierunek === 'asc' ? 'asc' : ('desc' as const);
    const where = szukaj
      ? {
          OR: [
            { nazwa: { contains: szukaj, mode: 'insensitive' as const } },
            { idProdio: { contains: szukaj, mode: 'insensitive' as const } },
            { ean: { contains: szukaj, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [dane, lacznie] = await Promise.all([
      prisma.produkt.findMany({
        where,
        skip: (strona - 1) * iloscNaStrone,
        take: iloscNaStrone,
        orderBy: { [sortPole]: sortKierunek },
        include: { grupa: true, klient: { select: { id: true, nazwa: true } } },
      }),
      prisma.produkt.count({ where }),
    ]);

    res.json({ sukces: true, dane, lacznie, strona, iloscNaStrone });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function pobierzProdukt(req: Request, res: Response): Promise<void> {
  try {
    const produkt = await prisma.produkt.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        grupa: true,
        klient: true,
        bomOperacji: { include: { maszyna: true } },
        bomSurowcow: { include: { surowiec: true, maszyna: true } },
      },
    });

    if (!produkt) {
      res.status(404).json({ sukces: false, wiadomosc: 'Produkt nie istnieje' });
      return;
    }

    res.json({ sukces: true, dane: produkt });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function utworzProdukt(req: Request, res: Response): Promise<void> {
  try {
    const {
      nazwa,
      ean,
      dodatkoweOznaczenia,
      wymiar,
      sposobPakowania,
      informacjeNiewidoczne,
      informacjeWidoczne,
      cena,
      waluta,
      stawkaVat,
      zdjecie,
      aktywny,
      grupaId,
      klientId,
    } = req.body;

    if (!nazwa) {
      res.status(400).json({ sukces: false, wiadomosc: 'nazwa jest wymagana' });
      return;
    }

    const idProdio = await wygenerujUnikalneIdProdio();

    const produkt = await prisma.produkt.create({
      data: {
        idProdio,
        nazwa,
        ean,
        dodatkoweOznaczenia,
        wymiar,
        sposobPakowania,
        informacjeNiewidoczne,
        informacjeWidoczne,
        cena: cena ? parseFloat(cena) : undefined,
        waluta: waluta || 'PLN',
        stawkaVat: stawkaVat ? parseInt(stawkaVat) : 23,
        zdjecie,
        aktywny,
        grupaId: grupaId ? parseInt(grupaId) : undefined,
        klientId: klientId ? parseInt(klientId) : undefined,
      },
    });

    res.status(201).json({ sukces: true, dane: produkt });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function zaktualizujProdukt(req: Request, res: Response): Promise<void> {
  try {
    const {
      nazwa,
      ean,
      dodatkoweOznaczenia,
      wymiar,
      sposobPakowania,
      informacjeNiewidoczne,
      informacjeWidoczne,
      cena,
      waluta,
      stawkaVat,
      zdjecie,
      aktywny,
      grupaId,
      klientId,
    } = req.body;

    if (!nazwa) {
      res.status(400).json({ sukces: false, wiadomosc: 'nazwa jest wymagana' });
      return;
    }

    const produkt = await prisma.produkt.update({
      where: { id: parseInt(req.params.id) },
      data: {
        nazwa,
        ean,
        dodatkoweOznaczenia,
        wymiar,
        sposobPakowania,
        informacjeNiewidoczne,
        informacjeWidoczne,
        cena: cena ? parseFloat(cena) : null,
        waluta: waluta || 'PLN',
        stawkaVat: stawkaVat ? parseInt(stawkaVat) : 23,
        zdjecie,
        aktywny,
        grupaId: grupaId ? parseInt(grupaId) : null,
        klientId: klientId ? parseInt(klientId) : null,
      },
    });

    res.json({ sukces: true, dane: produkt });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function usunProdukt(req: Request, res: Response): Promise<void> {
  try {
    await prisma.produkt.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ sukces: true, wiadomosc: 'Produkt usuniety' });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function pobierzOperacjeProduktu(req: Request, res: Response): Promise<void> {
  try {
    const dane = await prisma.bomOperacji.findMany({
      where: { produktId: parseInt(req.params.id) },
      include: { maszyna: true },
      orderBy: { kolejnosc: 'asc' },
    });
    res.json({ sukces: true, dane });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function dodajOperacje(req: Request, res: Response): Promise<void> {
  try {
    const produktId = parseInt(req.params.id);
    const { maszynaId, normaSztGodz, parametry, tagi, maszynaKoncowa, kolejnosc } = req.body;

    if (!maszynaId) {
      res.status(400).json({ sukces: false, wiadomosc: 'maszynaId jest wymagane' });
      return;
    }

    const operacja = await prisma.bomOperacji.create({
      data: {
        produktId,
        maszynaId: parseInt(maszynaId),
        normaSztGodz: normaSztGodz ? parseFloat(normaSztGodz) : 0,
        parametry: parametry || null,
        tagi: tagi || [],
        maszynaKoncowa: Boolean(maszynaKoncowa),
        kolejnosc: kolejnosc !== undefined ? parseInt(kolejnosc) : 0,
      },
      include: { maszyna: true },
    });

    res.status(201).json({ sukces: true, dane: operacja });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function zaktualizujOperacje(req: Request, res: Response): Promise<void> {
  try {
    const { maszynaId, normaSztGodz, parametry, tagi, maszynaKoncowa, kolejnosc } = req.body;
    const operacja = await prisma.bomOperacji.update({
      where: { id: parseInt(req.params.opId) },
      data: {
        maszynaId: maszynaId ? parseInt(maszynaId) : undefined,
        normaSztGodz: normaSztGodz !== undefined ? parseFloat(normaSztGodz) : undefined,
        parametry: parametry !== undefined ? (parametry || null) : undefined,
        tagi: tagi || [],
        maszynaKoncowa: maszynaKoncowa !== undefined ? Boolean(maszynaKoncowa) : undefined,
        kolejnosc: kolejnosc !== undefined ? parseInt(kolejnosc) : undefined,
      },
      include: { maszyna: true },
    });
    res.json({ sukces: true, dane: operacja });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function usunOperacje(req: Request, res: Response): Promise<void> {
  try {
    await prisma.bomOperacji.delete({ where: { id: parseInt(req.params.opId) } });
    res.json({ sukces: true, wiadomosc: 'Operacja usunieta' });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function pobierzSurowceProduktu(req: Request, res: Response): Promise<void> {
  try {
    const dane = await prisma.bomSurowcow.findMany({
      where: { produktId: parseInt(req.params.id) },
      include: { surowiec: true, maszyna: true },
      orderBy: { id: 'asc' },
    });
    res.json({ sukces: true, dane });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function dodajSurowiecProduktu(req: Request, res: Response): Promise<void> {
  try {
    const produktId = parseInt(req.params.id);
    const { surowiecId, maszynaId, ilosc, jednostka } = req.body;

    if (!surowiecId || !(Number(ilosc) > 0)) {
      res.status(400).json({ sukces: false, wiadomosc: 'surowiecId i dodatnia ilosc sa wymagane' });
      return;
    }

    const rekord = await prisma.bomSurowcow.create({
      data: {
        produktId,
        surowiecId: parseInt(String(surowiecId)),
        maszynaId: maszynaId ? parseInt(String(maszynaId)) : null,
        ilosc: parseFloat(String(ilosc)),
        jednostka: jednostka ? String(jednostka) : 'szt',
      },
      include: { surowiec: true, maszyna: true },
    });

    res.status(201).json({ sukces: true, dane: rekord });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function zaktualizujSurowiecProduktu(req: Request, res: Response): Promise<void> {
  try {
    const { surowiecId, maszynaId, ilosc, jednostka } = req.body;
    const rekord = await prisma.bomSurowcow.update({
      where: { id: parseInt(req.params.surowiecBomId) },
      data: {
        surowiecId: surowiecId ? parseInt(String(surowiecId)) : undefined,
        maszynaId: maszynaId !== undefined ? (maszynaId ? parseInt(String(maszynaId)) : null) : undefined,
        ilosc: ilosc !== undefined ? parseFloat(String(ilosc)) : undefined,
        jednostka: jednostka !== undefined ? String(jednostka) : undefined,
      },
      include: { surowiec: true, maszyna: true },
    });

    res.json({ sukces: true, dane: rekord });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}

export async function usunSurowiecProduktu(req: Request, res: Response): Promise<void> {
  try {
    await prisma.bomSurowcow.delete({ where: { id: parseInt(req.params.surowiecBomId) } });
    res.json({ sukces: true, wiadomosc: 'Surowiec produktu usuniety' });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
  }
}
