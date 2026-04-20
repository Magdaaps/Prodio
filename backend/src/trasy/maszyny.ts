import { Router } from 'express';
import {
  pobierzMaszyny,
  pobierzMaszyne,
  utworzMaszyne,
  zaktualizujMaszyne,
  usunMaszyne,
} from '../kontrolery/kontrolerMaszyn';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyMaszyn = Router();

trasyMaszyn.get('/', middlewareAutentykacji, pobierzMaszyny);
trasyMaszyn.get('/:id', middlewareAutentykacji, pobierzMaszyne);
trasyMaszyn.post('/', middlewareAutentykacji, utworzMaszyne);
trasyMaszyn.put('/:id', middlewareAutentykacji, zaktualizujMaszyne);
trasyMaszyn.patch('/:id', middlewareAutentykacji, zaktualizujMaszyne);
trasyMaszyn.delete('/:id', middlewareAutentykacji, usunMaszyne);
