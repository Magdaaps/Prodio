import { Router } from 'express';
import {
  pobierzPanelTabletowy,
  pobierzPracownikowPaneluTabletowego,
  pobierzPlanProdukcji,
  pobierzZleceniePaneluTabletowego,
  wykonajAkcjeZleceniaPaneluTabletowego,
  zaktualizujStatusZleceniaPlanu,
} from '../kontrolery/kontrolerPlanProdukcji';
import { middlewareAutentykacji } from '../middleware/middlewareAutentykacji';

export const trasyPlanuProdukcji = Router();

trasyPlanuProdukcji.get('/panel-tablet', pobierzPanelTabletowy);
trasyPlanuProdukcji.get('/panel-tablet/pracownicy', pobierzPracownikowPaneluTabletowego);
trasyPlanuProdukcji.get('/panel-tablet/zlecenie/:id', pobierzZleceniePaneluTabletowego);
trasyPlanuProdukcji.post('/panel-tablet/zlecenie/:id/akcja', wykonajAkcjeZleceniaPaneluTabletowego);
trasyPlanuProdukcji.get('/', middlewareAutentykacji, pobierzPlanProdukcji);
trasyPlanuProdukcji.patch('/:id/status', middlewareAutentykacji, zaktualizujStatusZleceniaPlanu);
