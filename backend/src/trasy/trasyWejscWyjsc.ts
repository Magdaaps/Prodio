import { Router } from 'express';
import {
  dodajDzienWolny,
  pobierzDniWolne,
  pobierzKalendarz,
  pobierzKartePracy,
  pobierzPauzy,
  pobierzRejestracje,
  usunDzienWolny,
} from '../kontrolery/kontrolerWejscWyjsc';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

const trasyWejscWyjsc = Router();

trasyWejscWyjsc.get('/', middlewareAutentykacji, pobierzRejestracje);
trasyWejscWyjsc.get('/pauzy', middlewareAutentykacji, pobierzPauzy);
trasyWejscWyjsc.get('/dni-wolne', middlewareAutentykacji, pobierzDniWolne);
trasyWejscWyjsc.post('/dni-wolne', middlewareAutentykacji, dodajDzienWolny);
trasyWejscWyjsc.delete('/dni-wolne/:id', middlewareAutentykacji, usunDzienWolny);
trasyWejscWyjsc.get('/karta-pracy', middlewareAutentykacji, pobierzKartePracy);
trasyWejscWyjsc.get('/kalendarz', middlewareAutentykacji, pobierzKalendarz);

export default trasyWejscWyjsc;
