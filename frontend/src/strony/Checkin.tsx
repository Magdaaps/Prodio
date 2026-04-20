import { useState } from 'react';
import { Clock3, PauseCircle, PlayCircle, ScanLine, Square } from 'lucide-react';
import klientApi from '../api/klient';

type StanMeldunkowy = {
  pracownik: {
    id: number;
    imie: string;
    nazwisko: string;
    kolorAvatara: string;
    stanowisko: string | null;
    aktywny: boolean;
  };
  status: 'START' | 'PAUZA' | 'STOP';
  czasOdLogowaniaMinuty: number;
  czasOdLogowaniaTekst: string;
  aktywnaPauza: {
    id: number;
    czasStart: string;
    typPauzy: string;
    powod: string | null;
  } | null;
  zlecenie: {
    id: number;
    numer: string;
    status: string;
    maszyna: { id: number; nazwa: string };
    zamowienie: {
      id: number;
      idProdio: string;
      klient: { id: number; nazwa: string } | null;
    };
    produkt: { id: number; nazwa: string } | null;
  } | null;
};

function Inicjaly({ imie, nazwisko, kolor }: { imie: string; nazwisko: string; kolor: string }) {
  const inicjaly = `${imie[0] ?? ''}${nazwisko[0] ?? ''}`.toUpperCase();
  return (
    <div className='flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-semibold text-white shadow-lg shadow-black/20' style={{ backgroundColor: kolor }}>
      {inicjaly}
    </div>
  );
}

