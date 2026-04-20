import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import klientApi from '../api/klient';
import TabelaDanych from '../komponenty/TabelaDanych';
import Modal from '../komponenty/ui/Modal';
import Pole from '../komponenty/ui/Pole';
import Przycisk from '../komponenty/ui/Przycisk';
import Przelacznik from '../komponenty/ui/Przelacznik';
import { useTabelaDanych } from '../hooki/useTabelaDanych';
import type { Klient, KolumnaTabeliDanych, OdpowiedzApi } from '../typy/indeks';

interface OdpowiedzListaKlientow extends OdpowiedzApi<Klient[]> {
  lacznie: number;
  strona: number;
  iloscNaStrone: number;
}

interface FormularzKlienta {
  nazwa: string;
  email: string;
  telefon: string;
  nip: string;
  ulica: string;
  miasto: string;
  kodPocztowy: string;
  kraj: string;
  aktywny: boolean;
}

const pustyFormularz: FormularzKlienta = {
  nazwa: '',
  email: '',
  telefon: '',
  nip: '',
  ulica: '',
  miasto: '',
  kodPocztowy: '',
  kraj: '',
  aktywny: true,
};

function zbudujPayload(formularz: FormularzKlienta) {
  return {
    nazwa: formularz.nazwa.trim(),
    email: formularz.email.trim() || undefined,
    telefon: formularz.telefon.trim() || undefined,
    nip: formularz.nip.trim() || undefined,
    ulica: formularz.ulica.trim() || undefined,
    miasto: formularz.miasto.trim() || undefined,
    kodPocztowy: formularz.kodPocztowy.trim() || undefined,
    kraj: formularz.kraj.trim() || undefined,
    aktywny: formularz.aktywny,
  };
}

function mapujKlientaNaFormularz(klient: Klient): FormularzKlienta {
  return {
    nazwa: klient.nazwa,
    email: klient.email ?? '',
    telefon: klient.telefon ?? '',
    nip: klient.nip ?? '',
    ulica: klient.ulica ?? '',
    miasto: klient.miasto ?? '',
    kodPocztowy: klient.kodPocztowy ?? '',
    kraj: klient.kraj ?? '',
    aktywny: klient.aktywny,
  };
}

