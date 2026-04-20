import { Router } from 'express';
import {
  pobierzGrupyProduktow,
  pobierzProdukty,
  pobierzProdukt,
  utworzProdukt,
  zaktualizujProdukt,
  usunProdukt,
  pobierzOperacjeProduktu,
  dodajOperacje,
  zaktualizujOperacje,
  usunOperacje,
  pobierzSurowceProduktu,
  dodajSurowiecProduktu,
  zaktualizujSurowiecProduktu,
  usunSurowiecProduktu,
} from '../kontrolery/kontrolerProduktow';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyProduktow = Router();

trasyProduktow.get('/grupy', middlewareAutentykacji, pobierzGrupyProduktow);
trasyProduktow.get('/', middlewareAutentykacji, pobierzProdukty);
trasyProduktow.get('/:id', middlewareAutentykacji, pobierzProdukt);
trasyProduktow.post('/', middlewareAutentykacji, utworzProdukt);
trasyProduktow.put('/:id', middlewareAutentykacji, zaktualizujProdukt);
trasyProduktow.delete('/:id', middlewareAutentykacji, usunProdukt);
trasyProduktow.get('/:id/operacje', middlewareAutentykacji, pobierzOperacjeProduktu);
trasyProduktow.post('/:id/operacje', middlewareAutentykacji, dodajOperacje);
trasyProduktow.put('/:id/operacje/:opId', middlewareAutentykacji, zaktualizujOperacje);
trasyProduktow.delete('/:id/operacje/:opId', middlewareAutentykacji, usunOperacje);
trasyProduktow.get('/:id/surowce', middlewareAutentykacji, pobierzSurowceProduktu);
trasyProduktow.post('/:id/surowce', middlewareAutentykacji, dodajSurowiecProduktu);
trasyProduktow.put('/:id/surowce/:surowiecBomId', middlewareAutentykacji, zaktualizujSurowiecProduktu);
trasyProduktow.delete('/:id/surowce/:surowiecBomId', middlewareAutentykacji, usunSurowiecProduktu);
