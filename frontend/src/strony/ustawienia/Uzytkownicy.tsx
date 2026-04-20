import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, Shield, Trash2, Users } from 'lucide-react';
import klientApi from '../../api/klient';
import TabelaDanych from '../../komponenty/TabelaDanych';
import Modal from '../../komponenty/ui/Modal';
import Pole from '../../komponenty/ui/Pole';
import Przycisk from '../../komponenty/ui/Przycisk';
import Rozwijane from '../../komponenty/ui/Rozwijane';
import { useTabelaDanych } from '../../hooki/useTabelaDanych';
import type { KolumnaTabeliDanych } from '../../typy/indeks';

type RolaUzytkownika = 'ADMIN' | 'MANAGER' | 'PRACOWNIK';

interface UzytkownikWidoku {
  id: number;
  email: string;
  imie: string;
  nazwisko: string;
  rola: RolaUzytkownika;
  aktywny: boolean;
  utworzonyW?: string;
}

interface OdpowiedzListyUzytkownikow {
  sukces: boolean;
  dane: UzytkownikWidoku[];
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
  email: string;
  imie: string;
  nazwisko: string;
  haslo: string;
  rola: RolaUzytkownika;
}

interface FormularzEdycji {
  imie: string;
  nazwisko: string;
  rola: RolaUzytkownika;
  aktywny: boolean;
}

const OPCJE_ROL = [
  { wartosc: 'ADMIN', etykieta: 'Administrator' },
  { wartosc: 'MANAGER', etykieta: 'Manager' },
  { wartosc: 'PRACOWNIK', etykieta: 'Pracownik' },
] as const;

const PUSTY_FORMULARZ_TWORZENIA: FormularzTworzenia = {
  email: '',
  imie: '',
  nazwisko: '',
  haslo: '',
  rola: 'PRACOWNIK',
};

const PUSTY_FORMULARZ_EDYCJI: FormularzEdycji = {
  imie: '',
  nazwisko: '',
  rola: 'PRACOWNIK',
  aktywny: true,
};

function etykietaRoli(rola: RolaUzytkownika): string {
  switch (rola) {
    case 'ADMIN':
      return 'Administrator';
    case 'MANAGER':
      return 'Manager';
    default:
      return 'Pracownik';
  }
}

function etykietaDaty(data?: string): string {
  if (!data) {
    return '-';
  }

  return new Date(data).toLocaleString('pl-PL');
}

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

