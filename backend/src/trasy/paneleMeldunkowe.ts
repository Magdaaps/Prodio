import { Router } from 'express';
import {
  pobierzPanele,
  pobierzPanel,
  utworzPanel,
  zaktualizujPanel,
  usunPanel,
} from '../kontrolery/kontrolerPaneliMeldunkowych';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyPaneliMeldunkowych = Router();

trasyPaneliMeldunkowych.get('/', middlewareAutentykacji, pobierzPanele);
trasyPaneliMeldunkowych.get('/:id', middlewareAutentykacji, pobierzPanel);
trasyPaneliMeldunkowych.post('/', middlewareAutentykacji, utworzPanel);
trasyPaneliMeldunkowych.put('/:id', middlewareAutentykacji, zaktualizujPanel);
trasyPaneliMeldunkowych.delete('/:id', middlewareAutentykacji, usunPanel);