export default function Checkin() {
  const [identyfikator, ustawIdentyfikator] = useState('');
  const [stan, ustawStan] = useState<StanMeldunkowy | null>(null);
  const [blad, ustawBlad] = useState('');
  const [ladowanie, ustawLadowanie] = useState(false);

  async function zaloguj(event?: React.FormEvent) {
    event?.preventDefault();
    ustawLadowanie(true);
    ustawBlad('');

    try {
      const odpowiedz = await klientApi.post<{ sukces: boolean; dane: StanMeldunkowy }>('/pulpit/checkin/logowanie', {
        identyfikator,
      });
      ustawStan(odpowiedz.data.dane);
    } catch (error: any) {
      ustawStan(null);
      ustawBlad(error?.response?.data?.wiadomosc ?? 'Nie udalo sie otworzyc panelu meldunkowego.');
    } finally {
      ustawLadowanie(false);
    }
  }

  async function wykonajAkcje(akcja: 'START' | 'PAUZA' | 'STOP') {
    if (!stan) {
      return;
    }

    ustawLadowanie(true);
    ustawBlad('');

    try {
      const odpowiedz = await klientApi.post<{ sukces: boolean; dane: StanMeldunkowy }>('/pulpit/checkin/akcja', {
        pracownikId: stan.pracownik.id,
        akcja,
      });
      ustawStan(odpowiedz.data.dane);
    } catch (error: any) {
      ustawBlad(error?.response?.data?.wiadomosc ?? 'Nie udalo sie wykonac akcji.');
    } finally {
      ustawLadowanie(false);
    }
  }

  return (
    <div className='min-h-screen bg-[radial-gradient(circle_at_top,#334155_0%,#0f172a_45%,#020617_100%)] text-slate-100'>
      <div className='mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10'>
        <section className='rounded-[32px] border border-orange-500/20 bg-slate-950/60 p-8 shadow-2xl shadow-black/30'>
          <div className='flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
            <div>
              <div className='inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-orange-200'>
                Panel Meldunkowy
              </div>
              <h1 className='mt-4 text-4xl font-semibold tracking-tight'>START / PAUZA / STOP</h1>
              <p className='mt-3 max-w-2xl text-base text-slate-400'>
                Tryb pelnoekranowy do szybkiego meldowania pracy na tablecie. Uzyj PIN-u 4-cyfrowego albo numeru pracownika.
              </p>
            </div>

            <form onSubmit={zaloguj} className='grid w-full max-w-xl gap-3 rounded-[28px] border border-slate-800 bg-slate-900/70 p-5'>
              <label className='text-sm font-medium uppercase tracking-[0.2em] text-slate-400'>PIN lub numer pracownika</label>
              <div className='flex flex-col gap-3 sm:flex-row'>
                <div className='relative flex-1'>
                  <ScanLine className='pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500' size={18} />
                  <input
                    value={identyfikator}
                    onChange={(event) => ustawIdentyfikator(event.target.value)}
                    placeholder='np. 1234 lub 18'
                    className='h-16 w-full rounded-2xl border border-slate-700 bg-slate-950/70 pl-12 pr-4 text-xl text-slate-100 outline-none transition focus:border-orange-400'
                    inputMode='numeric'
                  />
                </div>
                <button
                  type='submit'
                  disabled={ladowanie || identyfikator.trim().length === 0}
                  className='inline-flex h-16 items-center justify-center rounded-2xl bg-orange-500 px-8 text-lg font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  Otworz
                </button>
              </div>
            </form>
          </div>

          {blad ? <div className='mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}
        </section>

        <section className='grid gap-6 lg:grid-cols-[1.2fr_0.8fr]'>
          <article className='rounded-[32px] border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/20'>
            {stan ? (
              <div className='space-y-6'>
                <div className='flex flex-col gap-5 sm:flex-row sm:items-center'>
                  <Inicjaly imie={stan.pracownik.imie} nazwisko={stan.pracownik.nazwisko} kolor={stan.pracownik.kolorAvatara} />
                  <div className='space-y-2'>
                    <div className='inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-200'>
                      {stan.status}
                    </div>
                    <h2 className='text-3xl font-semibold'>
                      {stan.pracownik.imie} {stan.pracownik.nazwisko}
                    </h2>
                    <p className='text-sm text-slate-400'>
                      {stan.pracownik.stanowisko ?? 'Stanowisko nieuzupelnione'} • Zalogowany od {stan.czasOdLogowaniaTekst}
                    </p>
                  </div>
                </div>

                <div className='grid gap-4 md:grid-cols-3'>
                  <button
                    type='button'
                    onClick={() => void wykonajAkcje('START')}
                    disabled={ladowanie}
                    className='flex min-h-32 flex-col items-center justify-center rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-60'
                  >
                    <PlayCircle size={42} />
                    <span className='mt-3 text-2xl font-semibold'>START</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => void wykonajAkcje('PAUZA')}
                    disabled={ladowanie}
                    className='flex min-h-32 flex-col items-center justify-center rounded-[28px] border border-amber-500/20 bg-amber-500/10 text-amber-300 transition hover:bg-amber-500/15 disabled:opacity-60'
                  >
                    <PauseCircle size={42} />
                    <span className='mt-3 text-2xl font-semibold'>PAUZA</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => void wykonajAkcje('STOP')}
                    disabled={ladowanie}
                    className='flex min-h-32 flex-col items-center justify-center rounded-[28px] border border-rose-500/20 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-60'
                  >
                    <Square size={42} />
                    <span className='mt-3 text-2xl font-semibold'>STOP</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className='flex min-h-80 items-center justify-center rounded-[28px] border border-dashed border-slate-700 bg-slate-950/30 text-center text-slate-400'>
                Wprowadz PIN lub numer pracownika, aby otworzyc panel meldunkowy.
              </div>
            )}
          </article>

          <aside className='space-y-6'>
            <article className='rounded-[32px] border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/20'>
              <div className='flex items-center gap-3'>
                <Clock3 size={18} className='text-orange-300' />
                <h2 className='text-lg font-semibold'>Aktualne zlecenie</h2>
              </div>

              {stan?.zlecenie ? (
                <div className='mt-5 space-y-4'>
                  <div className='rounded-3xl border border-slate-800 bg-slate-950/40 p-4'>
                    <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>Nr zlecenia</p>
                    <p className='mt-2 text-2xl font-semibold text-orange-200'>{stan.zlecenie.numer}</p>
                    <p className='mt-1 text-sm text-slate-400'>{stan.zlecenie.produkt?.nazwa ?? 'Produkt nieprzypisany'}</p>
                  </div>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <div className='rounded-3xl border border-slate-800 bg-slate-950/40 p-4'>
                      <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>Maszyna</p>
                      <p className='mt-2 text-lg font-semibold'>{stan.zlecenie.maszyna.nazwa}</p>
                    </div>
                    <div className='rounded-3xl border border-slate-800 bg-slate-950/40 p-4'>
                      <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>Zamowienie</p>
                      <p className='mt-2 text-lg font-semibold'>{stan.zlecenie.zamowienie.idProdio}</p>
                    </div>
                  </div>
                  <div className='rounded-3xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300'>
                    Klient: <span className='font-medium text-slate-100'>{stan.zlecenie.zamowienie.klient?.nazwa ?? 'Brak klienta'}</span>
                  </div>
                </div>
              ) : (
                <div className='mt-5 rounded-3xl border border-dashed border-slate-700 bg-slate-950/30 p-5 text-sm text-slate-400'>
                  Dla tego pracownika nie ma teraz przypisanego aktywnego zlecenia.
                </div>
              )}
            </article>

            <article className='rounded-[32px] border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/20'>
              <h2 className='text-lg font-semibold'>Stan sesji</h2>
              <div className='mt-4 space-y-3 text-sm text-slate-300'>
                <div className='rounded-3xl border border-slate-800 bg-slate-950/40 p-4'>
                  Status: <span className='font-semibold text-slate-100'>{stan?.status ?? 'BRAK'}</span>
                </div>
                <div className='rounded-3xl border border-slate-800 bg-slate-950/40 p-4'>
                  Pauza: <span className='font-semibold text-slate-100'>{stan?.aktywnaPauza?.powod ?? stan?.aktywnaPauza?.typPauzy ?? 'brak'}</span>
                </div>
                <button
                  type='button'
                  onClick={() => {
                    ustawStan(null);
                    ustawIdentyfikator('');
                    ustawBlad('');
                  }}
                  className='w-full rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-left text-slate-200 transition hover:border-slate-600 hover:bg-slate-950/70'
                >
                  Zmien pracownika
                </button>
              </div>
            </article>
          </aside>
        </section>
      </div>
    </div>
  );
}
