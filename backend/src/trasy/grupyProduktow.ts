import { Router } from 'express';
import {
  pobierzGrupyProduktow,
  utworzGrupe,
  zaktualizujGrupe,
  usunGrupe
} from '../kontrolery/kontrolerGrupProduktow';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyGrupProduktow = Router();

trasyGrupProduktow.get('/', middlewareAutentykacji, pobierzGrupyProduktow);
trasyGrupProduktow.post('/', middlewareAutentykacji, utworzGrupe);
trasyGrupProduktow.put('/:id', middlewareAutentykacji, zaktualizujGrupe);
trasyGrupProduktow.delete('/:id', middlewareAutentykacji, usunGrupe);