function OdznakaAktywnosci({ aktywny }: { aktywny: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        aktywny
          ? 'bg-green-500/15 text-green-400'
          : 'bg-zinc-500/15 text-tekst-drugorzedny'
      }`}
    >
      {aktywny ? 'Aktywny' : 'Nieaktywny'}
    </span>
  );
}

export default function Klienci() {
  const {
    strona,
    iloscNaStrone,
    kluczSortowania,
    kierunekSortowania,
    onZmianaStrony,
    onSortowanie,
    resetujStrone,
  } = useTabelaDanych(10);
  const [klienci, ustawKlienci] = useState<Klient[]>([]);
  const [lacznie, ustawLacznie] = useState(0);
  const [szukaj, ustawSzukaj] = useState('');
  const [wyszukajDebounced, ustawWyszukajDebounced] = useState('');
  const [ladowanie, ustawLadowanie] = useState(true);
  const [blad, ustawBlad] = useState('');
  const [czyModalOtwarty, ustawCzyModalOtwarty] = useState(false);
  const [edytowanyKlient, ustawEdytowanyKlient] = useState<Klient | null>(null);
  const [formularz, ustawFormularz] = useState<FormularzKlienta>(pustyFormularz);
  const [bladFormularza, ustawBladFormularza] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [usuwanieId, ustawUsuwanieId] = useState<number | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      ustawWyszukajDebounced(szukaj.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [szukaj]);

  useEffect(() => {
    resetujStrone();
  }, [wyszukajDebounced, resetujStrone]);

  const pobierzKlientow = useCallback(async () => {
    ustawLadowanie(true);
    ustawBlad('');

    try {
      const odpowiedz = await klientApi.get<OdpowiedzListaKlientow>('/klienci', {
        params: {
          strona,
          iloscNaStrone,
          szukaj: wyszukajDebounced,
          sortPole: kluczSortowania,
          sortKierunek: kierunekSortowania,
        },
      });

      ustawKlienci(odpowiedz.data.dane);
      ustawLacznie(odpowiedz.data.lacznie);
    } catch {
      ustawBlad('Nie udało się pobrać listy klientów.');
    } finally {
      ustawLadowanie(false);
    }
  }, [strona, iloscNaStrone, wyszukajDebounced, kluczSortowania, kierunekSortowania]);

  useEffect(() => {
    void pobierzKlientow();
  }, [pobierzKlientow]);

  const otworzModalDodawania = () => {
    ustawEdytowanyKlient(null);
    ustawFormularz(pustyFormularz);
    ustawBladFormularza('');
    ustawCzyModalOtwarty(true);
  };

  const otworzModalEdycji = (klient: Klient) => {
    ustawEdytowanyKlient(klient);
    ustawFormularz(mapujKlientaNaFormularz(klient));
    ustawBladFormularza('');
    ustawCzyModalOtwarty(true);
  };

  const zamknijModal = () => {
    ustawCzyModalOtwarty(false);
    ustawEdytowanyKlient(null);
    ustawFormularz(pustyFormularz);
    ustawBladFormularza('');
  };

  const ustawPoleFormularza = <K extends keyof FormularzKlienta>(
    klucz: K,
    wartosc: FormularzKlienta[K]
  ) => {
    ustawFormularz((poprzedni) => ({
      ...poprzedni,
      [klucz]: wartosc,
    }));
  };

  const obsluzZapis = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formularz.nazwa.trim()) {
      ustawBladFormularza('Pole "Nazwa" jest wymagane.');
      return;
    }

    ustawZapisywanie(true);
    ustawBladFormularza('');

    try {
      const payload = zbudujPayload(formularz);

      if (edytowanyKlient) {
        await klientApi.put(`/klienci/${edytowanyKlient.id}`, payload);
      } else {
        await klientApi.post('/klienci', payload);
      }

      ustawZapisywanie(false);
      zamknijModal();
      await pobierzKlientow();
    } catch {
      ustawBladFormularza(
        edytowanyKlient
          ? 'Nie udało się zapisać zmian klienta.'
          : 'Nie udało się utworzyć klienta.'
      );
    } finally {
      ustawZapisywanie(false);
    }
  };

  const obsluzUsuwanie = async (klient: Klient) => {
    const potwierdzone = window.confirm(
      `Czy na pewno chcesz usunąć klienta "${klient.nazwa}"?`
    );

    if (!potwierdzone) {
      return;
    }

    ustawUsuwanieId(klient.id);
    ustawBlad('');

    try {
      await klientApi.delete(`/klienci/${klient.id}`);

      if (klienci.length === 1 && strona > 1) {
        onZmianaStrony(strona - 1);
      } else {
        await pobierzKlientow();
      }
    } catch {
      ustawBlad('Nie udało się usunąć klienta.');
    } finally {
      ustawUsuwanieId(null);
    }
  };

  const kolumny = useMemo<KolumnaTabeliDanych<Klient>[]>(
    () => [
      { klucz: 'id', naglowek: 'ID', sortowalny: true, szerokosc: '90px' },
      { klucz: 'nazwa', naglowek: 'Nazwa', sortowalny: true, szerokosc: '220px' },
      {
        klucz: 'email',
        naglowek: 'Email',
        sortowalny: true,
        szerokosc: '220px',
        renderuj: (wiersz) => wiersz.email || '-',
      },
      {
        klucz: 'telefon',
        naglowek: 'Telefon',
        sortowalny: true,
        szerokosc: '160px',
        renderuj: (wiersz) => wiersz.telefon || '-',
      },
      {
        klucz: 'nip',
        naglowek: 'NIP',
        sortowalny: true,
        szerokosc: '150px',
        renderuj: (wiersz) => wiersz.nip || '-',
      },
      {
        klucz: 'miasto',
        naglowek: 'Miasto',
        sortowalny: true,
        szerokosc: '160px',
        renderuj: (wiersz) => wiersz.miasto || '-',
      },
      {
        klucz: 'aktywny',
        naglowek: 'Aktywny',
        sortowalny: true,
        szerokosc: '130px',
        renderuj: (wiersz) => <OdznakaAktywnosci aktywny={wiersz.aktywny} />,
      },
      {
        klucz: 'akcje',
        naglowek: 'Akcje',
        szerokosc: '180px',
        renderuj: (wiersz) => (
          <div className='flex items-center gap-2'>
            <Przycisk
              type='button'
              wariant='drugorzedny'
              rozmiar='maly'
              onClick={() => otworzModalEdycji(wiersz)}
            >
              Edytuj
            </Przycisk>
            <Przycisk
              type='button'
              wariant='niebezpieczny'
              rozmiar='maly'
              czyLaduje={usuwanieId === wiersz.id}
              onClick={() => void obsluzUsuwanie(wiersz)}
            >
              Usuń
            </Przycisk>
          </div>
        ),
      },
    ],
    [usuwanieId]
  );

  return (
    <div className='space-y-6'>
      <section className='rounded-2xl border border-obramowanie bg-tlo-karta p-6 shadow-sm'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
          <div className='space-y-2'>
            <p className='text-sm font-medium uppercase tracking-[0.24em] text-akcent'>
              Moduł klientów
            </p>
            <div>
              <h1 className='text-3xl font-semibold text-tekst-glowny'>Klienci</h1>
              <p className='text-sm text-tekst-drugorzedny'>
                Zarządzanie bazą klientów i danymi kontaktowymi w systemie MES.
              </p>
            </div>
          </div>

          <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
            <div className='w-full sm:w-80'>
              <Pole
                value={szukaj}
                onChange={(event) => ustawSzukaj(event.target.value)}
                placeholder='Szukaj po nazwie, emailu, NIP lub mieście'
                ikonaPrefix={<Search size={16} />}
              />
            </div>
            <Przycisk type='button' onClick={otworzModalDodawania}>
              <Plus size={16} />
              Dodaj klienta
            </Przycisk>
          </div>
        </div>
      </section>

      <section className='rounded-2xl border border-obramowanie bg-tlo-karta p-6 shadow-sm'>
        <div className='mb-4 flex flex-col gap-1'>
          <h2 className='text-lg font-semibold text-tekst-glowny'>Lista klientów</h2>
          <p className='text-sm text-tekst-drugorzedny'>
            Łącznie rekordów: {lacznie}
          </p>
        </div>

        {blad ? (
          <div className='mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300'>
            {blad}
          </div>
        ) : null}

        <TabelaDanych
          kolumny={kolumny}
          dane={klienci}
          ladowanie={ladowanie}
          stronaPaginacji={strona}
          iloscNaStrone={iloscNaStrone}
          lacznie={lacznie}
          onZmianaStrony={onZmianaStrony}
          onSortowanie={onSortowanie}
        />
      </section>

      <Modal
        czyOtwarty={czyModalOtwarty}
        onZamknij={zamknijModal}
        tytul={edytowanyKlient ? 'Edytuj klienta' : 'Dodaj klienta'}
        rozmiar='duzy'
        akcje={
          <>
            <Przycisk
              type='button'
              wariant='drugorzedny'
              onClick={zamknijModal}
              disabled={zapisywanie}
            >
              Anuluj
            </Przycisk>
            <Przycisk
              type='submit'
              form='formularz-klienta'
              czyLaduje={zapisywanie}
            >
              {edytowanyKlient ? 'Zapisz zmiany' : 'Utwórz klienta'}
            </Przycisk>
          </>
        }
      >
        <form id='formularz-klienta' onSubmit={obsluzZapis} className='space-y-5'>
          {bladFormularza ? (
            <div className='rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300'>
              {bladFormularza}
            </div>
          ) : null}

          <div className='grid gap-4 md:grid-cols-2'>
            <Pole
              etykieta='Nazwa'
              value={formularz.nazwa}
              onChange={(event) => ustawPoleFormularza('nazwa', event.target.value)}
              placeholder='Wprowadź nazwę klienta'
              required
              bladOpisu={!formularz.nazwa.trim() && bladFormularza ? 'Nazwa jest wymagana.' : undefined}
            />
            <Pole
              etykieta='Email'
              type='email'
              value={formularz.email}
              onChange={(event) => ustawPoleFormularza('email', event.target.value)}
              placeholder='kontakt@firma.pl'
            />
            <Pole
              etykieta='Telefon'
              value={formularz.telefon}
              onChange={(event) => ustawPoleFormularza('telefon', event.target.value)}
              placeholder='+48 123 456 789'
            />
            <Pole
              etykieta='NIP'
              value={formularz.nip}
              onChange={(event) => ustawPoleFormularza('nip', event.target.value)}
              placeholder='1234567890'
            />
            <Pole
              etykieta='Ulica'
              value={formularz.ulica}
              onChange={(event) => ustawPoleFormularza('ulica', event.target.value)}
              placeholder='ul. Przemysłowa 10'
            />
            <Pole
              etykieta='Miasto'
              value={formularz.miasto}
              onChange={(event) => ustawPoleFormularza('miasto', event.target.value)}
              placeholder='Poznań'
            />
            <Pole
              etykieta='Kod pocztowy'
              value={formularz.kodPocztowy}
              onChange={(event) => ustawPoleFormularza('kodPocztowy', event.target.value)}
              placeholder='00-000'
            />
            <Pole
              etykieta='Kraj'
              value={formularz.kraj}
              onChange={(event) => ustawPoleFormularza('kraj', event.target.value)}
              placeholder='Polska'
            />
          </div>

          <div className='rounded-xl border border-obramowanie bg-tlo-glowne/60 px-4 py-3'>
            <Przelacznik
              wartosc={formularz.aktywny}
              onZmiana={(wartosc) => ustawPoleFormularza('aktywny', wartosc)}
              etykieta='Klient aktywny'
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
