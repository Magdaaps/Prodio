import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, FileSpreadsheet, ImagePlus, Paperclip, Plus, Search, Trash2 } from 'lucide-react';
import klientApi from '../../api/klient';
import Modal from '../../komponenty/ui/Modal';
import Pole from '../../komponenty/ui/Pole';
import Przycisk from '../../komponenty/ui/Przycisk';
import Przelacznik from '../../komponenty/ui/Przelacznik';
import Rozwijane from '../../komponenty/ui/Rozwijane';

type TypZakladki = 'SUROWCE' | 'PRODUKTY';

export type MagazynDto = {
  id: number;
  nazwa: string;
  aktywny: boolean;
  liczbaTransakcji: number;
};

export type SurowiecDto = {
  id: number;
  nazwa: string;
  jednostka: string;
  cena: number;
  waluta: string;
  aktywny: boolean;
};

type SurowiecSzczegolyDto = SurowiecDto & {
  vat: number;
  surowceDostawcy: Array<{
    id: number;
    cenaZakupu: number | string;
    waluta: string;
    dostawca: {
      id: number;
      nazwa: string;
      miasto?: string | null;
      kraj?: string | null;
      email?: string | null;
      telefon?: string | null;
      osobaKontaktowa?: string | null;
      aktywny: boolean;
    };
  }>;
};

export type ZlecenieDto = {
  id: number;
  numer: string;
};

export type StanMagazynowyDto = {
  id: number;
  nazwa: string;
  jednostka: string;
  waluta: string;
  cena: number;
  naStan: number;
  naProdukcji: number;
  zapotrzebowanie: number;
  zamowiono: number;
  sredniaCena: number;
  wartoscZapasow: number;
  aktywny: boolean;
};

type TypOperacjiMagazynowej = 'PRZYJECIE' | 'WYDANIE' | 'KOREKTA' | 'PRZENIESIENIE';

type ModalOperacjiMagazynowej = {
  typ: TypOperacjiMagazynowej;
  rekord: StanMagazynowyDto | null;
  powrotDoSzczegolow: boolean;
};

export type OdpowiedzApi<T> = {
  sukces: boolean;
  dane: T;
  wiadomosc?: string;
};

type FormularzPrzyjecia = {
  magazynId: string;
  data: string;
  typPrzyjecia: string;
  klientId: string;
  identyfikacja: string;
  trybZamowienia: 'POJEDYNCZE' | 'ZGRUPOWANE';
  uwagi: string;
};

type KlientMagazynowyDto = {
  id: number;
  nazwa: string;
};

type PozycjaPrzyjecia = {
  id: number;
  surowiecId: string;
  prodioId: string;
  ilosc: string;
  iloscZamowienia: string;
  cena: string;
  stawkaVat: string;
};

type FormularzWydania = {
  magazynId: string;
  data: string;
  rodzajWydania: string;
  trybZamowienia: 'POJEDYNCZE' | 'ZGRUPOWANE';
  zlecenieId: string;
  klientId: string;
  identyfikacja: string;
  uwagi: string;
};

type PozycjaWydania = {
  id: number;
  surowiecId: string;
  prodioId: string;
  ilosc: string;
  iloscZamowienia: string;
  cena: string;
  stawkaVat: string;
};

type FormularzKorekty = {
  surowiecId: string;
  magazynId: string;
  ilosc: string;
  uwagi: string;
  numer: string;
};

type FormularzPrzeniesienia = {
  surowiecId: string;
  magazynId: string;
  magazynDocelId: string;
  ilosc: string;
  uwagi: string;
  numer: string;
};

type FormularzNowegoSurowca = {
  nazwa: string;
  jednostka: string;
  cena: string;
  vat: string;
  waluta: string;
  aktywny: boolean;
};

const KLASY_KARTY = 'rounded-[28px] border border-slate-700 bg-[#1E2A3A] shadow-xl shadow-black/20';
const KLASY_TABELI = 'overflow-x-auto rounded-[28px] border border-slate-700 bg-slate-950/30';
const ROZMIAR_STRONY = 30;

const DOMYSLNY_FORMULARZ_SUROWCA: FormularzNowegoSurowca = {
  nazwa: '',
  jednostka: 'szt',
  cena: '',
  vat: '23',
  waluta: 'PLN',
  aktywny: true,
};

function pobierzKomunikatBledu(blad: unknown, domyslnyKomunikat: string) {
  if (
    typeof blad === 'object' &&
    blad !== null &&
    'response' in blad &&
    typeof blad.response === 'object' &&
    blad.response !== null &&
    'data' in blad.response &&
    typeof blad.response.data === 'object' &&
    blad.response.data !== null &&
    'wiadomosc' in blad.response.data &&
    typeof blad.response.data.wiadomosc === 'string'
  ) {
    return blad.response.data.wiadomosc;
  }

  return domyslnyKomunikat;
}

