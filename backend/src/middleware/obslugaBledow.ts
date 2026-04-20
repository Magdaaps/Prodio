import { Request, Response, NextFunction } from 'express';

export interface BladAplikacji extends Error {
  statusKod?: number;
  kod?: string;
}

export function obslugaBledow(
  blad: BladAplikacji,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusKod = blad.statusKod || 500;
  const wiadomosc = blad.message || 'Wewnętrzny błąd serwera';

  console.error('[BLAD]', {
    statusKod,
    wiadomosc,
    stos: blad.stack,
    czas: new Date().toISOString()
  });

  res.status(statusKod).json({
    sukces: false,
    wiadomosc,
    kod: blad.kod || 'BLAD_SERWERA'
  });
}
