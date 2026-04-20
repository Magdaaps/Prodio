import { Router } from 'express';
import {
  pobierzPlanProdukcji,
  zaktualizujStatusZleceniaPlanu,
} from '../kontrolery/kontrolerPlanProdukcji';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyPlanuProdukcji = Router();

trasyPlanuProdukcji.get('/', middlewareAutentykacji, pobierzPlanProdukcji);
trasyPlanuProdukcji.patch('/:id/status', middlewareAutentykacji, zaktualizujStatusZleceniaPlanu);
