import { Router } from 'express';
import {
  pobierzHistoriePracy,
  pobierzRaportDziennyHistoriiPracy,
  utworzManualnyWpisHistoriiPracy,
} from '../kontrolery/kontrolerHistoriiPracy';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyHistoriiPracy = Router();

trasyHistoriiPracy.get('/', middlewareAutentykacji, pobierzHistoriePracy);
trasyHistoriiPracy.post('/', middlewareAutentykacji, utworzManualnyWpisHistoriiPracy);
trasyHistoriiPracy.get('/raport-dzienny', middlewareAutentykacji, pobierzRaportDziennyHistoriiPracy);