export function formatujLiczbe(value: number, digits = 2) {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatujWalute(value: number, waluta = 'PLN') {
  return `${formatujLiczbe(value)} ${waluta}`;
}

export function useMagazynSlowniki() {
  const [magazyny, ustawMagazyny] = useState<MagazynDto[]>([]);
  const [surowce, ustawSurowce] = useState<SurowiecDto[]>([]);
  const [zlecenia, ustawZlecenia] = useState<ZlecenieDto[]>([]);
  const [ladowanie, ustawLadowanie] = useState(true);

  const odswiez = async () => {
    ustawLadowanie(true);
    try {
      const [magazynyRes, surowceRes, zleceniaRes] = await Promise.all([
        klientApi.get<OdpowiedzApi<MagazynDto[]>>('/magazyn/magazyny'),
        klientApi.get('/surowce', {
          params: { strona: 1, iloscNaStrone: 200, sortPole: 'nazwa', sortKierunek: 'asc' },
        }),
        klientApi.get('/zlecenia-produkcyjne', {
          params: { strona: 1, iloscNaStrone: 200, pokazNieaktywne: true },
        }),
      ]);

      ustawMagazyny(magazynyRes.data.dane);
      ustawSurowce(surowceRes.data.dane);
      ustawZlecenia(
        (zleceniaRes.data.dane ?? []).map((zlecenie: { id: number; numer: string }) => ({
          id: zlecenie.id,
          numer: zlecenie.numer,
        }))
      );
    } finally {
      ustawLadowanie(false);
    }
  };

  useEffect(() => {
    void odswiez();
  }, []);

  return { magazyny, surowce, zlecenia, ladowanie, odswiez };
}

function NaglowekFormularza({ children }: { children: ReactNode }) {
  return <div className='rounded-2xl border border-slate-700 bg-slate-950/40 p-4'>{children}</div>;
}

function KartaSzczegolu({
  etykieta,
  wartosc,
  wyroznienie = false,
}: {
  etykieta: string;
  wartosc: ReactNode;
  wyroznienie?: boolean;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${wyroznienie ? 'border-orange-400/30 bg-orange-400/10' : 'border-slate-700 bg-slate-950/40'}`}>
      <p className='text-xs font-semibold uppercase tracking-[0.2em] text-slate-400'>{etykieta}</p>
      <div className={`mt-2 text-sm ${wyroznienie ? 'font-semibold text-orange-100' : 'text-slate-100'}`}>{wartosc}</div>
    </div>
  );
}

function SzczegolySurowcaModal({
  czyOtwarty,
  surowiecId,
  rekord,
  onZamknij,
  onUsun,
  usuwanie,
  onPrzyjecie,
  onWydanie,
  onKorekta,
  onPrzeniesienie,
}: {
  czyOtwarty: boolean;
  surowiecId: number | null;
  rekord: StanMagazynowyDto | null;
  onZamknij: () => void;
  onUsun: () => void;
  usuwanie: boolean;
  onPrzyjecie: () => void;
  onWydanie: () => void;
  onKorekta: () => void;
  onPrzeniesienie: () => void;
}) {
  const [szczegoly, ustawSzczegoly] = useState<SurowiecSzczegolyDto | null>(null);
  const [ladowanie, ustawLadowanie] = useState(false);
  const [blad, ustawBlad] = useState('');

  useEffect(() => {
    if (!czyOtwarty || !surowiecId) {
      if (!czyOtwarty) {
        ustawSzczegoly(null);
        ustawBlad('');
      }
      return;
    }

    let aktywny = true;

    const pobierzSzczegoly = async () => {
      ustawLadowanie(true);
      ustawBlad('');
      try {
        const odpowiedz = await klientApi.get<OdpowiedzApi<SurowiecSzczegolyDto>>(`/surowce/${surowiecId}`);
        if (aktywny) {
          ustawSzczegoly(odpowiedz.data.dane);
        }
      } catch (error) {
        if (aktywny) {
          ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie pobrac szczegolow surowca.'));
        }
      } finally {
        if (aktywny) {
          ustawLadowanie(false);
        }
      }
    };

    void pobierzSzczegoly();

    return () => {
      aktywny = false;
    };
  }, [czyOtwarty, surowiecId]);

  const tytul = rekord?.nazwa || szczegoly?.nazwa || 'Szczegoly surowca';
  const dostawcy = szczegoly?.surowceDostawcy ?? [];

  return (
    <Modal
      czyOtwarty={czyOtwarty}
      onZamknij={onZamknij}
      tytul={`Surowiec: ${tytul}`}
      rozmiar='bardzoDuzy'
      akcje={(
        <>
          <Przycisk wariant='niebezpieczny' onClick={onUsun} czyLaduje={usuwanie}>Usun</Przycisk>
          <Przycisk wariant='drugorzedny' onClick={onZamknij}>Zamknij</Przycisk>
          <Przycisk wariant='drugorzedny' onClick={onPrzyjecie}>Przyjecie</Przycisk>
          <Przycisk wariant='drugorzedny' onClick={onWydanie}>Wydanie</Przycisk>
          <Przycisk wariant='drugorzedny' onClick={onKorekta}>Korekta</Przycisk>
          <Przycisk onClick={onPrzeniesienie}>Przeniesienie</Przycisk>
        </>
      )}
    >
      <div className='space-y-6'>
        <section className='rounded-[28px] border border-orange-400/20 bg-gradient-to-br from-[#243447] via-[#1E2A3A] to-[#141c28] p-6 shadow-xl shadow-black/20'>
          <div className='flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between'>
            <div>
              <div className='inline-flex rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-200'>
                Karta surowca
              </div>
              <h3 className='mt-3 text-3xl font-semibold text-slate-50'>{tytul}</h3>
              <p className='mt-2 max-w-3xl text-sm text-slate-300'>
                Podglad najwazniejszych informacji o surowcu, zgodny z kolorystyka magazynu i gotowy do szybkich operacji.
              </p>
            </div>
            <div className='grid gap-3 sm:grid-cols-2 xl:min-w-[440px]'>
              <KartaSzczegolu etykieta='Na stanie' wartosc={`${formatujLiczbe(rekord?.naStan ?? 0, 4)} ${rekord?.jednostka ?? szczegoly?.jednostka ?? ''}`} wyroznienie />
              <KartaSzczegolu etykieta='Zapotrzebowanie' wartosc={formatujLiczbe(rekord?.zapotrzebowanie ?? 0, 4)} />
              <KartaSzczegolu etykieta='Na produkcji' wartosc={formatujLiczbe(rekord?.naProdukcji ?? 0, 4)} />
              <KartaSzczegolu etykieta='Zamowiono' wartosc={formatujLiczbe(rekord?.zamowiono ?? 0, 4)} />
            </div>
          </div>
        </section>

        {blad ? <div className='rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}

        {ladowanie ? (
          <div className='rounded-[28px] border border-slate-700 bg-slate-950/30 px-6 py-12 text-center text-sm text-slate-400'>
            Ladowanie szczegolow surowca...
          </div>
        ) : (
          <div className='grid gap-6 xl:grid-cols-[1.3fr_0.9fr]'>
            <section className='space-y-6'>
              <div className='rounded-[28px] border border-slate-700 bg-slate-950/30 p-5'>
                <div className='mb-4 flex items-center justify-between gap-3'>
                  <div>
                    <h4 className='text-lg font-semibold text-slate-100'>Podstawowe informacje</h4>
                    <p className='text-sm text-slate-400'>Najwazniejsze dane handlowe i operacyjne surowca.</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${szczegoly?.aktywny ?? rekord?.aktywny ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>
                    {szczegoly?.aktywny ?? rekord?.aktywny ? 'Aktywny' : 'Nieaktywny'}
                  </span>
                </div>
                <div className='grid gap-3 md:grid-cols-2'>
                  <KartaSzczegolu etykieta='Nazwa' wartosc={szczegoly?.nazwa ?? rekord?.nazwa ?? '--'} />
                  <KartaSzczegolu etykieta='ID surowca' wartosc={surowiecId ?? '--'} />
                  <KartaSzczegolu etykieta='Jednostka' wartosc={szczegoly?.jednostka ?? rekord?.jednostka ?? '--'} />
                  <KartaSzczegolu etykieta='Waluta' wartosc={szczegoly?.waluta ?? rekord?.waluta ?? '--'} />
                  <KartaSzczegolu etykieta='Cena bazowa' wartosc={formatujWalute(Number(szczegoly?.cena ?? rekord?.cena ?? 0), szczegoly?.waluta ?? rekord?.waluta ?? 'PLN')} />
                  <KartaSzczegolu etykieta='Stawka VAT' wartosc={`${szczegoly?.vat ?? 23}%`} />
                </div>
              </div>

              <div className='rounded-[28px] border border-slate-700 bg-slate-950/30 p-5'>
                <h4 className='text-lg font-semibold text-slate-100'>Stan i rozliczenie</h4>
                <p className='mt-1 text-sm text-slate-400'>Podsumowanie gospodarki magazynowej dla wybranego surowca.</p>
                <div className='mt-4 grid gap-3 md:grid-cols-2'>
                  <KartaSzczegolu etykieta='Srednia cena zakupu' wartosc={formatujWalute(rekord?.sredniaCena ?? 0, rekord?.waluta ?? szczegoly?.waluta ?? 'PLN')} />
                  <KartaSzczegolu etykieta='Wartosc zapasow' wartosc={formatujWalute(rekord?.wartoscZapasow ?? 0, rekord?.waluta ?? szczegoly?.waluta ?? 'PLN')} />
                  <KartaSzczegolu etykieta='Aktualny stan' wartosc={`${formatujLiczbe(rekord?.naStan ?? 0, 4)} ${rekord?.jednostka ?? szczegoly?.jednostka ?? ''}`} />
                  <KartaSzczegolu etykieta='Bilans operacyjny' wartosc={formatujLiczbe((rekord?.naStan ?? 0) + (rekord?.zamowiono ?? 0) - (rekord?.zapotrzebowanie ?? 0), 4)} />
                </div>
              </div>
            </section>

            <section className='space-y-6'>
              <div className='rounded-[28px] border border-slate-700 bg-slate-950/30 p-5'>
                <h4 className='text-lg font-semibold text-slate-100'>Dostawcy</h4>
                <p className='mt-1 text-sm text-slate-400'>Powiazani dostawcy i ostatnio znane ceny zakupu.</p>
                <div className='mt-4 space-y-3'>
                  {dostawcy.length === 0 ? (
                    <div className='rounded-2xl border border-dashed border-slate-600 bg-slate-950/30 px-4 py-6 text-sm text-slate-400'>
                      Brak przypisanych dostawcow dla tego surowca.
                    </div>
                  ) : (
                    dostawcy.map((pozycja) => (
                      <div key={pozycja.id} className='rounded-2xl border border-slate-700 bg-[#1A2535] p-4'>
                        <div className='flex items-start justify-between gap-3'>
                          <div>
                            <p className='font-semibold text-slate-100'>{pozycja.dostawca.nazwa}</p>
                            <p className='mt-1 text-sm text-slate-400'>
                              {[pozycja.dostawca.miasto, pozycja.dostawca.kraj].filter(Boolean).join(', ') || 'Brak lokalizacji'}
                            </p>
                          </div>
                          <span className='rounded-full bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-200'>
                            {formatujWalute(Number(pozycja.cenaZakupu), pozycja.waluta)}
                          </span>
                        </div>
                        <div className='mt-3 grid gap-2 text-sm text-slate-300'>
                          <p>Kontakt: {pozycja.dostawca.osobaKontaktowa || 'brak osoby kontaktowej'}</p>
                          <p>Email: {pozycja.dostawca.email || 'brak adresu email'}</p>
                          <p>Telefon: {pozycja.dostawca.telefon || 'brak numeru telefonu'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className='rounded-[28px] border border-slate-700 bg-slate-950/30 p-5'>
                <h4 className='text-lg font-semibold text-slate-100'>Szybkie podsumowanie</h4>
                <div className='mt-4 space-y-3 text-sm text-slate-300'>
                  <div className='rounded-2xl border border-slate-700 bg-[#1A2535] px-4 py-3'>
                    Cena referencyjna: <span className='font-semibold text-slate-100'>{formatujWalute(Number(szczegoly?.cena ?? rekord?.cena ?? 0), szczegoly?.waluta ?? rekord?.waluta ?? 'PLN')}</span>
                  </div>
                  <div className='rounded-2xl border border-slate-700 bg-[#1A2535] px-4 py-3'>
                    Liczba dostawcow: <span className='font-semibold text-slate-100'>{dostawcy.length}</span>
                  </div>
                  <div className='rounded-2xl border border-slate-700 bg-[#1A2535] px-4 py-3'>
                    Jednostka rozliczeniowa: <span className='font-semibold text-slate-100'>{szczegoly?.jednostka ?? rekord?.jednostka ?? '--'}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}

function opcjeMagazynow(magazyny: MagazynDto[]) {
  return magazyny.map((magazyn) => ({
    wartosc: String(magazyn.id),
    etykieta: magazyn.nazwa,
  }));
}

function opcjeSurowcow(surowce: SurowiecDto[]) {
  return surowce.map((surowiec) => ({
    wartosc: String(surowiec.id),
    etykieta: `${surowiec.nazwa} (${surowiec.jednostka})`,
  }));
}

function formatujDateTimeDoInput(data = new Date()) {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function utworzPustaPozycje(id: number): PozycjaPrzyjecia {
  return {
    id,
    surowiecId: '',
    prodioId: '',
    ilosc: '',
    iloscZamowienia: '',
    cena: '',
    stawkaVat: '23',
  };
}

function NowySurowiecFormularz({
  czyOtwarty,
  onZamknij,
  onZapisano,
}: {
  czyOtwarty: boolean;
  onZamknij: () => void;
  onZapisano: () => Promise<void> | void;
}) {
  const [formularz, ustawFormularz] = useState<FormularzNowegoSurowca>(DOMYSLNY_FORMULARZ_SUROWCA);
  const [blad, ustawBlad] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);

  useEffect(() => {
    if (!czyOtwarty) return;
    ustawFormularz(DOMYSLNY_FORMULARZ_SUROWCA);
    ustawBlad('');
  }, [czyOtwarty]);

  const zapisz = async () => {
    if (!formularz.nazwa.trim()) {
      ustawBlad('Nazwa surowca jest wymagana.');
      return;
    }

    ustawZapisywanie(true);
    ustawBlad('');

    try {
      await klientApi.post('/surowce', {
        nazwa: formularz.nazwa.trim(),
        jednostka: formularz.jednostka.trim() || 'szt',
        cena: formularz.cena.trim() === '' ? undefined : Number(formularz.cena),
        vat: Number(formularz.vat),
        waluta: formularz.waluta.trim() || 'PLN',
        aktywny: formularz.aktywny,
      });
      await onZapisano();
      onZamknij();
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie dodac surowca.'));
    } finally {
      ustawZapisywanie(false);
    }
  };

  return (
    <Modal
      czyOtwarty={czyOtwarty}
      onZamknij={() => !zapisywanie && onZamknij()}
      tytul='Nowy surowiec'
      rozmiar='bardzoDuzy'
      akcje={(
        <>
          <Przycisk wariant='drugorzedny' onClick={onZamknij} disabled={zapisywanie}>Anuluj</Przycisk>
          <Przycisk onClick={() => void zapisz()} czyLaduje={zapisywanie}>Zapisz surowiec</Przycisk>
        </>
      )}
    >
      <div className='space-y-6'>
        <div className='rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3'>
          <Przelacznik wartosc={formularz.aktywny} onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, aktywny: wartosc }))} etykieta='Aktywny' />
        </div>

        {blad ? <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}

        <div className='grid gap-6 xl:grid-cols-[1.05fr_1fr]'>
          <div className='space-y-4'>
            <Pole etykieta='Nazwa*' value={formularz.nazwa} onChange={(event) => ustawFormularz((prev) => ({ ...prev, nazwa: event.target.value }))} placeholder='Wpisz nazwe surowca' />
            <Rozwijane
              etykieta='Jednostka'
              opcje={[
                { wartosc: 'szt', etykieta: 'szt' },
                { wartosc: 'pcs (szt)', etykieta: 'pcs (szt)' },
                { wartosc: 'kg', etykieta: 'kg' },
                { wartosc: 'g', etykieta: 'g' },
                { wartosc: 'l', etykieta: 'l' },
                { wartosc: 'm', etykieta: 'm' },
              ]}
              wartosc={formularz.jednostka}
              onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, jednostka: String(wartosc) }))}
            />
            <Pole etykieta='Cena' type='number' min='0' step='0.01' value={formularz.cena} onChange={(event) => ustawFormularz((prev) => ({ ...prev, cena: event.target.value }))} placeholder='0,00' />
            <Rozwijane
              etykieta='Stawka VAT'
              opcje={[
                { wartosc: '23', etykieta: '23%' },
                { wartosc: '8', etykieta: '8%' },
                { wartosc: '5', etykieta: '5%' },
                { wartosc: '0', etykieta: '0%' },
              ]}
              wartosc={formularz.vat}
              onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, vat: String(wartosc) }))}
            />
            <Rozwijane
              etykieta='Waluta'
              opcje={[
                { wartosc: 'PLN', etykieta: 'PLN' },
                { wartosc: 'EUR', etykieta: 'EUR' },
                { wartosc: 'USD', etykieta: 'USD' },
              ]}
              wartosc={formularz.waluta}
              onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, waluta: String(wartosc) }))}
            />
          </div>

          <div className='space-y-5'>
            <div className='overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/30'>
              <div className='flex items-center justify-between bg-slate-700/80 px-4 py-3'>
                <span className='text-sm font-semibold text-slate-100'>Pliki</span>
                <Paperclip size={16} className='text-slate-300' />
              </div>
              <div className='px-4 py-6 text-sm text-slate-400'>Sekcja przygotowana pod przyszle zalaczniki dla surowca.</div>
            </div>

            <div className='overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/30'>
              <div className='flex items-center justify-between bg-slate-700/80 px-4 py-3'>
                <span className='text-sm font-semibold text-slate-100'>Obrazy</span>
                <ImagePlus size={16} className='text-slate-300' />
              </div>
              <div className='px-4 py-6 text-sm text-slate-400'>Miejsce na zdjecie surowca lub podglad opakowania.</div>
            </div>

            <div className='rounded-2xl border border-slate-700 bg-slate-950/30 p-5'>
              <h3 className='text-xl font-semibold text-slate-100'>Podsumowanie</h3>
              <p className='mt-2 text-sm text-slate-400'>Formularz zapisuje podstawowe dane surowca i od razu odswieza liste w zakladce `Surowce`.</p>
              <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                <NaglowekFormularza>
                  <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>Status</p>
                  <p className='mt-2 text-sm font-medium text-slate-100'>{formularz.aktywny ? 'Aktywny' : 'Nieaktywny'}</p>
                </NaglowekFormularza>
                <NaglowekFormularza>
                  <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>Wartosc domyslna</p>
                  <p className='mt-2 text-sm font-medium text-slate-100'>{formularz.cena || '0,00'} {formularz.waluta}</p>
                </NaglowekFormularza>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function PrzyjecieFormularz({
  czyOtwarty,
  onZamknij,
  onZapisano,
  magazyny,
  surowce,
  domyslnySurowiecId,
  domyslnyMagazynId,
}: {
  czyOtwarty: boolean;
  onZamknij: () => void;
  onZapisano: () => Promise<void> | void;
  magazyny: MagazynDto[];
  surowce: SurowiecDto[];
  domyslnySurowiecId?: number | null;
  domyslnyMagazynId?: number | null;
}) {
  const [formularz, ustawFormularz] = useState<FormularzPrzyjecia>({
    magazynId: '',
    data: formatujDateTimeDoInput(),
    typPrzyjecia: 'Z_PRODUKCJI',
    klientId: '',
    identyfikacja: '',
    trybZamowienia: 'POJEDYNCZE',
    uwagi: '',
  });
  const [pozycje, ustawPozycje] = useState<PozycjaPrzyjecia[]>([utworzPustaPozycje(1)]);
  const [kolejneIdPozycji, ustawKolejneIdPozycji] = useState(2);
  const [klienci, ustawKlienci] = useState<KlientMagazynowyDto[]>([]);
  const [blad, ustawBlad] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [ladowanieKlientow, ustawLadowanieKlientow] = useState(false);

  useEffect(() => {
    if (!czyOtwarty) return;
    ustawFormularz({
      magazynId: domyslnyMagazynId ? String(domyslnyMagazynId) : '',
      data: formatujDateTimeDoInput(),
      typPrzyjecia: 'Z_PRODUKCJI',
      klientId: '',
      identyfikacja: '',
      trybZamowienia: 'POJEDYNCZE',
      uwagi: '',
    });
    ustawPozycje([
      {
        ...utworzPustaPozycje(1),
        surowiecId: domyslnySurowiecId ? String(domyslnySurowiecId) : '',
      },
    ]);
    ustawKolejneIdPozycji(2);
    ustawBlad('');
  }, [czyOtwarty, domyslnyMagazynId, domyslnySurowiecId]);

  useEffect(() => {
    if (!czyOtwarty) return;
    if (klienci.length > 0) return;

    const pobierzKlientow = async () => {
      ustawLadowanieKlientow(true);
      try {
        const odpowiedz = await klientApi.get<OdpowiedzApi<KlientMagazynowyDto[]>>('/klienci', {
          params: { strona: 1, iloscNaStrone: 200, sortPole: 'nazwa', sortKierunek: 'asc' },
        });
        ustawKlienci(odpowiedz.data.dane ?? []);
      } catch {
        ustawKlienci([]);
      } finally {
        ustawLadowanieKlientow(false);
      }
    };

    void pobierzKlientow();
  }, [czyOtwarty, klienci.length]);

  const ustawPolePozycji = <K extends keyof PozycjaPrzyjecia>(id: number, klucz: K, wartosc: PozycjaPrzyjecia[K]) => {
    ustawPozycje((prev) => prev.map((pozycja) => (pozycja.id === id ? { ...pozycja, [klucz]: wartosc } : pozycja)));
  };

  const dodajPozycje = () => {
    ustawPozycje((prev) => [...prev, utworzPustaPozycje(kolejneIdPozycji)]);
    ustawKolejneIdPozycji((prev) => prev + 1);
  };

  const usunPozycje = (id: number) => {
    ustawPozycje((prev) => {
      if (prev.length === 1) {
        return [utworzPustaPozycje(id)];
      }

      return prev.filter((pozycja) => pozycja.id !== id);
    });
  };

  const zapisz = async () => {
    const poprawnePozycje = pozycje.filter((pozycja) => pozycja.surowiecId && Number(pozycja.ilosc) > 0);

    if (!formularz.magazynId || poprawnePozycje.length === 0) {
      ustawBlad('Uzupelnij magazyn i dodaj co najmniej jedna pozycje z dodatnia iloscia.');
      return;
    }

    ustawZapisywanie(true);
    ustawBlad('');

    try {
      for (const pozycja of poprawnePozycje) {
        await klientApi.post('/magazyn/przyjecia', {
          magazynId: Number(formularz.magazynId),
          surowiecId: Number(pozycja.surowiecId),
          ilosc: Number(pozycja.ilosc),
          cena: pozycja.cena ? Number(pozycja.cena) : undefined,
          numer: formularz.identyfikacja || undefined,
          uwagi: formularz.uwagi || undefined,
        });
      }
      await onZapisano();
      onZamknij();
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie zapisac przyjecia.'));
    } finally {
      ustawZapisywanie(false);
    }
  };

  const pozycjePodsumowanie = pozycje.map((pozycja) => {
    const surowiec = surowce.find((item) => String(item.id) === pozycja.surowiecId);
    const cena = Number(pozycja.cena) || 0;
    const ilosc = Number(pozycja.ilosc) || 0;
    const stawkaVat = Number(pozycja.stawkaVat) || 0;
    const netto = cena * ilosc;
    const vat = netto * (stawkaVat / 100);
    const brutto = netto + vat;

    return {
      ...pozycja,
      surowiec,
      netto,
      vat,
      brutto,
      waluta: surowiec?.waluta ?? 'PLN',
    };
  });

  const sumaNetto = pozycjePodsumowanie.reduce((acc, pozycja) => acc + pozycja.netto, 0);
  const sumaVat = pozycjePodsumowanie.reduce((acc, pozycja) => acc + pozycja.vat, 0);
  const sumaBrutto = pozycjePodsumowanie.reduce((acc, pozycja) => acc + pozycja.brutto, 0);

  return (
    <Modal
      czyOtwarty={czyOtwarty}
      onZamknij={() => !zapisywanie && onZamknij()}
      tytul='Dodaj przyjecie magazynowe'
      rozmiar='bardzoDuzy'
      akcje={
        <>
          <Przycisk wariant='drugorzedny' onClick={onZamknij} disabled={zapisywanie}>
            Anuluj
          </Przycisk>
          <Przycisk onClick={() => void zapisz()} czyLaduje={zapisywanie}>
            Zapisz przyjecie
          </Przycisk>
        </>
      }
    >
      <div className='space-y-5 text-tekst-glowny'>
        <NaglowekFormularza>
          <div className='grid gap-4 xl:grid-cols-4'>
            <Rozwijane
              etykieta='Magazyn*'
              opcje={opcjeMagazynow(magazyny)}
              wartosc={formularz.magazynId}
              onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, magazynId: String(wartosc) }))}
              placeholder='Wybierz magazyn'
            />
            <Pole
              etykieta='Data*'
              type='datetime-local'
              value={formularz.data}
              ikonaPrefix={<CalendarDays size={16} />}
              onChange={(event) => ustawFormularz((prev) => ({ ...prev, data: event.target.value }))}
            />
            <Rozwijane
              etykieta='Typ przyjecia*'
              opcje={[
                { wartosc: 'ZAKUP', etykieta: 'Zakup' },
                { wartosc: 'Z_PRODUKCJI', etykieta: 'Z produkcji' },
                { wartosc: 'ZWROT', etykieta: 'Zwrot' },
                { wartosc: 'INNE', etykieta: 'Inne' },
              ]}
              wartosc={formularz.typPrzyjecia}
              onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, typPrzyjecia: String(wartosc) }))}
            />
            <div className='rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-3'>
              <span className='mb-2 block text-sm font-medium text-tekst-drugorzedny'>Zamowienie</span>
              <div className='flex flex-wrap gap-5 text-sm'>
                <label className='inline-flex items-center gap-2'>
                  <input type='radio' name='tryb-zamowienia' className='h-4 w-4 border-obramowanie bg-tlo-glowne text-akcent' checked={formularz.trybZamowienia === 'POJEDYNCZE'} onChange={() => ustawFormularz((prev) => ({ ...prev, trybZamowienia: 'POJEDYNCZE' }))} />
                  <span>Pojedyncze</span>
                </label>
                <label className='inline-flex items-center gap-2'>
                  <input type='radio' name='tryb-zamowienia' className='h-4 w-4 border-obramowanie bg-tlo-glowne text-akcent' checked={formularz.trybZamowienia === 'ZGRUPOWANE'} onChange={() => ustawFormularz((prev) => ({ ...prev, trybZamowienia: 'ZGRUPOWANE' }))} />
                  <span>Zgrupowane</span>
                </label>
              </div>
            </div>
            <Rozwijane
              etykieta='Klient'
              opcje={klienci.map((klient) => ({ wartosc: String(klient.id), etykieta: klient.nazwa }))}
              wartosc={formularz.klientId}
              onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, klientId: String(wartosc) }))}
              placeholder={ladowanieKlientow ? 'Ladowanie klientow...' : 'Wybierz klienta'}
              wylaczone={ladowanieKlientow}
            />
            <Pole
              etykieta='Identyfikacja'
              value={formularz.identyfikacja}
              onChange={(event) => ustawFormularz((prev) => ({ ...prev, identyfikacja: event.target.value }))}
              placeholder='Numer dokumentu / identyfikator'
            />
          </div>
        </NaglowekFormularza>

        <section className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne'>
          <div className='overflow-x-auto'>
            <table className='min-w-[1180px] w-full text-sm'>
              <thead className='bg-tlo-karta text-tekst-drugorzedny'>
                <tr>
                  {['Produkt/surowiec', 'Prodio ID zamowienia', 'Ilosc przyjmowana', 'Ilosc zamowiona', 'Cena', 'Stawka VAT', 'Waluta', 'Netto', 'Brutto', 'VAT', 'Akcje'].map((label) => (
                    <th key={label} className='border-b border-obramowanie px-3 py-3 text-left font-medium'>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pozycjePodsumowanie.map((pozycja) => (
                  <tr key={pozycja.id} className='border-b border-obramowanie/60 align-top last:border-b-0'>
                    <td className='px-3 py-3 min-w-[240px]'>
                      <Rozwijane
                        opcje={opcjeSurowcow(surowce)}
                        wartosc={pozycja.surowiecId}
                        onZmiana={(wartosc) => ustawPolePozycji(pozycja.id, 'surowiecId', String(wartosc))}
                        placeholder='Wybierz surowiec'
                      />
                    </td>
                    <td className='px-3 py-3 min-w-[170px]'>
                      <input
                        value={pozycja.prodioId}
                        onChange={(event) => ustawPolePozycji(pozycja.id, 'prodioId', event.target.value)}
                        className='w-full rounded-lg border border-obramowanie bg-tlo-karta px-3 py-2.5 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent'
                        placeholder='Opcjonalnie'
                      />
                    </td>
                    <td className='px-3 py-3 min-w-[150px]'>
                      <input
                        type='number'
                        min='0.0001'
                        step='0.0001'
                        value={pozycja.ilosc}
                        onChange={(event) => ustawPolePozycji(pozycja.id, 'ilosc', event.target.value)}
                        className='w-full rounded-lg border border-obramowanie bg-tlo-karta px-3 py-2.5 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent'
                        placeholder='0'
                      />
                    </td>
                    <td className='px-3 py-3 min-w-[150px]'>
                      <input
                        type='number'
                        min='0'
                        step='0.0001'
                        value={pozycja.iloscZamowienia}
                        onChange={(event) => ustawPolePozycji(pozycja.id, 'iloscZamowienia', event.target.value)}
                        className='w-full rounded-lg border border-obramowanie bg-tlo-karta px-3 py-2.5 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent'
                        placeholder='0'
                      />
                    </td>
                    <td className='px-3 py-3 min-w-[120px]'>
                      <input
                        type='number'
                        min='0'
                        step='0.01'
                        value={pozycja.cena}
                        onChange={(event) => ustawPolePozycji(pozycja.id, 'cena', event.target.value)}
                        className='w-full rounded-lg border border-obramowanie bg-tlo-karta px-3 py-2.5 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent'
                        placeholder='0.00'
                      />
                    </td>
                    <td className='px-3 py-3 min-w-[120px]'>
                      <Rozwijane
                        opcje={[
                          { wartosc: '23', etykieta: '23%' },
                          { wartosc: '8', etykieta: '8%' },
                          { wartosc: '5', etykieta: '5%' },
                          { wartosc: '0', etykieta: '0%' },
                        ]}
                        wartosc={pozycja.stawkaVat}
                        onZmiana={(wartosc) => ustawPolePozycji(pozycja.id, 'stawkaVat', String(wartosc))}
                      />
                    </td>
                    <td className='px-3 py-3 text-sm text-tekst-glowny'>{pozycja.waluta}</td>
                    <td className='px-3 py-3 text-sm text-tekst-glowny'>{formatujLiczbe(pozycja.netto)}</td>
                    <td className='px-3 py-3 text-sm text-tekst-glowny'>{formatujLiczbe(pozycja.brutto)}</td>
                    <td className='px-3 py-3 text-sm text-tekst-glowny'>{formatujLiczbe(pozycja.vat)}</td>
                    <td className='px-3 py-3'>
                      <button
                        type='button'
                        onClick={() => usunPozycje(pozycja.id)}
                        className='inline-flex h-10 w-10 items-center justify-center rounded-lg border border-obramowanie bg-tlo-karta text-tekst-drugorzedny transition-colors hover:border-red-500 hover:text-red-400'
                        aria-label='Usun pozycje'
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]'>
          <div className='grid gap-4 md:grid-cols-2'>
            <section className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne'>
              <div className='flex items-center justify-between border-b border-obramowanie bg-tlo-karta px-4 py-3'>
                <div className='flex items-center gap-2 text-sm font-semibold'>
                  <Paperclip size={16} />
                  Pliki
                </div>
                <button type='button' className='rounded-full p-1 text-tekst-drugorzedny transition-colors hover:text-akcent' aria-label='Dodaj plik'>
                  <Plus size={18} />
                </button>
              </div>
              <div className='flex min-h-[124px] items-center justify-center px-4 py-6 text-sm text-tekst-drugorzedny'>
                Sekcja gotowa pod zalaczniki.
              </div>
            </section>

            <section className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne'>
              <div className='flex items-center justify-between border-b border-obramowanie bg-tlo-karta px-4 py-3'>
                <div className='flex items-center gap-2 text-sm font-semibold'>
                  <ImagePlus size={16} />
                  Obrazy
                </div>
                <button type='button' className='rounded-full p-1 text-tekst-drugorzedny transition-colors hover:text-akcent' aria-label='Dodaj obraz'>
                  <Plus size={18} />
                </button>
              </div>
              <div className='flex min-h-[124px] items-center justify-center px-4 py-6 text-sm text-tekst-drugorzedny'>
                Sekcja gotowa pod zdjecia.
              </div>
            </section>
          </div>

          <section className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne'>
            <div className='grid grid-cols-4 border-b border-obramowanie bg-tlo-karta text-center text-xs font-semibold uppercase tracking-wide text-tekst-drugorzedny'>
              <div className='px-3 py-3'>Waluta</div>
              <div className='px-3 py-3'>Netto</div>
              <div className='px-3 py-3'>Brutto</div>
              <div className='px-3 py-3'>VAT</div>
            </div>
            <div className='grid grid-cols-4 text-center text-sm text-tekst-glowny'>
              <div className='px-3 py-4'>{pozycjePodsumowanie[0]?.waluta ?? 'PLN'}</div>
              <div className='px-3 py-4'>{formatujLiczbe(sumaNetto)}</div>
              <div className='px-3 py-4'>{formatujLiczbe(sumaBrutto)}</div>
              <div className='px-3 py-4'>{formatujLiczbe(sumaVat)}</div>
            </div>
          </section>
        </div>

        <div className='flex justify-end'>
          <Przycisk onClick={dodajPozycje} className='rounded-full px-5' type='button'>
            <Plus size={16} />
            Dodaj pozycje
          </Przycisk>
        </div>

        <div>
          <label className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Uwagi</label>
          <textarea
            value={formularz.uwagi}
            onChange={(event) => ustawFormularz((prev) => ({ ...prev, uwagi: event.target.value }))}
            rows={6}
            className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent'
            placeholder='Uwagi do przyjecia magazynowego'
          />
        </div>
        {blad ? <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}
      </div>
    </Modal>
  );
}

export function WydanieFormularz({
  czyOtwarty,
  onZamknij,
  onZapisano,
  magazyny,
  surowce,
  zlecenia,
  domyslnySurowiecId,
  domyslnyMagazynId,
  maxIlosc,
}: {
  czyOtwarty: boolean;
  onZamknij: () => void;
  onZapisano: () => Promise<void> | void;
  magazyny: MagazynDto[];
  surowce: SurowiecDto[];
  zlecenia: ZlecenieDto[];
  domyslnySurowiecId?: number | null;
  domyslnyMagazynId?: number | null;
  maxIlosc?: number;
}) {
  const [formularz, ustawFormularz] = useState<FormularzWydania>({
    magazynId: '',
    data: formatujDateTimeDoInput(),
    rodzajWydania: 'DO_KLIENTA',
    trybZamowienia: 'POJEDYNCZE',
    zlecenieId: '',
    klientId: '',
    identyfikacja: '',
    uwagi: '',
  });
  const [pozycje, ustawPozycje] = useState<PozycjaWydania[]>([utworzPustaPozycje(1)]);
  const [kolejneIdPozycji, ustawKolejneIdPozycji] = useState(2);
  const [klienci, ustawKlienci] = useState<KlientMagazynowyDto[]>([]);
  const [blad, ustawBlad] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [ladowanieKlientow, ustawLadowanieKlientow] = useState(false);

  useEffect(() => {
    if (!czyOtwarty) return;
    ustawFormularz({
      magazynId: domyslnyMagazynId ? String(domyslnyMagazynId) : '',
      data: formatujDateTimeDoInput(),
      rodzajWydania: 'DO_KLIENTA',
      trybZamowienia: 'POJEDYNCZE',
      zlecenieId: '',
      klientId: '',
      identyfikacja: '',
      uwagi: '',
    });
    ustawPozycje([
      {
        ...utworzPustaPozycje(1),
        surowiecId: domyslnySurowiecId ? String(domyslnySurowiecId) : '',
      },
    ]);
    ustawKolejneIdPozycji(2);
    ustawBlad('');
  }, [czyOtwarty, domyslnyMagazynId, domyslnySurowiecId]);

  useEffect(() => {
    if (!czyOtwarty) return;
    if (klienci.length > 0) return;

    const pobierzKlientow = async () => {
      ustawLadowanieKlientow(true);
      try {
        const odpowiedz = await klientApi.get<OdpowiedzApi<KlientMagazynowyDto[]>>('/klienci', {
          params: { strona: 1, iloscNaStrone: 200, sortPole: 'nazwa', sortKierunek: 'asc' },
        });
        ustawKlienci(odpowiedz.data.dane ?? []);
      } catch {
        ustawKlienci([]);
      } finally {
        ustawLadowanieKlientow(false);
      }
    };

    void pobierzKlientow();
  }, [czyOtwarty, klienci.length]);

  const ustawPolePozycji = <K extends keyof PozycjaWydania>(id: number, klucz: K, wartosc: PozycjaWydania[K]) => {
    ustawPozycje((prev) => prev.map((pozycja) => (pozycja.id === id ? { ...pozycja, [klucz]: wartosc } : pozycja)));
  };

  const dodajPozycje = () => {
    ustawPozycje((prev) => [...prev, utworzPustaPozycje(kolejneIdPozycji)]);
    ustawKolejneIdPozycji((prev) => prev + 1);
  };

  const usunPozycje = (id: number) => {
    ustawPozycje((prev) => {
      if (prev.length === 1) {
        return [utworzPustaPozycje(id)];
      }

      return prev.filter((pozycja) => pozycja.id !== id);
    });
  };

  const przekroczonyStan = pozycje.some((pozycja) => maxIlosc !== undefined && Number(pozycja.ilosc) > maxIlosc);
  const bladIlosci = przekroczonyStan && maxIlosc !== undefined
    ? `Ilosc nie moze przekroczyc stanu ${formatujLiczbe(maxIlosc, 4)}.`
    : '';

  const zapisz = async () => {
    const poprawnePozycje = pozycje.filter((pozycja) => pozycja.surowiecId && Number(pozycja.ilosc) > 0);

    if (!formularz.magazynId || poprawnePozycje.length === 0) {
      ustawBlad('Uzupelnij magazyn i dodaj co najmniej jedna pozycje z dodatnia iloscia.');
      return;
    }

    if (bladIlosci) {
      ustawBlad(bladIlosci);
      return;
    }

    ustawZapisywanie(true);
    ustawBlad('');
    try {
      for (const pozycja of poprawnePozycje) {
        await klientApi.post('/magazyn/wydania', {
          magazynId: Number(formularz.magazynId),
          surowiecId: Number(pozycja.surowiecId),
          ilosc: Number(pozycja.ilosc),
          zlecenieId: formularz.zlecenieId ? Number(formularz.zlecenieId) : undefined,
          numer: formularz.identyfikacja || undefined,
          uwagi: formularz.uwagi || undefined,
        });
      }
      await onZapisano();
      onZamknij();
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie zapisac wydania.'));
    } finally {
      ustawZapisywanie(false);
    }
  };

  const pozycjePodsumowanie = pozycje.map((pozycja) => {
    const surowiec = surowce.find((item) => String(item.id) === pozycja.surowiecId);
    const cena = Number(pozycja.cena) || 0;
    const ilosc = Number(pozycja.ilosc) || 0;
    const stawkaVat = Number(pozycja.stawkaVat) || 0;
    const netto = cena * ilosc;
    const vat = netto * (stawkaVat / 100);
    const brutto = netto + vat;

    return {
      ...pozycja,
      surowiec,
      netto,
      vat,
      brutto,
      waluta: surowiec?.waluta ?? 'PLN',
    };
  });

  const sumaNetto = pozycjePodsumowanie.reduce((acc, pozycja) => acc + pozycja.netto, 0);
  const sumaVat = pozycjePodsumowanie.reduce((acc, pozycja) => acc + pozycja.vat, 0);
  const sumaBrutto = pozycjePodsumowanie.reduce((acc, pozycja) => acc + pozycja.brutto, 0);

  return (
    <Modal
      czyOtwarty={czyOtwarty}
      onZamknij={() => !zapisywanie && onZamknij()}
      tytul='Dodaj wydanie magazynowe'
      rozmiar='bardzoDuzy'
      akcje={
        <>
          <Przycisk wariant='drugorzedny' onClick={onZamknij} disabled={zapisywanie}>
            Anuluj
          </Przycisk>
          <Przycisk onClick={() => void zapisz()} czyLaduje={zapisywanie}>
            Zapisz wydanie
          </Przycisk>
        </>
      }
    >
      <div className='space-y-5 text-tekst-glowny'>
        <NaglowekFormularza>
          <div className='grid gap-4 xl:grid-cols-4'>
            <Rozwijane
              etykieta='Magazyn*'
              opcje={opcjeMagazynow(magazyny)}
              wartosc={formularz.magazynId}
              onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, magazynId: String(wartosc) }))}
              placeholder='Wybierz magazyn'
            />
            <Pole
              etykieta='Data*'
              type='datetime-local'
              value={formularz.data}
              ikonaPrefix={<CalendarDays size={16} />}
              onChange={(event) => ustawFormularz((prev) => ({ ...prev, data: event.target.value }))}
            />
            <Rozwijane
              etykieta='Rodzaj wydania*'
              opcje={[
                { wartosc: 'DO_KLIENTA', etykieta: 'Do klienta' },
                { wartosc: 'NA_PRODUKCJE', etykieta: 'Na produkcje' },
                { wartosc: 'ZWROT', etykieta: 'Zwrot' },
                { wartosc: 'INNE', etykieta: 'Inne' },
              ]}
              wartosc={formularz.rodzajWydania}
              onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, rodzajWydania: String(wartosc) }))}
            />
            <div className='rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-3'>
              <span className='mb-2 block text-sm font-medium text-tekst-drugorzedny'>Zamowienie</span>
              <div className='flex flex-wrap gap-5 text-sm'>
                <label className='inline-flex items-center gap-2'>
                  <input type='radio' name='tryb-zamowienia-wydanie' className='h-4 w-4 border-obramowanie bg-tlo-glowne text-akcent' checked={formularz.trybZamowienia === 'POJEDYNCZE'} onChange={() => ustawFormularz((prev) => ({ ...prev, trybZamowienia: 'POJEDYNCZE' }))} />
                  <span>Pojedyncze</span>
                </label>
                <label className='inline-flex items-center gap-2'>
                  <input type='radio' name='tryb-zamowienia-wydanie' className='h-4 w-4 border-obramowanie bg-tlo-glowne text-akcent' checked={formularz.trybZamowienia === 'ZGRUPOWANE'} onChange={() => ustawFormularz((prev) => ({ ...prev, trybZamowienia: 'ZGRUPOWANE' }))} />
                  <span>Zgrupowane</span>
                </label>
              </div>
            </div>
            <Rozwijane
              etykieta={formularz.trybZamowienia === 'ZGRUPOWANE' ? 'Zamowienie zgrupowane' : 'Zamowienie pojedyncze'}
              opcje={zlecenia.map((zlecenie) => ({ wartosc: String(zlecenie.id), etykieta: zlecenie.numer }))}
              wartosc={formularz.zlecenieId}
              onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, zlecenieId: String(wartosc) }))}
              placeholder='Opcjonalnie'
            />
            <Rozwijane
              etykieta='Klient'
              opcje={klienci.map((klient) => ({ wartosc: String(klient.id), etykieta: klient.nazwa }))}
              wartosc={formularz.klientId}
              onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, klientId: String(wartosc) }))}
              placeholder={ladowanieKlientow ? 'Ladowanie klientow...' : 'Wybierz klienta'}
              wylaczone={ladowanieKlientow}
            />
            <Pole
              etykieta='Identyfikacja'
              value={formularz.identyfikacja}
              onChange={(event) => ustawFormularz((prev) => ({ ...prev, identyfikacja: event.target.value }))}
              placeholder='Numer dokumentu / identyfikator'
            />
          </div>
        </NaglowekFormularza>

        <section className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne'>
          <div className='overflow-x-auto'>
            <table className='min-w-[1180px] w-full text-sm'>
              <thead className='bg-tlo-karta text-tekst-drugorzedny'>
                <tr>
                  {['Produkt/surowiec', 'Prodio ID zamowienia', 'Ilosc', 'Ilosc zamowiona', 'Cena', 'Stawka VAT', 'Waluta', 'Netto', 'Brutto', 'VAT', 'Akcje'].map((label) => (
                    <th key={label} className='border-b border-obramowanie px-3 py-3 text-left font-medium'>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pozycjePodsumowanie.map((pozycja) => (
                  <tr key={pozycja.id} className='border-b border-obramowanie/60 align-top last:border-b-0'>
                    <td className='px-3 py-3 min-w-[240px]'>
                      <Rozwijane
                        opcje={opcjeSurowcow(surowce)}
                        wartosc={pozycja.surowiecId}
                        onZmiana={(wartosc) => ustawPolePozycji(pozycja.id, 'surowiecId', String(wartosc))}
                        placeholder='Wybierz surowiec'
                      />
                    </td>
                    <td className='px-3 py-3 min-w-[170px]'>
                      <input
                        value={pozycja.prodioId}
                        onChange={(event) => ustawPolePozycji(pozycja.id, 'prodioId', event.target.value)}
                        className='w-full rounded-lg border border-obramowanie bg-tlo-karta px-3 py-2.5 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent'
                        placeholder='Opcjonalnie'
                      />
                    </td>
                    <td className='px-3 py-3 min-w-[150px]'>
                      <input
                        type='number'
                        min='0.0001'
                        step='0.0001'
                        value={pozycja.ilosc}
                        onChange={(event) => ustawPolePozycji(pozycja.id, 'ilosc', event.target.value)}
                        className='w-full rounded-lg border border-obramowanie bg-tlo-karta px-3 py-2.5 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent'
                        placeholder='0'
                      />
                    </td>
                    <td className='px-3 py-3 min-w-[150px]'>
                      <input
                        type='number'
                        min='0'
                        step='0.0001'
                        value={pozycja.iloscZamowienia}
                        onChange={(event) => ustawPolePozycji(pozycja.id, 'iloscZamowienia', event.target.value)}
                        className='w-full rounded-lg border border-obramowanie bg-tlo-karta px-3 py-2.5 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent'
                        placeholder='0'
                      />
                    </td>
                    <td className='px-3 py-3 min-w-[120px]'>
                      <input
                        type='number'
                        min='0'
                        step='0.01'
                        value={pozycja.cena}
                        onChange={(event) => ustawPolePozycji(pozycja.id, 'cena', event.target.value)}
                        className='w-full rounded-lg border border-obramowanie bg-tlo-karta px-3 py-2.5 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent'
                        placeholder='0.00'
                      />
                    </td>
                    <td className='px-3 py-3 min-w-[120px]'>
                      <Rozwijane
                        opcje={[
                          { wartosc: '23', etykieta: '23%' },
                          { wartosc: '8', etykieta: '8%' },
                          { wartosc: '5', etykieta: '5%' },
                          { wartosc: '0', etykieta: '0%' },
                        ]}
                        wartosc={pozycja.stawkaVat}
                        onZmiana={(wartosc) => ustawPolePozycji(pozycja.id, 'stawkaVat', String(wartosc))}
                      />
                    </td>
                    <td className='px-3 py-3 text-sm text-tekst-glowny'>{pozycja.waluta}</td>
                    <td className='px-3 py-3 text-sm text-tekst-glowny'>{formatujLiczbe(pozycja.netto)}</td>
                    <td className='px-3 py-3 text-sm text-tekst-glowny'>{formatujLiczbe(pozycja.brutto)}</td>
                    <td className='px-3 py-3 text-sm text-tekst-glowny'>{formatujLiczbe(pozycja.vat)}</td>
                    <td className='px-3 py-3'>
                      <button
                        type='button'
                        onClick={() => usunPozycje(pozycja.id)}
                        className='inline-flex h-10 w-10 items-center justify-center rounded-lg border border-obramowanie bg-tlo-karta text-tekst-drugorzedny transition-colors hover:border-red-500 hover:text-red-400'
                        aria-label='Usun pozycje'
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]'>
          <div className='grid gap-4 md:grid-cols-2'>
            <section className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne'>
              <div className='flex items-center justify-between border-b border-obramowanie bg-tlo-karta px-4 py-3'>
                <div className='flex items-center gap-2 text-sm font-semibold'>
                  <Paperclip size={16} />
                  Pliki
                </div>
                <button type='button' className='rounded-full p-1 text-tekst-drugorzedny transition-colors hover:text-akcent' aria-label='Dodaj plik'>
                  <Plus size={18} />
                </button>
              </div>
              <div className='flex min-h-[124px] items-center justify-center px-4 py-6 text-sm text-tekst-drugorzedny'>
                Sekcja gotowa pod zalaczniki.
              </div>
            </section>

            <section className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne'>
              <div className='flex items-center justify-between border-b border-obramowanie bg-tlo-karta px-4 py-3'>
                <div className='flex items-center gap-2 text-sm font-semibold'>
                  <ImagePlus size={16} />
                  Obrazy
                </div>
                <button type='button' className='rounded-full p-1 text-tekst-drugorzedny transition-colors hover:text-akcent' aria-label='Dodaj obraz'>
                  <Plus size={18} />
                </button>
              </div>
              <div className='flex min-h-[124px] items-center justify-center px-4 py-6 text-sm text-tekst-drugorzedny'>
                Sekcja gotowa pod zdjecia.
              </div>
            </section>
          </div>

          <div className='space-y-4'>
            <div className='flex justify-end'>
              <Przycisk onClick={dodajPozycje} className='rounded-full px-5' type='button'>
                <Plus size={16} />
                Dodaj pozycje
              </Przycisk>
            </div>

            <section className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne'>
              <div className='grid grid-cols-4 border-b border-obramowanie bg-tlo-karta text-center text-xs font-semibold uppercase tracking-wide text-tekst-drugorzedny'>
                <div className='px-3 py-3'>Waluta</div>
                <div className='px-3 py-3'>Netto</div>
                <div className='px-3 py-3'>Brutto</div>
                <div className='px-3 py-3'>VAT</div>
              </div>
              <div className='grid grid-cols-4 text-center text-sm text-tekst-glowny'>
                <div className='px-3 py-4'>{pozycjePodsumowanie[0]?.waluta ?? 'PLN'}</div>
                <div className='px-3 py-4'>{formatujLiczbe(sumaNetto)}</div>
                <div className='px-3 py-4'>{formatujLiczbe(sumaBrutto)}</div>
                <div className='px-3 py-4'>{formatujLiczbe(sumaVat)}</div>
              </div>
            </section>
          </div>
        </div>

        <div>
          <label className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Uwagi</label>
          <textarea value={formularz.uwagi} onChange={(event) => ustawFormularz((prev) => ({ ...prev, uwagi: event.target.value }))} rows={6} className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent' />
        </div>
        {blad ? <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}
      </div>
    </Modal>
  );
}

export function KorektaFormularz({
  czyOtwarty,
  onZamknij,
  onZapisano,
  magazyny,
  surowce,
  domyslnySurowiecId,
  domyslnyMagazynId,
}: {
  czyOtwarty: boolean;
  onZamknij: () => void;
  onZapisano: () => Promise<void> | void;
  magazyny: MagazynDto[];
  surowce: SurowiecDto[];
  domyslnySurowiecId?: number | null;
  domyslnyMagazynId?: number | null;
}) {
  const [formularz, ustawFormularz] = useState<FormularzKorekty>({
    surowiecId: '',
    magazynId: '',
    ilosc: '',
    uwagi: '',
    numer: '',
  });
  const [blad, ustawBlad] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);

  useEffect(() => {
    if (!czyOtwarty) return;
    ustawFormularz({
      surowiecId: domyslnySurowiecId ? String(domyslnySurowiecId) : '',
      magazynId: domyslnyMagazynId ? String(domyslnyMagazynId) : '',
      ilosc: '',
      uwagi: '',
      numer: '',
    });
    ustawBlad('');
  }, [czyOtwarty, domyslnyMagazynId, domyslnySurowiecId]);

  const zapisz = async () => {
    if (!formularz.surowiecId || !formularz.magazynId || Number(formularz.ilosc) === 0 || !formularz.uwagi.trim()) {
      ustawBlad('Wymagane sa: magazyn, surowiec, niezerowa ilosc i powod korekty.');
      return;
    }

    ustawZapisywanie(true);
    ustawBlad('');
    try {
      await klientApi.post('/magazyn/korekty', {
        magazynId: Number(formularz.magazynId),
        surowiecId: Number(formularz.surowiecId),
        ilosc: Number(formularz.ilosc),
        uwagi: formularz.uwagi.trim(),
        numer: formularz.numer || undefined,
      });
      await onZapisano();
      onZamknij();
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie zapisac korekty.'));
    } finally {
      ustawZapisywanie(false);
    }
  };

  return (
    <Modal
      czyOtwarty={czyOtwarty}
      onZamknij={() => !zapisywanie && onZamknij()}
      tytul='Korekta stanu'
      rozmiar='duzy'
      akcje={
        <>
          <Przycisk wariant='drugorzedny' onClick={onZamknij} disabled={zapisywanie}>
            Anuluj
          </Przycisk>
          <Przycisk onClick={() => void zapisz()} czyLaduje={zapisywanie}>
            Zapisz korekte
          </Przycisk>
        </>
      }
    >
      <div className='space-y-4 text-slate-100'>
        <NaglowekFormularza>
          <div className='grid gap-4 md:grid-cols-2'>
            <Rozwijane etykieta='Surowiec' opcje={opcjeSurowcow(surowce)} wartosc={formularz.surowiecId} onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, surowiecId: String(wartosc) }))} placeholder='Wybierz surowiec' />
            <Rozwijane etykieta='Magazyn' opcje={opcjeMagazynow(magazyny)} wartosc={formularz.magazynId} onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, magazynId: String(wartosc) }))} placeholder='Wybierz magazyn' />
            <Pole etykieta='Ilosc*' type='number' step='0.0001' value={formularz.ilosc} onChange={(event) => ustawFormularz((prev) => ({ ...prev, ilosc: event.target.value }))} />
            <Pole etykieta='Numer dok.' value={formularz.numer} onChange={(event) => ustawFormularz((prev) => ({ ...prev, numer: event.target.value }))} />
          </div>
        </NaglowekFormularza>
        <div>
          <label className='mb-1.5 block text-sm font-medium text-slate-300'>Powod korekty*</label>
          <textarea value={formularz.uwagi} onChange={(event) => ustawFormularz((prev) => ({ ...prev, uwagi: event.target.value }))} rows={4} className='w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-orange-400' />
        </div>
        {blad ? <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}
      </div>
    </Modal>
  );
}

export function PrzeniesFormularz({
  czyOtwarty,
  onZamknij,
  onZapisano,
  magazyny,
  surowce,
  domyslnySurowiecId,
  domyslnyMagazynId,
  maxIlosc,
}: {
  czyOtwarty: boolean;
  onZamknij: () => void;
  onZapisano: () => Promise<void> | void;
  magazyny: MagazynDto[];
  surowce: SurowiecDto[];
  domyslnySurowiecId?: number | null;
  domyslnyMagazynId?: number | null;
  maxIlosc?: number;
}) {
  const [formularz, ustawFormularz] = useState<FormularzPrzeniesienia>({
    surowiecId: '',
    magazynId: '',
    magazynDocelId: '',
    ilosc: '',
    uwagi: '',
    numer: '',
  });
  const [blad, ustawBlad] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);

  useEffect(() => {
    if (!czyOtwarty) return;
    ustawFormularz({
      surowiecId: domyslnySurowiecId ? String(domyslnySurowiecId) : '',
      magazynId: domyslnyMagazynId ? String(domyslnyMagazynId) : '',
      magazynDocelId: '',
      ilosc: '',
      uwagi: '',
      numer: '',
    });
    ustawBlad('');
  }, [czyOtwarty, domyslnyMagazynId, domyslnySurowiecId]);

  const bladIlosci = formularz.ilosc && maxIlosc !== undefined && Number(formularz.ilosc) > maxIlosc
    ? `Mozesz przeniesc maksymalnie ${formatujLiczbe(maxIlosc, 4)}.`
    : '';

  const zapisz = async () => {
    if (!formularz.surowiecId || !formularz.magazynId || !formularz.magazynDocelId || !(Number(formularz.ilosc) > 0)) {
      ustawBlad('Uzupelnij wszystkie wymagane pola.');
      return;
    }

    if (formularz.magazynId === formularz.magazynDocelId) {
      ustawBlad('Magazyn docelowy musi byc inny niz zrodlowy.');
      return;
    }

    if (bladIlosci) {
      ustawBlad(bladIlosci);
      return;
    }

    ustawZapisywanie(true);
    ustawBlad('');
    try {
      await klientApi.post('/magazyn/przeniesienia', {
        magazynId: Number(formularz.magazynId),
        magazynDocelId: Number(formularz.magazynDocelId),
        surowiecId: Number(formularz.surowiecId),
        ilosc: Number(formularz.ilosc),
        uwagi: formularz.uwagi || undefined,
        numer: formularz.numer || undefined,
      });
      await onZapisano();
      onZamknij();
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie zapisac przeniesienia.'));
    } finally {
      ustawZapisywanie(false);
    }
  };

  return (
    <Modal
      czyOtwarty={czyOtwarty}
      onZamknij={() => !zapisywanie && onZamknij()}
      tytul='Przeniesienie miedzy magazynami'
      rozmiar='duzy'
      akcje={
        <>
          <Przycisk wariant='drugorzedny' onClick={onZamknij} disabled={zapisywanie}>
            Anuluj
          </Przycisk>
          <Przycisk onClick={() => void zapisz()} czyLaduje={zapisywanie}>
            Zapisz przeniesienie
          </Przycisk>
        </>
      }
    >
      <div className='space-y-4 text-slate-100'>
        <NaglowekFormularza>
          <div className='grid gap-4 md:grid-cols-2'>
            <Rozwijane etykieta='Surowiec' opcje={opcjeSurowcow(surowce)} wartosc={formularz.surowiecId} onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, surowiecId: String(wartosc) }))} placeholder='Wybierz surowiec' />
            <Pole etykieta='Ilosc*' type='number' min='0.0001' step='0.0001' value={formularz.ilosc} onChange={(event) => ustawFormularz((prev) => ({ ...prev, ilosc: event.target.value }))} bladOpisu={bladIlosci || undefined} />
            <Rozwijane etykieta='Magazyn zrodlowy*' opcje={opcjeMagazynow(magazyny)} wartosc={formularz.magazynId} onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, magazynId: String(wartosc) }))} placeholder='Wybierz magazyn' />
            <Rozwijane etykieta='Magazyn docelowy*' opcje={opcjeMagazynow(magazyny)} wartosc={formularz.magazynDocelId} onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, magazynDocelId: String(wartosc) }))} placeholder='Wybierz magazyn' />
            <Pole etykieta='Numer dok.' value={formularz.numer} onChange={(event) => ustawFormularz((prev) => ({ ...prev, numer: event.target.value }))} />
          </div>
        </NaglowekFormularza>
        <div>
          <label className='mb-1.5 block text-sm font-medium text-slate-300'>Uwagi</label>
          <textarea value={formularz.uwagi} onChange={(event) => ustawFormularz((prev) => ({ ...prev, uwagi: event.target.value }))} rows={4} className='w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-orange-400' />
        </div>
        {blad ? <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}
      </div>
    </Modal>
  );
}

export default function StanyMagazynowe() {
  const { magazyny, surowce, zlecenia, odswiez: odswiezSlowniki } = useMagazynSlowniki();
  const [zakladka, ustawZakladke] = useState<TypZakladki>('SUROWCE');
  const [magazynId, ustawMagazynId] = useState('');
  const [stany, ustawStany] = useState<StanMagazynowyDto[]>([]);
  const [ladowanie, ustawLadowanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [szukaj, ustawSzukaj] = useState('');
  const [pokazNieaktywne, ustawPokazNieaktywne] = useState(false);
  const [strona, ustawStrone] = useState(1);
  const [czyModalNowegoSurowca, ustawCzyModalNowegoSurowca] = useState(false);
  const [szczegolySurowca, ustawSzczegolySurowca] = useState<StanMagazynowyDto | null>(null);
  const [modal, ustawModal] = useState<ModalOperacjiMagazynowej | null>(null);
  const [usuwanieSurowcaId, ustawUsuwanieSurowcaId] = useState<number | null>(null);

  const pobierzStany = async () => {
    ustawLadowanie(true);
    ustawBlad('');
    try {
      const odpowiedz = await klientApi.get<OdpowiedzApi<StanMagazynowyDto[]>>('/magazyn/stany', {
        params: {
          typ: zakladka,
          magazynId: magazynId || undefined,
        },
      });
      ustawStany(odpowiedz.data.dane);
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie pobrac stanow magazynowych.'));
      ustawStany([]);
    } finally {
      ustawLadowanie(false);
    }
  };

  useEffect(() => {
    void pobierzStany();
  }, [zakladka, magazynId]);

  const odswiezWszystko = async () => {
    await Promise.all([pobierzStany(), odswiezSlowniki()]);
  };

  const filtrowane = useMemo(() => {
    return stany.filter((wiersz) => {
      if (!pokazNieaktywne && !wiersz.aktywny) return false;
      if (!szukaj.trim()) return true;
      return wiersz.nazwa.toLowerCase().includes(szukaj.trim().toLowerCase());
    });
  }, [pokazNieaktywne, stany, szukaj]);

  const liczbaStron = Math.max(1, Math.ceil(filtrowane.length / ROZMIAR_STRONY));
  const aktualnaStrona = Math.min(strona, liczbaStron);
  const widoczne = filtrowane.slice((aktualnaStrona - 1) * ROZMIAR_STRONY, aktualnaStrona * ROZMIAR_STRONY);

  useEffect(() => {
    ustawStrone(1);
  }, [szukaj, pokazNieaktywne, zakladka, magazynId]);

  const eksportujCsv = () => {
    const header = ['Nazwa', 'Zapotrzebowanie', 'Na stanie', 'Na produkcji', 'Zamowiono', 'Sr. cena zakupu', 'Sr. wartosc zapasow', 'Cena', 'Waluta'];
    const rows = filtrowane.map((wiersz) => [
      wiersz.nazwa,
      wiersz.zapotrzebowanie,
      wiersz.naStan,
      wiersz.naProdukcji,
      wiersz.zamowiono,
      wiersz.sredniaCena,
      wiersz.wartoscZapasow,
      wiersz.cena,
      wiersz.waluta,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const okno = window.open('', '_blank');
    if (okno) {
      okno.document.write(`<pre>${csv}</pre>`);
      okno.document.title = 'stany-magazynowe.csv';
    }
  };

  const drukuj = (wiersz: StanMagazynowyDto) => {
    const okno = window.open('', '_blank', 'width=900,height=700');
    if (!okno) return;
    okno.document.write(`
      <html><head><title>${wiersz.nazwa}</title></head><body style="font-family:Arial;padding:24px">
      <h1>${wiersz.nazwa}</h1>
      <p>Na stanie: ${formatujLiczbe(wiersz.naStan, 4)} ${wiersz.jednostka}</p>
      <p>Zapotrzebowanie: ${formatujLiczbe(wiersz.zapotrzebowanie, 4)}</p>
      <p>Na produkcji: ${formatujLiczbe(wiersz.naProdukcji, 4)}</p>
      <p>Zamowiono: ${formatujLiczbe(wiersz.zamowiono, 4)}</p>
      <p>Srednia cena: ${formatujLiczbe(wiersz.sredniaCena)} ${wiersz.waluta}</p>
      <p>Wartosc zapasow: ${formatujLiczbe(wiersz.wartoscZapasow)} ${wiersz.waluta}</p>
      </body></html>
    `);
    okno.document.close();
    okno.print();
  };

  const otworzSzczegolySurowca = (wiersz: StanMagazynowyDto) => {
    ustawSzczegolySurowca(wiersz);
  };

  const otworzModalOperacji = (
    typ: TypOperacjiMagazynowej,
    rekord: StanMagazynowyDto,
    powrotDoSzczegolow = false,
  ) => {
    if (powrotDoSzczegolow) {
      ustawSzczegolySurowca(null);
    }
    ustawModal({ typ, rekord, powrotDoSzczegolow });
  };

  const zamknijModalOperacji = () => {
    if (modal?.powrotDoSzczegolow && modal.rekord) {
      ustawSzczegolySurowca(modal.rekord);
    }
    ustawModal(null);
  };

  const usunSurowiec = async (rekord: StanMagazynowyDto) => {
    const potwierdzone = window.confirm(`Czy na pewno chcesz usunac surowiec "${rekord.nazwa}"?`);
    if (!potwierdzone) return;

    ustawUsuwanieSurowcaId(rekord.id);
    ustawBlad('');

    try {
      await klientApi.delete(`/surowce/${rekord.id}`);
      if (szczegolySurowca?.id === rekord.id) {
        ustawSzczegolySurowca(null);
      }
      if (modal?.rekord?.id === rekord.id) {
        ustawModal(null);
      }
      await odswiezWszystko();
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie usunac surowca.'));
    } finally {
      ustawUsuwanieSurowcaId(null);
    }
  };

  return (
    <div className='space-y-6 text-slate-100'>
      <section className={`${KLASY_KARTY} bg-gradient-to-br from-[#1E2A3A] via-[#182230] to-[#0f1724] p-6`}>
        <div className='flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between'>
          <div>
            <div className='mb-3 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-200'>Sprint 9</div>
            <h1 className='text-3xl font-semibold'>Stany magazynowe</h1>
            <p className='mt-2 max-w-3xl text-sm text-slate-400'>Operacyjny widok zapasow, zapotrzebowania i zamowien do dostawcow.</p>
          </div>
          <Przycisk wariant='drugorzedny' onClick={eksportujCsv}>
            <FileSpreadsheet size={16} />
            Eksport CSV
          </Przycisk>
        </div>
      </section>

      <section className={`${KLASY_KARTY} p-4`}>
        <div className='flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between'>
          <div className='flex flex-wrap items-center gap-3'>
            <div className='flex flex-wrap gap-3'>
              {(['SUROWCE', 'PRODUKTY'] as TypZakladki[]).map((tab) => (
                <button key={tab} type='button' onClick={() => ustawZakladke(tab)} className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${zakladka === tab ? 'bg-orange-400 text-slate-950' : 'bg-slate-950/50 text-slate-300 hover:bg-slate-800'}`}>
                  {tab === 'SUROWCE' ? 'Surowce' : 'Produkty'}
                </button>
              ))}
            </div>

            {zakladka === 'SUROWCE' ? (
              <Przycisk className='rounded-2xl px-5' onClick={() => ustawCzyModalNowegoSurowca(true)}>
                <Plus size={16} />
                Dodaj
              </Przycisk>
            ) : null}
          </div>
          <div className='grid gap-4 md:grid-cols-[280px_280px]'>
            <Rozwijane etykieta='Wybierz magazyn' opcje={opcjeMagazynow(magazyny)} wartosc={magazynId} onZmiana={(wartosc) => ustawMagazynId(String(wartosc))} placeholder='Wszystkie magazyny' />
            <Pole etykieta='Szukaj' value={szukaj} onChange={(event) => ustawSzukaj(event.target.value)} placeholder={`Filtruj po nazwie ${zakladka === 'SUROWCE' ? 'surowca' : 'produktu'}`} ikonaPrefix={<Search size={16} />} />
          </div>
        </div>
      </section>

      <section className={`${KLASY_KARTY} p-4`}>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-4'>
          <Przelacznik wartosc={pokazNieaktywne} onZmiana={ustawPokazNieaktywne} etykieta='Wyswietl nieaktywne' />
          <div className='text-sm text-slate-400'>Rekordy: <span className='font-semibold text-orange-200'>{filtrowane.length}</span></div>
        </div>

        {blad ? <div className='mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}

        <div className={KLASY_TABELI}>
          <table className='min-w-[1500px] w-full text-sm'>
            <thead className='bg-slate-950/80 text-slate-300'>
              <tr>{['Nazwa', 'Zapotrzebowanie', 'Na stanie', 'Na produkcji', 'Zamowiono', 'Sr. cena zakupu', 'Sr. wartosc zapasow', 'Cena', 'Waluta', 'Akcje'].map((label) => <th key={label} className='px-4 py-3 text-left font-medium'>{label}</th>)}</tr>
            </thead>
            <tbody>
              {ladowanie ? (
                <tr><td colSpan={10} className='px-4 py-10 text-center text-slate-400'>Ladowanie stanow magazynowych...</td></tr>
              ) : widoczne.length === 0 ? (
                <tr><td colSpan={10} className='px-4 py-10 text-center text-slate-400'>Brak danych dla wybranych filtrow.</td></tr>
              ) : (
                widoczne.map((wiersz) => (
                  <tr key={wiersz.id} className='border-t border-slate-800 odd:bg-slate-900/20'>
                    <td className='px-4 py-3 text-left'><button type='button' onClick={() => otworzSzczegolySurowca(wiersz)} className='block w-full text-left font-semibold text-orange-200 hover:text-orange-100'>{wiersz.nazwa}</button></td>
                    <td className='px-4 py-3'>{formatujLiczbe(wiersz.zapotrzebowanie, 4)}</td>
                    <td className={`px-4 py-3 font-semibold ${wiersz.naStan <= 0 ? 'text-red-300' : 'text-slate-100'}`}>{formatujLiczbe(wiersz.naStan, 4)}</td>
                    <td className={`px-4 py-3 ${wiersz.naProdukcji < 0 ? 'text-red-300' : 'text-slate-100'}`}>{formatujLiczbe(wiersz.naProdukcji, 4)}</td>
                    <td className='px-4 py-3'>{formatujLiczbe(wiersz.zamowiono, 4)}</td>
                    <td className='px-4 py-3'>{formatujLiczbe(wiersz.sredniaCena)} {wiersz.waluta}</td>
                    <td className='px-4 py-3'>{formatujLiczbe(wiersz.wartoscZapasow)} {wiersz.waluta}</td>
                    <td className='px-4 py-3'>{formatujLiczbe(wiersz.cena)} {wiersz.waluta}</td>
                    <td className='px-4 py-3'>{wiersz.waluta}</td>
                    <td className='px-4 py-3 whitespace-nowrap'>
                      <div className='flex w-max flex-nowrap items-center gap-2'>
                        <button type='button' title='Zamow' onClick={() => (window.location.href = '/magazyn/zamowienia-dostawcow')} className='rounded-xl bg-slate-800 px-2.5 py-1.5 text-orange-200 hover:bg-slate-700'>📦</button>
                        <button type='button' title='Przyjmij' onClick={() => otworzModalOperacji('PRZYJECIE', wiersz)} className='rounded-xl bg-slate-800 px-2.5 py-1.5 text-emerald-200 hover:bg-slate-700'>✅</button>
                        <button type='button' title='Wydaj' onClick={() => otworzModalOperacji('WYDANIE', wiersz)} className='rounded-xl bg-slate-800 px-2.5 py-1.5 text-amber-200 hover:bg-slate-700'>📤</button>
                        <button type='button' title='Korekta' onClick={() => otworzModalOperacji('KOREKTA', wiersz)} className='rounded-xl bg-slate-800 px-2.5 py-1.5 text-cyan-200 hover:bg-slate-700'>🧮</button>
                        <button type='button' title='Przenies' onClick={() => otworzModalOperacji('PRZENIESIENIE', wiersz)} className='rounded-xl bg-slate-800 px-2.5 py-1.5 text-sky-200 hover:bg-slate-700'>🔄</button>
                        <button type='button' title='Drukuj' onClick={() => drukuj(wiersz)} className='rounded-xl bg-slate-800 px-2.5 py-1.5 text-slate-200 hover:bg-slate-700'>🖨️</button>
                        <button
                          type='button'
                          title='Usun'
                          aria-label={`Usun surowiec ${wiersz.nazwa}`}
                          onClick={() => void usunSurowiec(wiersz)}
                          disabled={usuwanieSurowcaId === wiersz.id}
                          className='rounded-xl bg-red-500/10 px-2.5 py-1.5 text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className='mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-slate-300'>
          <span>Strona {aktualnaStrona} z {liczbaStron}</span>
          <div className='flex gap-2'>
            <Przycisk wariant='drugorzedny' rozmiar='maly' disabled={aktualnaStrona <= 1} onClick={() => ustawStrone((prev) => prev - 1)}>Poprzednia</Przycisk>
            <Przycisk wariant='drugorzedny' rozmiar='maly' disabled={aktualnaStrona >= liczbaStron} onClick={() => ustawStrone((prev) => prev + 1)}>Nastepna</Przycisk>
          </div>
        </div>
      </section>

      <PrzyjecieFormularz czyOtwarty={modal?.typ === 'PRZYJECIE'} onZamknij={zamknijModalOperacji} onZapisano={odswiezWszystko} magazyny={magazyny} surowce={surowce} domyslnySurowiecId={modal?.rekord?.id} domyslnyMagazynId={magazynId ? Number(magazynId) : null} />
      <WydanieFormularz czyOtwarty={modal?.typ === 'WYDANIE'} onZamknij={zamknijModalOperacji} onZapisano={odswiezWszystko} magazyny={magazyny} surowce={surowce} zlecenia={zlecenia} domyslnySurowiecId={modal?.rekord?.id} domyslnyMagazynId={magazynId ? Number(magazynId) : null} maxIlosc={modal?.rekord?.naStan} />
      <KorektaFormularz czyOtwarty={modal?.typ === 'KOREKTA'} onZamknij={zamknijModalOperacji} onZapisano={odswiezWszystko} magazyny={magazyny} surowce={surowce} domyslnySurowiecId={modal?.rekord?.id} domyslnyMagazynId={magazynId ? Number(magazynId) : null} />
      <PrzeniesFormularz czyOtwarty={modal?.typ === 'PRZENIESIENIE'} onZamknij={zamknijModalOperacji} onZapisano={odswiezWszystko} magazyny={magazyny} surowce={surowce} domyslnySurowiecId={modal?.rekord?.id} domyslnyMagazynId={magazynId ? Number(magazynId) : null} maxIlosc={modal?.rekord?.naStan} />
      <NowySurowiecFormularz czyOtwarty={czyModalNowegoSurowca} onZamknij={() => ustawCzyModalNowegoSurowca(false)} onZapisano={odswiezWszystko} />
      <SzczegolySurowcaModal
        czyOtwarty={Boolean(szczegolySurowca)}
        surowiecId={szczegolySurowca?.id ?? null}
        rekord={szczegolySurowca}
        onZamknij={() => ustawSzczegolySurowca(null)}
        onUsun={() => {
          if (!szczegolySurowca) return;
          void usunSurowiec(szczegolySurowca);
        }}
        usuwanie={usuwanieSurowcaId === szczegolySurowca?.id}
        onPrzyjecie={() => {
          if (!szczegolySurowca) return;
          otworzModalOperacji('PRZYJECIE', szczegolySurowca, true);
        }}
        onWydanie={() => {
          if (!szczegolySurowca) return;
          otworzModalOperacji('WYDANIE', szczegolySurowca, true);
        }}
        onKorekta={() => {
          if (!szczegolySurowca) return;
          otworzModalOperacji('KOREKTA', szczegolySurowca, true);
        }}
        onPrzeniesienie={() => {
          if (!szczegolySurowca) return;
          otworzModalOperacji('PRZENIESIENIE', szczegolySurowca, true);
        }}
      />
    </div>
  );
}
