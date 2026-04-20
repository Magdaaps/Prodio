import { Router } from 'express';
import {
  dodajDostawce,
  pobierzDostawcow,
  pobierzSurowceDostawcy,
  usunDostawce,
  zaktualizujDostawce,
} from '../kontrolery/kontrolerDostawcow';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyDostawcow = Router();

trasyDostawcow.use(middlewareAutentykacji);
trasyDostawcow.get('/', pobierzDostawcow);
trasyDostawcow.post('/', dodajDostawce);
trasyDostawcow.get('/:id/surowce', pobierzSurowceDostawcy);
trasyDostawcow.patch('/:id', zaktualizujDostawce);
trasyDostawcow.delete('/:id', usunDostawce);
