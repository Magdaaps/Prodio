import { Router } from 'express';
import {
  pobierzPracownikow,
  pobierzPracownika,
  utworzPracownika,
  zaktualizujPracownika,
  usunPracownika
} from '../kontrolery/kontrolerPracownikow';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyPracownikow = Router();

trasyPracownikow.get('/', middlewareAutentykacji, pobierzPracownikow);
trasyPracownikow.get('/:id', middlewareAutentykacji, pobierzPracownika);
trasyPracownikow.post('/', middlewareAutentykacji, utworzPracownika);
trasyPracownikow.put('/:id', middlewareAutentykacji, zaktualizujPracownika);
trasyPracownikow.delete('/:id', middlewareAutentykacji, usunPracownika);
