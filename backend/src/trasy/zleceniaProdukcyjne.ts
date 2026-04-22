import { Router } from 'express';
import {
  inicjalizujZleceniaDlaZamowienia,
  pobierzListeZlecenProdukcyjnych,
  pobierzZlecenieProdukcyjne,
  utworzZlecenieProdukcyjne,
  zaktualizujZlecenieProdukcyjne,
  usunZlecenieProdukcyjne,
} from '../kontrolery/kontrolerZlecenProdukcyjnych';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyZlecenProdukcyjnych = Router();

trasyZlecenProdukcyjnych.get('/', middlewareAutentykacji, pobierzListeZlecenProdukcyjnych);
trasyZlecenProdukcyjnych.post('/inicjalizuj-zamowienie', middlewareAutentykacji, inicjalizujZleceniaDlaZamowienia);
trasyZlecenProdukcyjnych.get('/:id', middlewareAutentykacji, pobierzZlecenieProdukcyjne);
trasyZlecenProdukcyjnych.post('/', middlewareAutentykacji, utworzZlecenieProdukcyjne);
trasyZlecenProdukcyjnych.put('/:id', middlewareAutentykacji, zaktualizujZlecenieProdukcyjne);
trasyZlecenProdukcyjnych.delete('/:id', middlewareAutentykacji, usunZlecenieProdukcyjne);
