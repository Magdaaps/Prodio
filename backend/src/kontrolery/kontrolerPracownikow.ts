import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function obsluzBlad(res: Response, blad: unknown, kontekst: string) {
  console.error(`[pracownicy] ${kontekst}`, blad);
  res.status(500).json({
    sukces: false,
    wiadomosc: process.env.NODE_ENV === 'development' && blad instanceof Error ? blad.message : 'Blad serwera',
  });
}

function naLiczbeLubUndefined(wartosc: unknown) {
  if (wartosc === null || wartosc === undefined || wartosc === '') {
    return undefined;
  }

  const sparsowana = Number(wartosc);
  return Number.isFinite(sparsowana) ? sparsowana : undefined;
}

function naTekstLubUndefined(wartosc: unknown) {
  if (typeof wartosc !== 'string') {
    return undefined;
  }

  const przyciety = wartosc.trim();
  return przyciety ? przyciety : undefined;
}

export async function pobierzPracownikow(req: Request, res: Response): Promise<void> {
  try {
    const strona = Math.max(1, parseInt(String(req.query.strona ?? '1'), 10));
    const iloscNaStrone = Math.min(100, parseInt(String(req.query.iloscNaStrone ?? '20'), 10));
    const szukaj = String(req.query.szukaj ?? '').trim();
    const sortPole = String(req.query.sortPole ?? 'id');
    const sortKierunek = req.query.sortKierunek === 'asc' ? 'asc' : ('desc' as const);

    const where = szukaj
      ? {
          OR: [
            { imie: { contains: szukaj, mode: 'insensitive' as const } },
            { nazwisko: { contains: szukaj, mode: 'insensitive' as const } },
            { stanowisko: { contains: szukaj, mode: 'insensitive' as const } },
            { pin: { contains: szukaj, mode: 'insensitive' as const } },
            { kodQr: { contains: szukaj, mode: 'insensitive' as const } },
            { telefon: { contains: szukaj, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [dane, lacznie] = await Promise.all([
      prisma.pracownik.findMany({
        where,
        skip: (strona - 1) * iloscNaStrone,
        take: iloscNaStrone,
        orderBy: { [sortPole]: sortKierunek },
      }),
      prisma.pracownik.count({ where }),
    ]);

    res.json({ sukces: true, dane, lacznie, strona, iloscNaStrone });
  } catch (blad) {
    obsluzBlad(res, blad, 'pobierzPracownikow');
  }
}

export async function pobierzPracownika(req: Request, res: Response): Promise<void> {
  try {
    const pracownik = await prisma.pracownik.findUnique({ where: { id: parseInt(req.params.id, 10) } });

    if (!pracownik) {
      res.status(404).json({ sukces: false, wiadomosc: 'Pracownik nie istnieje' });
      return;
    }

    res.json({ sukces: true, dane: pracownik });
  } catch (blad) {
    obsluzBlad(res, blad, 'pobierzPracownika');
  }
}

export async function utworzPracownika(req: Request, res: Response): Promise<void> {
  try {
    const {
      imie,
      nazwisko,
      pin,
      kodQr,
      telefon,
      stanowisko,
      dodatkoweInformacje,
      zdjecie,
      stawkaGodzinowa,
      kolorAvatara,
      aktywny,
    } = req.body;

    if (!naTekstLubUndefined(imie) || !naTekstLubUndefined(nazwisko)) {
      res.status(400).json({ sukces: false, wiadomosc: 'Imie i nazwisko sa wymagane' });
      return;
    }

    const pracownik = await prisma.pracownik.create({
      data: {
        imie: String(imie).trim(),
        nazwisko: String(nazwisko).trim(),
        pin: naTekstLubUndefined(pin),
        kodQr: naTekstLubUndefined(kodQr),
        telefon: naTekstLubUndefined(telefon),
        stanowisko: naTekstLubUndefined(stanowisko),
        dodatkoweInformacje: naTekstLubUndefined(dodatkoweInformacje),
        zdjecie: naTekstLubUndefined(zdjecie),
        stawkaGodzinowa: naLiczbeLubUndefined(stawkaGodzinowa),
        kolorAvatara: naTekstLubUndefined(kolorAvatara) ?? '#2563eb',
        aktywny: typeof aktywny === 'boolean' ? aktywny : true,
      },
    });

    res.status(201).json({ sukces: true, dane: pracownik });
  } catch (blad) {
    obsluzBlad(res, blad, 'utworzPracownika');
  }
}

export async function zaktualizujPracownika(req: Request, res: Response): Promise<void> {
  try {
    const {
      imie,
      nazwisko,
      pin,
      kodQr,
      telefon,
      stanowisko,
      dodatkoweInformacje,
      zdjecie,
      stawkaGodzinowa,
      kolorAvatara,
      aktywny,
    } = req.body;

    const pracownik = await prisma.pracownik.update({
      where: { id: parseInt(req.params.id, 10) },
      data: {
        imie: naTekstLubUndefined(imie) ?? '',
        nazwisko: naTekstLubUndefined(nazwisko) ?? '',
        pin: naTekstLubUndefined(pin) ?? null,
        kodQr: naTekstLubUndefined(kodQr) ?? null,
        telefon: naTekstLubUndefined(telefon) ?? null,
        stanowisko: naTekstLubUndefined(stanowisko) ?? null,
        dodatkoweInformacje: naTekstLubUndefined(dodatkoweInformacje) ?? null,
        zdjecie: naTekstLubUndefined(zdjecie) ?? null,
        stawkaGodzinowa: naLiczbeLubUndefined(stawkaGodzinowa) ?? 0,
        kolorAvatara: naTekstLubUndefined(kolorAvatara) ?? '#2563eb',
        aktywny: typeof aktywny === 'boolean' ? aktywny : true,
      },
    });

    res.json({ sukces: true, dane: pracownik });
  } catch (blad) {
    obsluzBlad(res, blad, 'zaktualizujPracownika');
  }
}

export async function usunPracownika(req: Request, res: Response): Promise<void> {
  try {
    await prisma.pracownik.delete({ where: { id: parseInt(req.params.id, 10) } });
    res.json({ sukces: true, wiadomosc: 'Pracownik usuniety' });
  } catch (blad) {
    obsluzBlad(res, blad, 'usunPracownika');
  }
}
