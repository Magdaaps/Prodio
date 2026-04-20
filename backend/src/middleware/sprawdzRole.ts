import { Request, Response, NextFunction } from 'express';

export function sprawdzRole(...dozwoloneRole: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rola = req.uzytkownik?.rola;
    if (!rola || !dozwoloneRole.includes(rola)) {
      res.status(403).json({ sukces: false, wiadomosc: 'Brak uprawnień' });
      return;
    }
    next();
  };
}
