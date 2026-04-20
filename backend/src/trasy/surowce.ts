import { Router } from 'express';
import {
  pobierzSurowce,
  pobierzSurowiec,
  utworzSurowiec,
  zaktualizujSurowiec,
  usunSurowiec
} from '../kontrolery/kontrolerSurowcow';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasySurowcow = Router();

trasySurowcow.get('/', middlewareAutentykacji, pobierzSurowce);
trasySurowcow.get('/:id', middlewareAutentykacji, pobierzSurowiec);
trasySurowcow.post('/', middlewareAutentykacji, utworzSurowiec);
trasySurowcow.put('/:id', middlewareAutentykacji, zaktualizujSurowiec);
trasySurowcow.delete('/:id', middlewareAutentykacji, usunSurowiec);
