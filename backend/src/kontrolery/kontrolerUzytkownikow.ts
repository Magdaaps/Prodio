import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma, RolaUzytkownika } from '@prisma/client';

const prisma = new PrismaClient();

const DOZWOLONE_ROLE = Object.values(RolaUzytkownika);
const DOMYSLNE_SORTOWANIE = 'utworzonyW';
const DOZWOLONE_POLA_SORTOWANIA = new Set([
  'id',
  'email',
  'imie',
  'nazwisko',
  'rola',
  'aktywny',
  'utworzonyW',
  'zaktualizowanyW',
]);

const WYBOR_UZYTKOWNIKA = {
  id: true,
  email: true,
  imie: true,
  nazwisko: true,
  rola: true,
  aktywny: true,
  utworzonyW: true,
  zaktualizowanyW: true,
} satisfies Prisma.UzytkownikSelect;

function odpowiedzBleduSerwera(res: Response): void {
  res.status(500).json({ sukces: false, wiadomosc: 'Blad serwera' });
}

function sparsujId(wartosc: string): number | null {
  const id = Number.parseInt(wartosc, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sparsujRole(wartosc: unknown): RolaUzytkownika | null {
  if (typeof wartosc !== 'string') {
    return null;
  }

  return DOZWOLONE_ROLE.includes(wartosc as RolaUzytkownika)
    ? (wartosc as RolaUzytkownika)
    : null;
}

export async function pobierzUzytkownikow(req: Request, res: Response): Promise<void> {
  try {
    const strona = Math.max(1, Number.parseInt(String(req.query.strona ?? '1'), 10) || 1);
    const iloscNaStrone = Math.min(
      100,
      Math.max(1, Number.parseInt(String(req.query.iloscNaStrone ?? '10'), 10) || 10)
    );
    const szukaj = String(req.query.szukaj ?? '').trim();
    const sortPole = String(req.query.sortPole ?? DOMYSLNE_SORTOWANIE);
    const sortKierunek = req.query.sortKierunek === 'asc' ? 'asc' : 'desc';
    const bezpieczneSortPole = DOZWOLONE_POLA_SORTOWANIA.has(sortPole)
      ? sortPole
      : DOMYSLNE_SORTOWANIE;

    const where: Prisma.UzytkownikWhereInput = szukaj
      ? {
          OR: [
            { email: { contains: szukaj, mode: 'insensitive' } },
            { imie: { contains: szukaj, mode: 'insensitive' } },
            { nazwisko: { contains: szukaj, mode: 'insensitive' } },
          ],
        }
      : {};

    const [dane, lacznie] = await Promise.all([
      prisma.uzytkownik.findMany({
        where,
        select: WYBOR_UZYTKOWNIKA,
        skip: (strona - 1) * iloscNaStrone,
        take: iloscNaStrone,
        orderBy: { [bezpieczneSortPole]: sortKierunek },
      }),
      prisma.uzytkownik.count({ where }),
    ]);

    res.status(200).json({
      sukces: true,
      dane,
      lacznie,
      strona,
      iloscNaStrone,
    });
  } catch {
    odpowiedzBleduSerwera(res);
  }
}

export async function utworzUzytkownika(req: Request, res: Response): Promise<void> {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const imie = String(req.body?.imie ?? '').trim();
    const nazwisko = String(req.body?.nazwisko ?? '').trim();
    const haslo = String(req.body?.haslo ?? '');
    const rola = sparsujRole(req.body?.rola);

    if (!email || !imie || !nazwisko || !haslo || !rola) {
      res.status(400).json({
        sukces: false,
        wiadomosc: 'Email, imie, nazwisko, haslo i rola sa wymagane',
      });
      return;
    }

    const istnieje = await prisma.uzytkownik.findUnique({ where: { email } });
    if (istnieje) {
      res.status(409).json({ sukces: false, wiadomosc: 'Uzytkownik o tym emailu juz istnieje' });
      return;
    }

    const haszHasla = await bcrypt.hash(haslo, 10);

    const uzytkownik = await prisma.uzytkownik.create({
      data: {
        email,
        imie,
        nazwisko,
        haslo: haszHasla,
        rola,
      },
      select: WYBOR_UZYTKOWNIKA,
    });

    res.status(201).json({ sukces: true, dane: uzytkownik });
  } catch {
    odpowiedzBleduSerwera(res);
  }
}

export async function zaktualizujUzytkownika(req: Request, res: Response): Promise<void> {
  try {
    const id = sparsujId(req.params.id);
    if (!id) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nieprawidlowe id uzytkownika' });
      return;
    }

    const imie = typeof req.body?.imie === 'string' ? req.body.imie.trim() : undefined;
    const nazwisko =
      typeof req.body?.nazwisko === 'string' ? req.body.nazwisko.trim() : undefined;
    const aktywny = typeof req.body?.aktywny === 'boolean' ? req.body.aktywny : undefined;
    const rola =
      req.body?.rola === undefined ? undefined : sparsujRole(req.body.rola);

    if (req.body?.rola !== undefined && !rola) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nieprawidlowa rola' });
      return;
    }

    const daneAktualizacji: Prisma.UzytkownikUpdateInput = {};

    if (imie !== undefined) {
      if (!imie) {
        res.status(400).json({ sukces: false, wiadomosc: 'Imie nie moze byc puste' });
        return;
      }
      daneAktualizacji.imie = imie;
    }

    if (nazwisko !== undefined) {
      if (!nazwisko) {
        res.status(400).json({ sukces: false, wiadomosc: 'Nazwisko nie moze byc puste' });
        return;
      }
      daneAktualizacji.nazwisko = nazwisko;
    }

    if (rola) {
      daneAktualizacji.rola = rola;
    }

    if (aktywny !== undefined) {
      daneAktualizacji.aktywny = aktywny;
    }

    if (Object.keys(daneAktualizacji).length === 0) {
      res.status(400).json({ sukces: false, wiadomosc: 'Brak danych do aktualizacji' });
      return;
    }

    const uzytkownik = await prisma.uzytkownik.update({
      where: { id },
      data: daneAktualizacji,
      select: WYBOR_UZYTKOWNIKA,
    });

    res.status(200).json({ sukces: true, dane: uzytkownik });
  } catch (blad) {
    if (blad instanceof Prisma.PrismaClientKnownRequestError && blad.code === 'P2025') {
      res.status(404).json({ sukces: false, wiadomosc: 'Uzytkownik nie istnieje' });
      return;
    }

    odpowiedzBleduSerwera(res);
  }
}

export async function usunUzytkownika(req: Request, res: Response): Promise<void> {
  try {
    const id = sparsujId(req.params.id);
    if (!id) {
      res.status(400).json({ sukces: false, wiadomosc: 'Nieprawidlowe id uzytkownika' });
      return;
    }

    await prisma.uzytkownik.delete({ where: { id } });
    res.status(200).json({ sukces: true, wiadomosc: 'Uzytkownik usuniety' });
  } catch (blad) {
    if (blad instanceof Prisma.PrismaClientKnownRequestError && blad.code === 'P2025') {
      res.status(404).json({ sukces: false, wiadomosc: 'Uzytkownik nie istnieje' });
      return;
    }

    odpowiedzBleduSerwera(res);
  }
}
