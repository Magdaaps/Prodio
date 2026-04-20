import { Router } from 'express';
import {
  pobierzAlertyPulpitu,
  pobierzMetrykiPulpitu,
  pobierzProdukcjePulpitu,
  pobierzPulpit,
  wykonajAkcjePaneluMeldunkowego,
  zalogujDoPaneluMeldunkowego,
} from '../kontrolery/kontrolerPulpitu';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyPulpitu = Router();

trasyPulpitu.post('/checkin/logowanie', zalogujDoPaneluMeldunkowego);
trasyPulpitu.post('/checkin/akcja', wykonajAkcjePaneluMeldunkowego);

trasyPulpitu.get('/', middlewareAutentykacji, pobierzPulpit);
trasyPulpitu.get('/produkcja', middlewareAutentykacji, pobierzProdukcjePulpitu);
trasyPulpitu.get('/metryki', middlewareAutentykacji, pobierzMetrykiPulpitu);
trasyPulpitu.get('/alerty', middlewareAutentykacji, pobierzAlertyPulpitu);
