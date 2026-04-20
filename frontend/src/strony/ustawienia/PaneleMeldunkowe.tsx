import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, Eye, Monitor, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import klientApi from '../../api/klient';
import TabelaDanych from '../../komponenty/TabelaDanych';
import Modal from '../../komponenty/ui/Modal';
import Pole from '../../komponenty/ui/Pole';
import Przycisk from '../../komponenty/ui/Przycisk';
import Rozwijane from '../../komponenty/ui/Rozwijane';
import { useTabelaDanych } from '../../hooki/useTabelaDanych';
import type { KolumnaTabeliDanych } from '../../typy/indeks';

interface PanelMeldunkowy {
  id: number;
  nazwa: string;
  login: string | null;
  haslo: string | null;
  geolokalizacjaWlaczona: boolean;
  pokazLokalizacjeTimeline: boolean;
  aktywny: boolean;
  _count?: {
    maszyny: number;
  };
}

function IkonaBool({ wartosc }: { wartosc: boolean }) {
  return wartosc ? (
    <Check size={16} className='text-green-500' />
  ) : (
    <X size={16} className='text-red-500' />
  );
}

interface OdpowiedzListyPaneliMeldunkowych {
  sukces: boolean;
  dane: PanelMeldunkowy[];
  lacznie: number;
  strona: number;
  iloscNaStrone: number;
  wiadomosc?: string;
}

interface OdpowiedzObiektu<T> {
  sukces: boolean;
  dane: T;
  wiadomosc?: string;
}

interface FormularzTworzenia {
  nazwa: string;
  login: string;
  haslo: string;
  geolokalizacjaWlaczona: boolean;
  pokazLokalizacjeTimeline: boolean;
}

interface FormularzEdycji {
  nazwa: string;
  login: string;
  haslo: string;
  geolokalizacjaWlaczona: boolean;
  pokazLokalizacjeTimeline: boolean;
}

const PUSTY_FORMULARZ_TWORZENIA: FormularzTworzenia = {
  nazwa: '',
  login: '',
  haslo: '',
  geolokalizacjaWlaczona: false,
  pokazLokalizacjeTimeline: false,
};

const PUSTY_FORMULARZ_EDYCJI: FormularzEdycji = {
  nazwa: '',
  login: '',
  haslo: '',
  geolokalizacjaWlaczona: false,
  pokazLokalizacjeTimeline: false,
};

function mapujBlad(blad: unknown, fallback: string): string {
  if (
    typeof blad === 'object' &&
    blad !== null &&
    'response' in blad &&
    typeof (blad as { response?: { data?: { wiadomosc?: unknown } } }).response?.data?.wiadomosc ===
      'string'
  ) {
    return (blad as { response: { data: { wiadomosc: string } } }).response.data.wiadomosc;
  }

  return fallback;
}

