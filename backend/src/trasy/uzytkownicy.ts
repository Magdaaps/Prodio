import { Router } from 'express';
import {
  pobierzUzytkownikow,
  utworzUzytkownika,
  zaktualizujUzytkownika,
  usunUzytkownika,
} from '../kontrolery/kontrolerUzytkownikow';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';
import { sprawdzRole } from '../middleware/sprawdzRole';

export const trasyUzytkownikow = Router();

trasyUzytkownikow.use(middlewareAutentykacji, sprawdzRole('ADMIN'));

trasyUzytkownikow.get('/', pobierzUzytkownikow);
trasyUzytkownikow.post('/', utworzUzytkownika);
trasyUzytkownikow.put('/:id', zaktualizujUzytkownika);
trasyUzytkownikow.delete('/:id', usunUzytkownika);
