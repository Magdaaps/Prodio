import { Router } from 'express';
import {
  pobierzLiczbeZaleglychZamowien,
  pobierzZamowienia,
  pobierzZamowienie,
  utworzZamowienie,
  zaktualizujZamowienie,
  usunZamowienie
} from '../kontrolery/kontrolerZamowien';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyZamowien = Router();

trasyZamowien.get('/', middlewareAutentykacji, pobierzZamowienia);
trasyZamowien.get('/zalegle/liczba', middlewareAutentykacji, pobierzLiczbeZaleglychZamowien);
trasyZamowien.get('/:id', middlewareAutentykacji, pobierzZamowienie);
trasyZamowien.post('/', middlewareAutentykacji, utworzZamowienie);
trasyZamowien.put('/:id', middlewareAutentykacji, zaktualizujZamowienie);
trasyZamowien.delete('/:id', middlewareAutentykacji, usunZamowienie);
