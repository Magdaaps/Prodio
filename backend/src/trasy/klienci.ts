import { Router } from 'express';
import {
  pobierzKlientow,
  pobierzKlienta,
  utworzKlienta,
  zaktualizujKlienta,
  usunKlienta
} from '../kontrolery/kontrolerKlientow';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyKlientow = Router();

trasyKlientow.get('/', middlewareAutentykacji, pobierzKlientow);
trasyKlientow.get('/:id', middlewareAutentykacji, pobierzKlienta);
trasyKlientow.post('/', middlewareAutentykacji, utworzKlienta);
trasyKlientow.put('/:id', middlewareAutentykacji, zaktualizujKlienta);
trasyKlientow.delete('/:id', middlewareAutentykacji, usunKlienta);