export default function PaneleMeldunkowe() {
  const {
    strona,
    iloscNaStrone,
    kluczSortowania,
    kierunekSortowania,
    onZmianaStrony,
    onSortowanie,
    resetujStrone,
  } = useTabelaDanych(10);
  const [panele, ustawPanele] = useState<PanelMeldunkowy[]>([]);
  const [lacznie, ustawLacznie] = useState(0);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [odswiezanie, ustawOdswiezanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [czyModalDodawaniaOtwarty, ustawCzyModalDodawaniaOtwarty] = useState(false);
  const [czyModalEdycjiOtwarty, ustawCzyModalEdycjiOtwarty] = useState(false);
  const [czyModalPodgladuOtwarty, ustawCzyModalPodgladuOtwarty] = useState(false);
  const [formularzTworzenia, ustawFormularzTworzenia] =
    useState<FormularzTworzenia>(PUSTY_FORMULARZ_TWORZENIA);
  const [formularzEdycji, ustawFormularzEdycji] =
    useState<FormularzEdycji>(PUSTY_FORMULARZ_EDYCJI);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [usuwanieId, ustawUsuwanieId] = useState<number | null>(null);
  const [aktywnyPanel, ustawAktywnyPanel] = useState<PanelMeldunkowy | null>(null);
  const [panelPodgladu, ustawPanelPodgladu] = useState<PanelMeldunkowy | null>(null);

  const pobierzPanele = async (pokazPelneLadowanie = false) => {
    if (pokazPelneLadowanie) {
      ustawLadowanie(true);
    } else {
      ustawOdswiezanie(true);
    }

    ustawBlad('');

    try {
      const odpowiedz = await klientApi.get<OdpowiedzListyPaneliMeldunkowych>('/panele-meldunkowe', {
        params: {
          strona,
          iloscNaStrone,
          sortPole: kluczSortowania,
          sortKierunek: kierunekSortowania,
        },
      });

      ustawPanele(odpowiedz.data.dane ?? []);
      ustawLacznie(odpowiedz.data.lacznie ?? 0);
    } catch (bladPobierania) {
      ustawBlad(mapujBlad(bladPobierania, 'Nie udalo sie pobrac listy paneli meldunkowych.'));
      ustawPanele([]);
      ustawLacznie(0);
    } finally {
      ustawLadowanie(false);
      ustawOdswiezanie(false);
    }
  };

  useEffect(() => {
    void pobierzPanele(true);
  }, [strona, iloscNaStrone, kluczSortowania, kierunekSortowania]);

  const otworzPodglad = (panel: PanelMeldunkowy) => {
    ustawPanelPodgladu(panel);
    ustawCzyModalPodgladuOtwarty(true);
  };

  const zamknijPodglad = () => {
    ustawCzyModalPodgladuOtwarty(false);
    ustawPanelPodgladu(null);
  };

  const otworzEdycje = (panel: PanelMeldunkowy) => {
    ustawAktywnyPanel(panel);
    ustawFormularzEdycji({
      nazwa: panel.nazwa,
      login: panel.login ?? '',
      haslo: panel.haslo ?? '',
      geolokalizacjaWlaczona: panel.geolokalizacjaWlaczona,
      pokazLokalizacjeTimeline: panel.pokazLokalizacjeTimeline,
    });
    ustawCzyModalEdycjiOtwarty(true);
  };

  const zamknijDodawanie = () => {
    ustawCzyModalDodawaniaOtwarty(false);
    ustawFormularzTworzenia(PUSTY_FORMULARZ_TWORZENIA);
  };

  const zamknijEdycje = () => {
    ustawCzyModalEdycjiOtwarty(false);
    ustawAktywnyPanel(null);
    ustawFormularzEdycji(PUSTY_FORMULARZ_EDYCJI);
  };

  const obsluzDodawanie = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    ustawZapisywanie(true);
    ustawBlad('');

    try {
      await klientApi.post<OdpowiedzObiektu<PanelMeldunkowy>>('/panele-meldunkowe', formularzTworzenia);
      zamknijDodawanie();
      resetujStrone();
      await pobierzPanele(true);
    } catch (bladZapisu) {
      ustawBlad(mapujBlad(bladZapisu, 'Nie udalo sie utworzyc panelu meldunkowego.'));
    } finally {
      ustawZapisywanie(false);
    }
  };

  const obsluzEdycje = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!aktywnyPanel) {
      return;
    }

    ustawZapisywanie(true);
    ustawBlad('');

    try {
      await klientApi.put<OdpowiedzObiektu<PanelMeldunkowy>>(
        `/panele-meldunkowe/${aktywnyPanel.id}`,
        formularzEdycji
      );
      zamknijEdycje();
      await pobierzPanele(true);
    } catch (bladZapisu) {
      ustawBlad(mapujBlad(bladZapisu, 'Nie udalo sie zaktualizowac panelu meldunkowego.'));
    } finally {
      ustawZapisywanie(false);
    }
  };

  const usunPanel = async (panel: PanelMeldunkowy) => {
    const potwierdzone = window.confirm(`Usunac panel meldunkowy ${panel.nazwa}?`);

    if (!potwierdzone) {
      return;
    }

    ustawUsuwanieId(panel.id);
    ustawBlad('');

    try {
      await klientApi.delete(`/panele-meldunkowe/${panel.id}`);
      await pobierzPanele(true);
    } catch (bladUsuwania) {
      ustawBlad(mapujBlad(bladUsuwania, 'Nie udalo sie usunac panelu meldunkowego.'));
    } finally {
      ustawUsuwanieId(null);
    }
  };

  const kolumny = useMemo<KolumnaTabeliDanych<PanelMeldunkowy>[]>(
    () => [
      {
        klucz: 'id',
        naglowek: '#',
        sortowalny: true,
      },
      {
        klucz: 'nazwa',
        naglowek: 'Nazwa',
        sortowalny: true,
      },
      {
        klucz: 'login',
        naglowek: 'Login',
        renderuj: (panel) => panel.login || '-',
      },
      {
        klucz: 'haslo',
        naglowek: 'Hasło',
        renderuj: (panel) => panel.haslo || '-',
      },
      {
        klucz: 'geolokalizacjaWlaczona',
        naglowek: 'Geolokalizacja włączona',
        renderuj: (panel) => <IkonaBool wartosc={panel.geolokalizacjaWlaczona} />,
      },
      {
        klucz: 'pokazLokalizacjeTimeline',
        naglowek: 'Pokaż lokalizację na timeline również dla pracowników',
        renderuj: (panel) => <IkonaBool wartosc={panel.pokazLokalizacjeTimeline} />,
      },
      {
        klucz: 'akcje',
        naglowek: 'Akcje',
        renderuj: (panel) => (
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => otworzPodglad(panel)}
              className='rounded-md border border-obramowanie p-2 text-tekst-drugorzedny transition-colors hover:border-akcent hover:text-akcent'
              aria-label={`Podglad ${panel.nazwa}`}
            >
              <Eye size={16} />
            </button>
            <button
              type='button'
              onClick={() => otworzEdycje(panel)}
              className='rounded-md border border-obramowanie p-2 text-tekst-drugorzedny transition-colors hover:border-akcent hover:text-akcent'
              aria-label={`Edytuj ${panel.nazwa}`}
            >
              <Pencil size={16} />
            </button>
            <button
              type='button'
              onClick={() => void usunPanel(panel)}
              disabled={usuwanieId === panel.id}
              className='rounded-md border border-obramowanie p-2 text-tekst-drugorzedny transition-colors hover:border-red-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60'
              aria-label={`Usun ${panel.nazwa}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ),
      },
    ],
    [usuwanieId]
  );

  return (
    <div className='space-y-6'>
      <section className='rounded-2xl border border-obramowanie bg-tlo-karta p-6 shadow-sm'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='space-y-2'>
            <div className='inline-flex items-center gap-2 rounded-full border border-obramowanie bg-tlo-glowne px-3 py-1 text-xs uppercase tracking-[0.22em] text-tekst-drugorzedny'>
              <Monitor size={14} />
              Ustawienia systemowe
            </div>
            <div>
              <h1 className='text-3xl font-semibold text-tekst-glowny'>Panele meldunkowe</h1>
              <p className='mt-2 max-w-2xl text-sm text-tekst-drugorzedny'>
                Zarzadzanie panelami meldunkowymi przypisanymi do maszyn produkcyjnych.
              </p>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <Przycisk
              wariant='drugorzedny'
              onClick={() => void pobierzPanele(false)}
              czyLaduje={odswiezanie}
            >
              <RefreshCw size={16} />
              Odswiez
            </Przycisk>
            <Przycisk onClick={() => ustawCzyModalDodawaniaOtwarty(true)}>
              <Plus size={16} />
              Dodaj panel
            </Przycisk>
          </div>
        </div>
      </section>

      {blad ? (
        <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300'>
          {blad}
        </div>
      ) : null}

      <section className='rounded-2xl border border-obramowanie bg-tlo-karta p-6 shadow-sm'>
        <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <div className='rounded-2xl bg-akcent/10 p-3 text-akcent'>
              <Monitor size={22} />
            </div>
            <div>
              <h2 className='text-lg font-semibold text-tekst-glowny'>Lista paneli meldunkowych</h2>
              <p className='text-sm text-tekst-drugorzedny'>
                Lacznie: {lacznie}. Widoczne rekordy mozna sortowac i edytowac.
              </p>
            </div>
          </div>
        </div>

        <TabelaDanych
          kolumny={kolumny}
          dane={panele}
          ladowanie={ladowanie}
          stronaPaginacji={strona}
          iloscNaStrone={iloscNaStrone}
          lacznie={lacznie}
          onZmianaStrony={onZmianaStrony}
          onSortowanie={onSortowanie}
        />
      </section>

      <Modal
        czyOtwarty={czyModalPodgladuOtwarty}
        onZamknij={zamknijPodglad}
        tytul={`Panel: ${panelPodgladu?.nazwa ?? ''}`}
        akcje={
          <Przycisk wariant='drugorzedny' onClick={zamknijPodglad}>
            Zamknij
          </Przycisk>
        }
      >
        {panelPodgladu ? (
          <div className='grid gap-3 text-sm'>
            <div className='flex justify-between border-b border-obramowanie pb-2'>
              <span className='text-tekst-drugorzedny'>Login</span>
              <span className='font-mono font-medium text-tekst-glowny'>{panelPodgladu.login || '-'}</span>
            </div>
            <div className='flex justify-between border-b border-obramowanie pb-2'>
              <span className='text-tekst-drugorzedny'>Hasło</span>
              <span className='font-mono font-medium text-tekst-glowny'>{panelPodgladu.haslo || '-'}</span>
            </div>
            <div className='flex items-center justify-between border-b border-obramowanie pb-2'>
              <span className='text-tekst-drugorzedny'>Geolokalizacja włączona</span>
              <IkonaBool wartosc={panelPodgladu.geolokalizacjaWlaczona} />
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-tekst-drugorzedny'>Pokaż lokalizację na timeline</span>
              <IkonaBool wartosc={panelPodgladu.pokazLokalizacjeTimeline} />
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        czyOtwarty={czyModalDodawaniaOtwarty}
        onZamknij={zamknijDodawanie}
        tytul='Dodaj panel meldunkowy'
        akcje={
          <>
            <Przycisk wariant='drugorzedny' onClick={zamknijDodawanie}>
              Anuluj
            </Przycisk>
            <Przycisk form='formularz-dodawania-panelu-meldunkowego' type='submit' czyLaduje={zapisywanie}>
              Zapisz
            </Przycisk>
          </>
        }
      >
        <form
          id='formularz-dodawania-panelu-meldunkowego'
          className='grid gap-4 md:grid-cols-2'
          onSubmit={obsluzDodawanie}
        >
          <div className='md:col-span-2'>
            <Pole
              etykieta='Nazwa'
              required
              value={formularzTworzenia.nazwa}
              onChange={(event) =>
                ustawFormularzTworzenia((poprzedni) => ({ ...poprzedni, nazwa: event.target.value }))
              }
            />
          </div>
          <Pole
            etykieta='Login'
            value={formularzTworzenia.login}
            onChange={(event) =>
              ustawFormularzTworzenia((poprzedni) => ({ ...poprzedni, login: event.target.value }))
            }
          />
          <Pole
            etykieta='Hasło'
            value={formularzTworzenia.haslo}
            onChange={(event) =>
              ustawFormularzTworzenia((poprzedni) => ({ ...poprzedni, haslo: event.target.value }))
            }
          />
          <Rozwijane
            etykieta='Geolokalizacja włączona'
            wartosc={formularzTworzenia.geolokalizacjaWlaczona ? 'true' : 'false'}
            onZmiana={(wartosc) =>
              ustawFormularzTworzenia((poprzedni) => ({ ...poprzedni, geolokalizacjaWlaczona: wartosc === 'true' }))
            }
            opcje={[
              { wartosc: 'true', etykieta: 'Tak' },
              { wartosc: 'false', etykieta: 'Nie' },
            ]}
          />
          <Rozwijane
            etykieta='Pokaż lokalizację na timeline'
            wartosc={formularzTworzenia.pokazLokalizacjeTimeline ? 'true' : 'false'}
            onZmiana={(wartosc) =>
              ustawFormularzTworzenia((poprzedni) => ({ ...poprzedni, pokazLokalizacjeTimeline: wartosc === 'true' }))
            }
            opcje={[
              { wartosc: 'true', etykieta: 'Tak' },
              { wartosc: 'false', etykieta: 'Nie' },
            ]}
          />
        </form>
      </Modal>

      <Modal
        czyOtwarty={czyModalEdycjiOtwarty}
        onZamknij={zamknijEdycje}
        tytul='Edytuj panel meldunkowy'
        akcje={
          <>
            <Przycisk wariant='drugorzedny' onClick={zamknijEdycje}>
              Anuluj
            </Przycisk>
            <Przycisk form='formularz-edycji-panelu-meldunkowego' type='submit' czyLaduje={zapisywanie}>
              Zapisz zmiany
            </Przycisk>
          </>
        }
      >
        <form
          id='formularz-edycji-panelu-meldunkowego'
          className='grid gap-4 md:grid-cols-2'
          onSubmit={obsluzEdycje}
        >
          <div className='md:col-span-2'>
            <Pole
              etykieta='Nazwa'
              required
              value={formularzEdycji.nazwa}
              onChange={(event) =>
                ustawFormularzEdycji((poprzedni) => ({ ...poprzedni, nazwa: event.target.value }))
              }
            />
          </div>
          <Pole
            etykieta='Login'
            value={formularzEdycji.login}
            onChange={(event) =>
              ustawFormularzEdycji((poprzedni) => ({ ...poprzedni, login: event.target.value }))
            }
          />
          <Pole
            etykieta='Hasło'
            value={formularzEdycji.haslo}
            onChange={(event) =>
              ustawFormularzEdycji((poprzedni) => ({ ...poprzedni, haslo: event.target.value }))
            }
          />
          <Rozwijane
            etykieta='Geolokalizacja włączona'
            wartosc={formularzEdycji.geolokalizacjaWlaczona ? 'true' : 'false'}
            onZmiana={(wartosc) =>
              ustawFormularzEdycji((poprzedni) => ({ ...poprzedni, geolokalizacjaWlaczona: wartosc === 'true' }))
            }
            opcje={[
              { wartosc: 'true', etykieta: 'Tak' },
              { wartosc: 'false', etykieta: 'Nie' },
            ]}
          />
          <Rozwijane
            etykieta='Pokaż lokalizację na timeline'
            wartosc={formularzEdycji.pokazLokalizacjeTimeline ? 'true' : 'false'}
            onZmiana={(wartosc) =>
              ustawFormularzEdycji((poprzedni) => ({ ...poprzedni, pokazLokalizacjeTimeline: wartosc === 'true' }))
            }
            opcje={[
              { wartosc: 'true', etykieta: 'Tak' },
              { wartosc: 'false', etykieta: 'Nie' },
            ]}
          />
        </form>
      </Modal>
    </div>
  );
}
