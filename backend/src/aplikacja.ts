import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { trasyAutentykacji } from './trasy/autentykacja';
import { trasyKlientow } from './trasy/klienci';
import { trasyProduktow } from './trasy/produkty';
import { trasyGrupProduktow } from './trasy/grupyProduktow';
import { trasyZamowien } from './trasy/zamowienia';
import { trasyZlecenProdukcyjnych } from './trasy/zleceniaProdukcyjne';
import { trasyMaszyn } from './trasy/maszyny';
import { trasyPracownikow } from './trasy/pracownicy';
import { trasyPlanuProdukcji } from './trasy/planProdukcji';
import { trasySurowcow } from './trasy/surowce';
import { trasyUzytkownikow } from './trasy/uzytkownicy';
import { trasyHistoriiPracy } from './trasy/historiaPracy';
import { trasyPulpitu } from './trasy/pulpit';
import { trasyDostawcow } from './trasy/dostawcy';
import trasyWejscWyjsc from './trasy/trasyWejscWyjsc';
import trasyMagazynu from './trasy/trasyMagazynu';
import { trasyPaneliMeldunkowych } from './trasy/paneleMeldunkowe';
import { obslugaBledow } from './middleware/obslugaBledow';

const aplikacja = express();

aplikacja.use(cors({ origin: 'http://localhost:5173', credentials: true }));
aplikacja.use(express.json({ limit: '10mb' }));
aplikacja.use(cookieParser());

aplikacja.use('/api/autentykacja', trasyAutentykacji);
aplikacja.use('/api/klienci', trasyKlientow);
aplikacja.use('/api/produkty', trasyProduktow);
aplikacja.use('/api/grupy-produktow', trasyGrupProduktow);
aplikacja.use('/api/zamowienia', trasyZamowien);
aplikacja.use('/api/zlecenia-produkcyjne', trasyZlecenProdukcyjnych);
aplikacja.use('/api/plan-produkcji', trasyPlanuProdukcji);
aplikacja.use('/api/maszyny', trasyMaszyn);
aplikacja.use('/api/pracownicy', trasyPracownikow);
aplikacja.use('/api/surowce', trasySurowcow);
aplikacja.use('/api/uzytkownicy', trasyUzytkownikow);
aplikacja.use('/api/historia-pracy', trasyHistoriiPracy);
aplikacja.use('/api/pulpit', trasyPulpitu);
aplikacja.use('/api/dostawcy', trasyDostawcow);
aplikacja.use('/api/wejscia-wyjscia', trasyWejscWyjsc);
aplikacja.use('/api/magazyn', trasyMagazynu);
aplikacja.use('/api/panele-meldunkowe', trasyPaneliMeldunkowych);

aplikacja.get('/api/zdrowie', (_req, res) => {
  res.json({ status: 'ok', wersja: '1.0.0' });
});

aplikacja.use(obslugaBledow);

const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'test') {
  aplikacja.listen(PORT, () => {
    console.log('Serwer uruchomiony na porcie ' + PORT);
  });
}

export default aplikacja;
