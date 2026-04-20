import { Router } from 'express';
import {
  dodajKorekte,
  dodajMagazyn,
  dodajPrzyjecie,
  dodajPrzeniesienie,
  dodajWydanie,
  dodajZamowienieDostawcy,
  pobierzKorekty,
  pobierzDostawcowMagazynu,
  pobierzMagazyny,
  pobierzPrzyjecia,
  pobierzPrzeniesienia,
  pobierzStanyMagazynowe,
  pobierzWydania,
  pobierzZamowieniaDostawcow,
  usunMagazyn,
  usunZamowienieDostawcy,
  zaktualizujMagazyn,
  zaktualizujStatusZamowieniaDostawcy,
} from '../kontrolery/kontrolerMagazynu';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

const trasyMagazynu = Router();

trasyMagazynu.get('/stany', middlewareAutentykacji, pobierzStanyMagazynowe);
trasyMagazynu.get('/dostawcy', middlewareAutentykacji, pobierzDostawcowMagazynu);
trasyMagazynu.get('/magazyny', middlewareAutentykacji, pobierzMagazyny);
trasyMagazynu.post('/magazyny', middlewareAutentykacji, dodajMagazyn);
trasyMagazynu.patch('/magazyny/:id', middlewareAutentykacji, zaktualizujMagazyn);
trasyMagazynu.delete('/magazyny/:id', middlewareAutentykacji, usunMagazyn);
trasyMagazynu.get('/przyjecia', middlewareAutentykacji, pobierzPrzyjecia);
trasyMagazynu.post('/przyjecia', middlewareAutentykacji, dodajPrzyjecie);
trasyMagazynu.get('/wydania', middlewareAutentykacji, pobierzWydania);
trasyMagazynu.post('/wydania', middlewareAutentykacji, dodajWydanie);
trasyMagazynu.get('/korekty', middlewareAutentykacji, pobierzKorekty);
trasyMagazynu.post('/korekty', middlewareAutentykacji, dodajKorekte);
trasyMagazynu.get('/przeniesienia', middlewareAutentykacji, pobierzPrzeniesienia);
trasyMagazynu.post('/przeniesienia', middlewareAutentykacji, dodajPrzeniesienie);
trasyMagazynu.get('/zamowienia-dostawcow', middlewareAutentykacji, pobierzZamowieniaDostawcow);
trasyMagazynu.post('/zamowienia-dostawcow', middlewareAutentykacji, dodajZamowienieDostawcy);
trasyMagazynu.patch('/zamowienia-dostawcow/:id', middlewareAutentykacji, zaktualizujStatusZamowieniaDostawcy);
trasyMagazynu.delete('/zamowienia-dostawcow/:id', middlewareAutentykacji, usunZamowienieDostawcy);

export default trasyMagazynu;
