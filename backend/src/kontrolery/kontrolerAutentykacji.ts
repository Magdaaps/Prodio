import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const JWT_SEKRET = process.env.JWT_SEKRET || 'dev_sekret';
const JWT_ODSWIEZANIE_SEKRET =
  process.env.JWT_ODSWIEZANIE_SEKRET || 'dev_odswiezanie';
const JWT_WYGASANIE = process.env.JWT_WYGASANIE || '15m';
const JWT_ODSWIEZANIE_WYGASANIE =
  process.env.JWT_ODSWIEZANIE_WYGASANIE || '7d';
const OPCJE_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

function ustawCiasteczka(
  res: Response,
  tokenDostepu: string,
  tokenOdswiezania: string
): void {
  res.cookie('token_dostepu', tokenDostepu, {
    ...OPCJE_COOKIE,
    expires: new Date(Date.now() + 15 * 60 * 1000),
  });

  res.cookie('token_odswiezania', tokenOdswiezania, {
    ...OPCJE_COOKIE,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

export async function zaloguj(req: Request, res: Response): Promise<void> {
  try {
    const { email, haslo } = req.body as {
      email?: string;
      haslo?: string;
    };

    if (!email || !haslo) {
      res
        .status(400)
        .json({ sukces: false, wiadomosc: 'Email i hasło są wymagane' });
      return;
    }

    const uzytkownik = await prisma.uzytkownik.findUnique({
      where: { email },
    });

    if (!uzytkownik || !uzytkownik.aktywny) {
      res
        .status(401)
        .json({ sukces: false, wiadomosc: 'Nieprawidłowe dane logowania' });
      return;
    }

    const poprawneHaslo = await bcrypt.compare(haslo, uzytkownik.haslo);

    if (!poprawneHaslo) {
      res
        .status(401)
        .json({ sukces: false, wiadomosc: 'Nieprawidłowe dane logowania' });
      return;
    }

    const tokenDostepu = jwt.sign(
      {
        id: uzytkownik.id,
        email: uzytkownik.email,
        rola: uzytkownik.rola,
      },
      JWT_SEKRET,
      { expiresIn: JWT_WYGASANIE as jwt.SignOptions['expiresIn'] }
    );

    const tokenOdswiezania = jwt.sign(
      { id: uzytkownik.id, jti: randomUUID() },
      JWT_ODSWIEZANIE_SEKRET,
      {
        expiresIn:
          JWT_ODSWIEZANIE_WYGASANIE as jwt.SignOptions['expiresIn'],
      }
    );

    const wygasaW = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
      await prisma.tokenOdswiezania.deleteMany({
        where: { uzytkownikId: uzytkownik.id },
      });

      await prisma.tokenOdswiezania.create({
        data: {
          token: tokenOdswiezania,
          uzytkownikId: uzytkownik.id,
          wygasaW,
        },
      });
    } catch (blad) {
      console.error('[autentykacja:zaloguj] zapis tokenu odswiezania nie powiodl sie', blad);
    }

    ustawCiasteczka(res, tokenDostepu, tokenOdswiezania);

    res.status(200).json({
      sukces: true,
      dane: {
        id: uzytkownik.id,
        email: uzytkownik.email,
        imie: uzytkownik.imie,
        nazwisko: uzytkownik.nazwisko,
        rola: uzytkownik.rola,
      },
    });
  } catch (blad) {
    console.error('[autentykacja:zaloguj]', blad);
    const wiadomosc = blad instanceof Error ? blad.message : 'Blad serwera';
    res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' });
  }
}

export async function wyloguj(req: Request, res: Response): Promise<void> {
  try {
    const tokenOdswiezania = req.cookies?.token_odswiezania as
      | string
      | undefined;

    if (tokenOdswiezania) {
      try {
        await prisma.tokenOdswiezania.deleteMany({
          where: { token: tokenOdswiezania },
        });
      } catch {
        // Ignorujemy błąd usuwania tokenu, aby dokończyć wylogowanie po stronie klienta.
      }
    }

    res.clearCookie('token_dostepu');
    res.clearCookie('token_odswiezania');

    res
      .status(200)
      .json({ sukces: true, wiadomosc: 'Wylogowano pomyślnie' });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' });
  }
}

export async function odswiez(req: Request, res: Response): Promise<void> {
  try {
    const tokenOdswiezania = req.cookies?.token_odswiezania as
      | string
      | undefined;

    if (!tokenOdswiezania) {
      res
        .status(401)
        .json({ sukces: false, wiadomosc: 'Brak tokenu odświeżania' });
      return;
    }

    try {
      jwt.verify(tokenOdswiezania, JWT_ODSWIEZANIE_SEKRET);
    } catch {
      res.status(401).json({ sukces: false, wiadomosc: 'Brak tokenu odświeżania' });
      return;
    }

    const zapisanyToken = await prisma.tokenOdswiezania.findUnique({
      where: { token: tokenOdswiezania },
      include: { uzytkownik: true },
    });

    if (!zapisanyToken || zapisanyToken.wygasaW < new Date()) {
      res.status(401).json({
        sukces: false,
        wiadomosc: 'Token odświeżania wygasł lub jest nieważny',
      });
      return;
    }

    const tokenDostepu = jwt.sign(
      {
        id: zapisanyToken.uzytkownik.id,
        email: zapisanyToken.uzytkownik.email,
        rola: zapisanyToken.uzytkownik.rola,
      },
      JWT_SEKRET,
      { expiresIn: JWT_WYGASANIE as jwt.SignOptions['expiresIn'] }
    );

    res.cookie('token_dostepu', tokenDostepu, {
      ...OPCJE_COOKIE,
      expires: new Date(Date.now() + 15 * 60 * 1000),
    });

    res
      .status(200)
      .json({ sukces: true, wiadomosc: 'Token odświeżony' });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' });
  }
}

export async function pobierzMnie(req: Request, res: Response): Promise<void> {
  try {
    const id = req.uzytkownik?.id;

    if (!id) {
      res.status(401).json({ sukces: false, wiadomosc: 'Brak autoryzacji' });
      return;
    }

    const uzytkownik = await prisma.uzytkownik.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        imie: true,
        nazwisko: true,
        rola: true,
        aktywny: true,
      },
    });

    if (!uzytkownik) {
      res
        .status(404)
        .json({ sukces: false, wiadomosc: 'Użytkownik nie istnieje' });
      return;
    }

    res.status(200).json({ sukces: true, dane: uzytkownik });
  } catch {
    res.status(500).json({ sukces: false, wiadomosc: 'Błąd serwera' });
  }
}
