import { Router } from 'express';
import { zaloguj, wyloguj, odswiez, pobierzMnie } from '../kontrolery/kontrolerAutentykacji';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyAutentykacji = Router();

trasyAutentykacji.post('/zaloguj', zaloguj);
trasyAutentykacji.post('/wyloguj', wyloguj);
trasyAutentykacji.post('/odswiez', odswiez);
trasyAutentykacji.get('/mnie', middlewareAutentykacji, pobierzMnie);
