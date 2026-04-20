import { useEffect, useMemo, useState } from 'react';
import { Clock3, Coffee, DoorClosed, DoorOpen, ScanSearch } from 'lucide-react';
import Pole from '../komponenty/ui/Pole';
import Przycisk from '../komponenty/ui/Przycisk';
import Rozwijane from '../komponenty/ui/Rozwijane';
import {
  type HistoriaPauzy,
  type RejestracjaCzasu,
  useWejsciaWyjscia,
} from '../hooki/useWejsciaWyjscia';

type WidokHistorii =
  | 'PRZEGLAD_ZDARZEN'
  | 'WEJSCIA_OPERATOROW'
  | 'WYJSCIA_OPERATOROW'
  | 'PRZERWY'
  | 'RAPORT_CZASU'
  | 'KARTA_PRACY';

type RaportZakres = 'TYDZIEN' | 'MIESIAC';

const ETYKIETY_WIDOKOW: Record<WidokHistorii, { tytul: string; opis: string }> = {
  PRZEGLAD_ZDARZEN: {
    tytul: 'Przeglad zdarzen',
    opis: 'Pelna historia wejsc i wyjsc w jednej tabeli z filtrem po pracowniku i dacie.',
  },
  WEJSCIA_OPERATOROW: {
    tytul: 'Wejscia operatorow',
    opis: 'Widok zarejestrowanych wejsc na hale produkcyjna.',
  },
  WYJSCIA_OPERATOROW: {
    tytul: 'Wyjscia operatorow',
    opis: 'Rejestr zamknietych zmian i wyjsc z hali.',
  },
  PRZERWY: {
    tytul: 'Przerwy',
    opis: 'Historia pauz z typem, czasem trwania i szczegolami operacyjnymi.',
  },
  RAPORT_CZASU: {
    tytul: 'Raport czasu',
    opis: 'Zestawienie godzin pracy per pracownik w ukladzie tygodniowym lub miesiecznym.',
  },
  KARTA_PRACY: {
    tytul: 'Karta pracy',
    opis: 'Zestawienie metryk czasu pracy dla wybranego pracownika – wejscia, wyjscia, nadgodziny i przerwy.',
  },
};

function pobierzKomunikatBledu(blad: unknown, domyslny: string) {
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

  return domyslny;
}

function formatujDate(value: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatujCzas(minuty: number) {
  const safe = Math.max(0, Math.round(minuty));
  const godziny = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const reszta = String(safe % 60).padStart(2, '0');
  return `${godziny}:${reszta}`;
}

function domyslnaDataOd(zakres: RaportZakres) {
  const date = new Date();
  if (zakres === 'TYDZIEN') {
    const day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day);
  } else {
    date.setDate(1);
  }
  return date.toISOString().slice(0, 10);
}

function domyslnaDataDo(zakres: RaportZakres) {
  const date = new Date();
  if (zakres === 'TYDZIEN') {
    const day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() + (6 - day));
  } else {
    date.setMonth(date.getMonth() + 1, 0);
  }
  return date.toISOString().slice(0, 10);
}

