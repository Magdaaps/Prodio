import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface DaneJwt {
  id: number;
  email: string;
  rola: string;
}

declare global {
  namespace Express {
    interface Request {
      uzytkownik?: DaneJwt;
    }
  }
}

export function middlewareAutentykacji(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const tokenDostepu = req.cookies?.token_dostepu;

  if (!tokenDostepu) {
    res.status(401).json({ sukces: false, wiadomosc: 'Brak tokenu dostępu' });
    return;
  }

  try {
    const sekret = process.env.JWT_SEKRET || '';
    const zdekodowany = jwt.verify(tokenDostepu, sekret) as DaneJwt;
    req.uzytkownik = zdekodowany;
    next();
  } catch {
    res.status(401).json({ sukces: false, wiadomosc: 'Nieważny lub wygasły token' });
  }
}