export default function Uzytkownicy() {
  const {
    strona,
    iloscNaStrone,
    kluczSortowania,
    kierunekSortowania,
    onZmianaStrony,
    onSortowanie,
    resetujStrone,
  } = useTabelaDanych(10);
  const [uzytkownicy, ustawUzytkownikow] = useState<UzytkownikWidoku[]>([]);
  const [lacznie, ustawLacznie] = useState(0);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [odswiezanie, ustawOdswiezanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [komunikatInfo, ustawKomunikatInfo] = useState('');
  const [czyModalDodawaniaOtwarty, ustawCzyModalDodawaniaOtwarty] = useState(false);
  const [czyModalEdycjiOtwarty, ustawCzyModalEdycjiOtwarty] = useState(false);
  const [formularzTworzenia, ustawFormularzTworzenia] =
    useState<FormularzTworzenia>(PUSTY_FORMULARZ_TWORZENIA);
  const [formularzEdycji, ustawFormularzEdycji] =
    useState<FormularzEdycji>(PUSTY_FORMULARZ_EDYCJI);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [usuwanieId, ustawUsuwanieId] = useState<number | null>(null);
  const [aktywnyUzytkownik, ustawAktywnegoUzytkownika] = useState<UzytkownikWidoku | null>(null);

  const pobierzUzytkownikow = async (pokazPelneLadowanie = false) => {
    if (pokazPelneLadowanie) {
      ustawLadowanie(true);
    } else {
      ustawOdswiezanie(true);
    }

    ustawBlad('');

    try {
      const odpowiedz = await klientApi.get<OdpowiedzListyUzytkownikow>('/uzytkownicy', {
        params: {
          strona,
          iloscNaStrone,
          sortPole: kluczSortowania,
          sortKierunek: kierunekSortowania,
        },
      });

      ustawUzytkownikow(odpowiedz.data.dane ?? []);
      ustawLacznie(odpowiedz.data.lacznie ?? 0);
      ustawKomunikatInfo('');
    } catch (bladPobierania) {
      ustawBlad(mapujBlad(bladPobierania, 'Nie udalo sie pobrac listy uzytkownikow.'));
      ustawUzytkownikow([]);
      ustawLacznie(0);

      try {
        const odpowiedzTestowa = await klientApi.get<OdpowiedzObiektu<UzytkownikWidoku>>(
          '/autentykacja/mnie'
        );
        const testowyUzytkownik = odpowiedzTestowa.data.dane;
        ustawUzytkownikow(testowyUzytkownik ? [testowyUzytkownik] : []);
        ustawLacznie(testowyUzytkownik ? 1 : 0);
        ustawKomunikatInfo(
          'Widok dziala w trybie testowym. Lista zostala zastapiona danymi z /api/autentykacja/mnie.'
        );
      } catch {
        ustawKomunikatInfo('Widok uzytkownikow jest w budowie. Endpoint lub sesja nie sa jeszcze dostepne.');
      }
    } finally {
      ustawLadowanie(false);
      ustawOdswiezanie(false);
    }
  };

  useEffect(() => {
    void pobierzUzytkownikow(true);
  }, [strona, iloscNaStrone, kluczSortowania, kierunekSortowania]);

  const otworzEdycje = (uzytkownik: UzytkownikWidoku) => {
    ustawAktywnegoUzytkownika(uzytkownik);
    ustawFormularzEdycji({
      imie: uzytkownik.imie,
      nazwisko: uzytkownik.nazwisko,
      rola: uzytkownik.rola,
      aktywny: uzytkownik.aktywny,
    });
    ustawCzyModalEdycjiOtwarty(true);
  };

  const zamknijDodawanie = () => {
    ustawCzyModalDodawaniaOtwarty(false);
    ustawFormularzTworzenia(PUSTY_FORMULARZ_TWORZENIA);
  };

  const zamknijEdycje = () => {
    ustawCzyModalEdycjiOtwarty(false);
    ustawAktywnegoUzytkownika(null);
    ustawFormularzEdycji(PUSTY_FORMULARZ_EDYCJI);
  };

  const obsluzDodawanie = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    ustawZapisywanie(true);
    ustawBlad('');

    try {
      await klientApi.post<OdpowiedzObiektu<UzytkownikWidoku>>('/uzytkownicy', formularzTworzenia);
      zamknijDodawanie();
      resetujStrone();
      await pobierzUzytkownikow(true);
    } catch (bladZapisu) {
      ustawBlad(mapujBlad(bladZapisu, 'Nie udalo sie utworzyc uzytkownika.'));
    } finally {
      ustawZapisywanie(false);
    }
  };

  const obsluzEdycje = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!aktywnyUzytkownik) {
      return;
    }

    ustawZapisywanie(true);
    ustawBlad('');

    try {
      await klientApi.put<OdpowiedzObiektu<UzytkownikWidoku>>(
        `/uzytkownicy/${aktywnyUzytkownik.id}`,
        formularzEdycji
      );
      zamknijEdycje();
      await pobierzUzytkownikow(true);
    } catch (bladZapisu) {
      ustawBlad(mapujBlad(bladZapisu, 'Nie udalo sie zaktualizowac uzytkownika.'));
    } finally {
      ustawZapisywanie(false);
    }
  };

  const usunUzytkownika = async (uzytkownik: UzytkownikWidoku) => {
    const potwierdzone = window.confirm(
      `Usunac uzytkownika ${uzytkownik.imie} ${uzytkownik.nazwisko} (${uzytkownik.email})?`
    );

    if (!potwierdzone) {
      return;
    }

    ustawUsuwanieId(uzytkownik.id);
    ustawBlad('');

    try {
      await klientApi.delete(`/uzytkownicy/${uzytkownik.id}`);
      await pobierzUzytkownikow(true);
    } catch (bladUsuwania) {
      ustawBlad(mapujBlad(bladUsuwania, 'Nie udalo sie usunac uzytkownika.'));
    } finally {
      ustawUsuwanieId(null);
    }
  };

  const kolumny = useMemo<KolumnaTabeliDanych<UzytkownikWidoku>[]>(
    () => [
      {
        klucz: 'email',
        naglowek: 'Uzytkownik',
        sortowalny: true,
        renderuj: (uzytkownik) => (
          <div className='space-y-1'>
            <div className='font-medium text-tekst-glowny'>
              {uzytkownik.imie} {uzytkownik.nazwisko}
            </div>
            <div className='text-xs text-tekst-drugorzedny'>{uzytkownik.email}</div>
          </div>
        ),
      },
      {
        klucz: 'rola',
        naglowek: 'Rola',
        sortowalny: true,
        renderuj: (uzytkownik) => (
          <span className='inline-flex items-center rounded-full bg-akcent/10 px-2.5 py-1 text-xs font-medium text-akcent'>
            {etykietaRoli(uzytkownik.rola)}
          </span>
        ),
      },
      {
        klucz: 'aktywny',
        naglowek: 'Status',
        sortowalny: true,
        renderuj: (uzytkownik) => (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
              uzytkownik.aktywny ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}
          >
            {uzytkownik.aktywny ? 'Aktywny' : 'Nieaktywny'}
          </span>
        ),
      },
      {
        klucz: 'utworzonyW',
        naglowek: 'Utworzony',
        sortowalny: true,
        renderuj: (uzytkownik) => etykietaDaty(uzytkownik.utworzonyW),
      },
      {
        klucz: 'akcje',
        naglowek: 'Akcje',
        renderuj: (uzytkownik) => (
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => otworzEdycje(uzytkownik)}
              className='rounded-md border border-obramowanie p-2 text-tekst-drugorzedny transition-colors hover:border-akcent hover:text-akcent'
              aria-label={`Edytuj ${uzytkownik.email}`}
            >
              <Pencil size={16} />
            </button>
            <button
              type='button'
              onClick={() => void usunUzytkownika(uzytkownik)}
              disabled={usuwanieId === uzytkownik.id}
              className='rounded-md border border-obramowanie p-2 text-tekst-drugorzedny transition-colors hover:border-red-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60'
              aria-label={`Usun ${uzytkownik.email}`}
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
              <Shield size={14} />
              Ustawienia systemowe
            </div>
            <div>
              <h1 className='text-3xl font-semibold text-tekst-glowny'>Uzytkownicy</h1>
              <p className='mt-2 max-w-2xl text-sm text-tekst-drugorzedny'>
                Zarzadzanie kontami administratorow, managerow i pracownikow w panelu MES.
              </p>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <Przycisk
              wariant='drugorzedny'
              onClick={() => void pobierzUzytkownikow(false)}
              czyLaduje={odswiezanie}
            >
              <RefreshCw size={16} />
              Odswiez
            </Przycisk>
            <Przycisk onClick={() => ustawCzyModalDodawaniaOtwarty(true)}>
              <Plus size={16} />
              Dodaj uzytkownika
            </Przycisk>
          </div>
        </div>
      </section>

      {blad ? (
        <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300'>
          {blad}
        </div>
      ) : null}

      {komunikatInfo ? (
        <div className='rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200'>
          {komunikatInfo}
        </div>
      ) : null}

      <section className='rounded-2xl border border-obramowanie bg-tlo-karta p-6 shadow-sm'>
        <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <div className='rounded-2xl bg-akcent/10 p-3 text-akcent'>
              <Users size={22} />
            </div>
            <div>
              <h2 className='text-lg font-semibold text-tekst-glowny'>Lista uzytkownikow</h2>
              <p className='text-sm text-tekst-drugorzedny'>
                Lacznie: {lacznie}. Widoczne rekordy mozna sortowac i edytowac.
              </p>
            </div>
          </div>
        </div>

        <TabelaDanych
          kolumny={kolumny}
          dane={uzytkownicy}
          ladowanie={ladowanie}
          stronaPaginacji={strona}
          iloscNaStrone={iloscNaStrone}
          lacznie={lacznie}
          onZmianaStrony={onZmianaStrony}
          onSortowanie={onSortowanie}
        />
      </section>

      <Modal
        czyOtwarty={czyModalDodawaniaOtwarty}
        onZamknij={zamknijDodawanie}
        tytul='Dodaj uzytkownika'
        akcje={
          <>
            <Przycisk wariant='drugorzedny' onClick={zamknijDodawanie}>
              Anuluj
            </Przycisk>
            <Przycisk form='formularz-dodawania-uzytkownika' type='submit' czyLaduje={zapisywanie}>
              Zapisz
            </Przycisk>
          </>
        }
      >
        <form
          id='formularz-dodawania-uzytkownika'
          className='grid gap-4 md:grid-cols-2'
          onSubmit={obsluzDodawanie}
        >
          <div className='md:col-span-2'>
            <Pole
              etykieta='Email'
              type='email'
              required
              value={formularzTworzenia.email}
              onChange={(event) =>
                ustawFormularzTworzenia((poprzedni) => ({ ...poprzedni, email: event.target.value }))
              }
            />
          </div>
          <Pole
            etykieta='Imie'
            required
            value={formularzTworzenia.imie}
            onChange={(event) =>
              ustawFormularzTworzenia((poprzedni) => ({ ...poprzedni, imie: event.target.value }))
            }
          />
          <Pole
            etykieta='Nazwisko'
            required
            value={formularzTworzenia.nazwisko}
            onChange={(event) =>
              ustawFormularzTworzenia((poprzedni) => ({ ...poprzedni, nazwisko: event.target.value }))
            }
          />
          <Pole
            etykieta='Haslo'
            type='password'
            required
            value={formularzTworzenia.haslo}
            onChange={(event) =>
              ustawFormularzTworzenia((poprzedni) => ({ ...poprzedni, haslo: event.target.value }))
            }
          />
          <Rozwijane
            etykieta='Rola'
            wartosc={formularzTworzenia.rola}
            onZmiana={(wartosc) =>
              ustawFormularzTworzenia((poprzedni) => ({
                ...poprzedni,
                rola: wartosc as RolaUzytkownika,
              }))
            }
            opcje={[...OPCJE_ROL]}
          />
        </form>
      </Modal>

      <Modal
        czyOtwarty={czyModalEdycjiOtwarty}
        onZamknij={zamknijEdycje}
        tytul='Edytuj uzytkownika'
        akcje={
          <>
            <Przycisk wariant='drugorzedny' onClick={zamknijEdycje}>
              Anuluj
            </Przycisk>
            <Przycisk form='formularz-edycji-uzytkownika' type='submit' czyLaduje={zapisywanie}>
              Zapisz zmiany
            </Przycisk>
          </>
        }
      >
        <form
          id='formularz-edycji-uzytkownika'
          className='grid gap-4 md:grid-cols-2'
          onSubmit={obsluzEdycje}
        >
          <div className='md:col-span-2'>
            <Pole etykieta='Email' value={aktywnyUzytkownik?.email ?? ''} disabled />
          </div>
          <Pole
            etykieta='Imie'
            required
            value={formularzEdycji.imie}
            onChange={(event) =>
              ustawFormularzEdycji((poprzedni) => ({ ...poprzedni, imie: event.target.value }))
            }
          />
          <Pole
            etykieta='Nazwisko'
            required
            value={formularzEdycji.nazwisko}
            onChange={(event) =>
              ustawFormularzEdycji((poprzedni) => ({ ...poprzedni, nazwisko: event.target.value }))
            }
          />
          <Rozwijane
            etykieta='Rola'
            wartosc={formularzEdycji.rola}
            onZmiana={(wartosc) =>
              ustawFormularzEdycji((poprzedni) => ({
                ...poprzedni,
                rola: wartosc as RolaUzytkownika,
              }))
            }
            opcje={[...OPCJE_ROL]}
          />
          <Rozwijane
            etykieta='Aktywny'
            wartosc={formularzEdycji.aktywny ? 'true' : 'false'}
            onZmiana={(wartosc) =>
              ustawFormularzEdycji((poprzedni) => ({
                ...poprzedni,
                aktywny: wartosc === 'true',
              }))
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