export default function HistoriaWejscWyjsc({ widok }: { widok: WidokHistorii }) {
  const { pracownicy, pobierzPauzy, pobierzRejestracje } = useWejsciaWyjscia();
  const meta = ETYKIETY_WIDOKOW[widok];
  const [blad, ustawBlad] = useState('');
  const [ladowanie, ustawLadowanie] = useState(true);
  const [rejestracje, ustawRejestracje] = useState<RejestracjaCzasu[]>([]);
  const [pauzy, ustawPauzy] = useState<HistoriaPauzy[]>([]);
  const [filtrPracownika, ustawFiltrPracownika] = useState('');
  const [dataOd, ustawDateOd] = useState('');
  const [dataDo, ustawDateDo] = useState('');
  const [raportZakres, ustawRaportZakres] = useState<RaportZakres>('TYDZIEN');

  useEffect(() => {
    if (widok !== 'RAPORT_CZASU') return;
    ustawDateOd((prev) => prev || domyslnaDataOd(raportZakres));
    ustawDateDo((prev) => prev || domyslnaDataDo(raportZakres));
  }, [raportZakres, widok]);

  useEffect(() => {
    let anulowano = false;

    async function zaladuj() {
      ustawLadowanie(true);
      ustawBlad('');

      try {
        if (widok === 'PRZERWY') {
          const odpowiedz = await pobierzPauzy({
            page: 1,
            limit: 300,
            pracownikId: filtrPracownika,
            dataOd,
            dataDo,
          });

          if (!anulowano) {
            ustawPauzy(odpowiedz.dane);
            ustawRejestracje([]);
          }
          return;
        }

        const odpowiedz = await pobierzRejestracje({
          page: 1,
          limit: widok === 'RAPORT_CZASU' ? 500 : 300,
          pracownikId: filtrPracownika,
          dataOd,
          dataDo,
        });

        if (!anulowano) {
          ustawRejestracje(odpowiedz.dane);
          ustawPauzy([]);
        }
      } catch (error) {
        if (!anulowano) {
          ustawBlad(
            pobierzKomunikatBledu(
              error,
              widok === 'PRZERWY'
                ? 'Nie udalo sie pobrac historii przerw.'
                : 'Nie udalo sie pobrac historii wejsc i wyjsc.'
            )
          );
          ustawRejestracje([]);
          ustawPauzy([]);
        }
      } finally {
        if (!anulowano) {
          ustawLadowanie(false);
        }
      }
    }

    void zaladuj();
    return () => {
      anulowano = true;
    };
  }, [dataDo, dataOd, filtrPracownika, pobierzPauzy, pobierzRejestracje, widok]);

  const opcjePracownikow = pracownicy.map((pracownik) => ({
    wartosc: String(pracownik.id),
    etykieta: `${pracownik.imie} ${pracownik.nazwisko}`,
  }));

  const widoczneRejestracje = useMemo(() => {
    if (widok === 'WEJSCIA_OPERATOROW') return rejestracje.filter((item) => Boolean(item.wejscie));
    if (widok === 'WYJSCIA_OPERATOROW') return rejestracje.filter((item) => Boolean(item.wyjscie));
    return rejestracje;
  }, [rejestracje, widok]);

  const raportCzasu = useMemo(() => {
    const mapa = new Map<
      number,
      {
        id: number;
        imie: string;
        nazwisko: string;
        liczbaWejsc: number;
        liczbaWyjsc: number;
        czasPracyMinuty: number;
        czasPauzyMinuty: number;
        nadgodzinyMinuty: number;
      }
    >();

    for (const wpis of rejestracje) {
      const rekord = mapa.get(wpis.pracownikId) ?? {
        id: wpis.pracownikId,
        imie: wpis.pracownik.imie,
        nazwisko: wpis.pracownik.nazwisko,
        liczbaWejsc: 0,
        liczbaWyjsc: 0,
        czasPracyMinuty: 0,
        czasPauzyMinuty: 0,
        nadgodzinyMinuty: 0,
      };

      rekord.liczbaWejsc += wpis.wejscie ? 1 : 0;
      rekord.liczbaWyjsc += wpis.wyjscie ? 1 : 0;
      rekord.czasPracyMinuty += wpis.czasPracyMinuty;
      rekord.czasPauzyMinuty += wpis.czasPauzyMinuty;
      rekord.nadgodzinyMinuty += wpis.nadgodzinyMinuty;
      mapa.set(wpis.pracownikId, rekord);
    }

    return Array.from(mapa.values()).sort((a, b) =>
      `${a.nazwisko} ${a.imie}`.localeCompare(`${b.nazwisko} ${b.imie}`, 'pl')
    );
  }, [rejestracje]);

  return (
    <div className='space-y-6 text-slate-100'>
      <section className='rounded-[28px] border border-slate-700 bg-gradient-to-br from-[#1E2A3A] via-slate-900 to-[#16202d] p-6 shadow-2xl shadow-black/20'>
        <div className='flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between'>
          <div>
            <div className='mb-3 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-200'>
              {widok === 'PRZEGLAD_ZDARZEN' && <ScanSearch size={14} />}
              {widok === 'WEJSCIA_OPERATOROW' && <DoorOpen size={14} />}
              {widok === 'WYJSCIA_OPERATOROW' && <DoorClosed size={14} />}
              {widok === 'PRZERWY' && <Coffee size={14} />}
              {widok === 'RAPORT_CZASU' && <Clock3 size={14} />}
          {widok === 'KARTA_PRACY' && <Clock3 size={14} />}
              Sprint 10
            </div>
            <h1 className='text-3xl font-semibold tracking-tight'>{meta.tytul}</h1>
            <p className='mt-2 max-w-3xl text-sm text-slate-400'>{meta.opis}</p>
          </div>
          <div className='rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-300'>
            Aktywnych pracownikow: <span className='font-semibold text-orange-200'>{pracownicy.length}</span>
          </div>
        </div>
      </section>

      <section className='rounded-3xl border border-slate-700 bg-slate-900/70 p-4'>
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          <Rozwijane etykieta='Pracownik' opcje={opcjePracownikow} wartosc={filtrPracownika} onZmiana={(wartosc) => ustawFiltrPracownika(String(wartosc))} placeholder='Wszyscy pracownicy' />
          <Pole etykieta='Data od' type='date' value={dataOd} onChange={(event) => ustawDateOd(event.target.value)} />
          <Pole etykieta='Data do' type='date' value={dataDo} onChange={(event) => ustawDateDo(event.target.value)} />
          {widok === 'RAPORT_CZASU' ? (
            <Rozwijane
              etykieta='Zakres'
              wartosc={raportZakres}
              onZmiana={(wartosc) => {
                const next = String(wartosc) as RaportZakres;
                ustawRaportZakres(next);
                ustawDateOd(domyslnaDataOd(next));
                ustawDateDo(domyslnaDataDo(next));
              }}
              opcje={[
                { wartosc: 'TYDZIEN', etykieta: 'Tydzien' },
                { wartosc: 'MIESIAC', etykieta: 'Miesiac' },
              ]}
            />
          ) : (
            <div className='flex items-end'>
              <Przycisk wariant='drugorzedny' onClick={() => { ustawFiltrPracownika(''); ustawDateOd(''); ustawDateDo(''); }}>
                Wyczyść filtry
              </Przycisk>
            </div>
          )}
        </div>
      </section>

      {blad ? <div className='rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}

      {widok !== 'PRZERWY' && widok !== 'RAPORT_CZASU' ? (
        <section className='overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900/60'>
          <table className='min-w-[1220px] w-full text-sm'>
            <thead className='bg-slate-950/80 text-slate-300'>
              <tr>
                {['Pracownik', 'Wejscie', 'Wyjscie', 'Zmiana', 'Czas pracy', 'Czas przerw', 'Nadgodziny', 'Status'].map((label) => (
                  <th key={label} className='px-4 py-3 text-left font-medium'>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ladowanie ? (
                <tr><td colSpan={8} className='px-4 py-10 text-center text-slate-400'>Ladowanie historii...</td></tr>
              ) : widoczneRejestracje.length === 0 ? (
                <tr><td colSpan={8} className='px-4 py-10 text-center text-slate-400'>Brak zdarzen dla wybranych filtrow.</td></tr>
              ) : (
                widoczneRejestracje.map((wiersz) => (
                  <tr key={wiersz.id} className='border-t border-slate-800 text-slate-100 odd:bg-slate-900/20'>
                    <td className='px-4 py-3 font-medium'>{wiersz.pracownik.imie} {wiersz.pracownik.nazwisko}</td>
                    <td className='px-4 py-3'>{formatujDate(wiersz.wejscie)}</td>
                    <td className='px-4 py-3'>{formatujDate(wiersz.wyjscie)}</td>
                    <td className='px-4 py-3'>{wiersz.zmiana ?? '--'}</td>
                    <td className='px-4 py-3'>{formatujCzas(wiersz.czasPracyMinuty)}</td>
                    <td className='px-4 py-3'>{formatujCzas(wiersz.czasPauzyMinuty)}</td>
                    <td className='px-4 py-3'>{formatujCzas(wiersz.nadgodzinyMinuty)}</td>
                    <td className='px-4 py-3'>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${wiersz.wyjscie ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                        {wiersz.wyjscie ? 'Zamkniete' : 'Na hali'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}

      {widok === 'PRZERWY' ? (
        <section className='overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900/60'>
          <table className='min-w-[1180px] w-full text-sm'>
            <thead className='bg-slate-950/80 text-slate-300'>
              <tr>
                {['Pracownik', 'Typ pauzy', 'Start', 'Stop', 'Czas trwania', 'Powod', 'IP'].map((label) => (
                  <th key={label} className='px-4 py-3 text-left font-medium'>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ladowanie ? (
                <tr><td colSpan={7} className='px-4 py-10 text-center text-slate-400'>Ladowanie historii przerw...</td></tr>
              ) : pauzy.length === 0 ? (
                <tr><td colSpan={7} className='px-4 py-10 text-center text-slate-400'>Brak przerw dla wybranych filtrow.</td></tr>
              ) : (
                pauzy.map((wiersz) => (
                  <tr key={wiersz.id} className='border-t border-slate-800 text-slate-100 odd:bg-slate-900/20'>
                    <td className='px-4 py-3 font-medium'>{wiersz.pracownik.imie} {wiersz.pracownik.nazwisko}</td>
                    <td className='px-4 py-3'>{wiersz.typPauzy}</td>
                    <td className='px-4 py-3'>{formatujDate(wiersz.czasStart)}</td>
                    <td className='px-4 py-3'>{formatujDate(wiersz.czasStop)}</td>
                    <td className='px-4 py-3'>{formatujCzas(wiersz.czasPauzyMinuty)}</td>
                    <td className='px-4 py-3'>{wiersz.powod ?? '--'}</td>
                    <td className='px-4 py-3'>{wiersz.ip ?? '--'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}

      {widok === 'KARTA_PRACY' ? (
        <section className='space-y-4'>
          {!filtrPracownika ? (
            <div className='rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-16 text-center'>
              <p className='text-slate-400'>Wybierz pracownika z filtra powyzej, aby wyswietlic karte pracy.</p>
            </div>
          ) : (
            <div className='overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900/60'>
              <table className='w-full text-sm'>
                <thead className='bg-slate-950/80 text-slate-300'>
                  <tr>
                    <th className='px-4 py-3 text-left font-medium'>Metryka</th>
                    <th className='px-4 py-3 text-left font-medium'>Wartosc</th>
                  </tr>
                </thead>
                <tbody>
                  {ladowanie ? (
                    <tr><td colSpan={2} className='px-4 py-10 text-center text-slate-400'>Ladowanie karty pracy...</td></tr>
                  ) : raportCzasu.filter((r) => String(r.id) === filtrPracownika).map((r) => (
                    <>
                      <tr key={`${r.id}-w`} className='border-t border-slate-800 text-slate-100'><td className='px-4 py-3'>Wejscia do pracy</td><td className='px-4 py-3'>{r.liczbaWejsc}</td></tr>
                      <tr key={`${r.id}-x`} className='border-t border-slate-800 bg-slate-900/20 text-slate-100'><td className='px-4 py-3'>Wyjscia z pracy</td><td className='px-4 py-3'>{r.liczbaWyjsc}</td></tr>
                      <tr key={`${r.id}-c`} className='border-t border-slate-800 text-slate-100'><td className='px-4 py-3'>Czas pracy</td><td className='px-4 py-3 font-semibold'>{formatujCzas(r.czasPracyMinuty)}</td></tr>
                      <tr key={`${r.id}-p`} className='border-t border-slate-800 bg-slate-900/20 text-slate-100'><td className='px-4 py-3'>Czas przerw</td><td className='px-4 py-3'>{formatujCzas(r.czasPauzyMinuty)}</td></tr>
                      <tr key={`${r.id}-n`} className='border-t border-slate-800 text-slate-100'><td className='px-4 py-3'>Nadgodziny</td><td className='px-4 py-3 font-semibold text-orange-300'>{formatujCzas(r.nadgodzinyMinuty)}</td></tr>
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {widok === 'RAPORT_CZASU' ? (
        <section className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-3'>
            <div className='rounded-3xl border border-slate-700 bg-slate-900/70 p-5'>
              <p className='text-sm uppercase tracking-[0.2em] text-slate-400'>Pracownicy</p>
              <p className='mt-2 text-3xl font-semibold text-slate-100'>{raportCzasu.length}</p>
            </div>
            <div className='rounded-3xl border border-slate-700 bg-slate-900/70 p-5'>
              <p className='text-sm uppercase tracking-[0.2em] text-slate-400'>Czas pracy</p>
              <p className='mt-2 text-3xl font-semibold text-slate-100'>{formatujCzas(raportCzasu.reduce((sum, item) => sum + item.czasPracyMinuty, 0))}</p>
            </div>
            <div className='rounded-3xl border border-slate-700 bg-slate-900/70 p-5'>
              <p className='text-sm uppercase tracking-[0.2em] text-slate-400'>Nadgodziny</p>
              <p className='mt-2 text-3xl font-semibold text-slate-100'>{formatujCzas(raportCzasu.reduce((sum, item) => sum + item.nadgodzinyMinuty, 0))}</p>
            </div>
          </div>

          <div className='overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900/60'>
            <table className='min-w-[1040px] w-full text-sm'>
              <thead className='bg-slate-950/80 text-slate-300'>
                <tr>
                  {['Pracownik', 'Liczba wejsc', 'Liczba wyjsc', 'Czas pracy', 'Czas przerw', 'Nadgodziny'].map((label) => (
                    <th key={label} className='px-4 py-3 text-left font-medium'>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ladowanie ? (
                  <tr><td colSpan={6} className='px-4 py-10 text-center text-slate-400'>Ladowanie raportu czasu...</td></tr>
                ) : raportCzasu.length === 0 ? (
                  <tr><td colSpan={6} className='px-4 py-10 text-center text-slate-400'>Brak danych do raportu w wybranym zakresie.</td></tr>
                ) : (
                  raportCzasu.map((wiersz) => (
                    <tr key={wiersz.id} className='border-t border-slate-800 text-slate-100 odd:bg-slate-900/20'>
                      <td className='px-4 py-3 font-medium'>{wiersz.imie} {wiersz.nazwisko}</td>
                      <td className='px-4 py-3'>{wiersz.liczbaWejsc}</td>
                      <td className='px-4 py-3'>{wiersz.liczbaWyjsc}</td>
                      <td className='px-4 py-3'>{formatujCzas(wiersz.czasPracyMinuty)}</td>
                      <td className='px-4 py-3'>{formatujCzas(wiersz.czasPauzyMinuty)}</td>
                      <td className='px-4 py-3'>{formatujCzas(wiersz.nadgodzinyMinuty)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
