import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  Search,
  Square,
} from 'lucide-react';
import klientApi from '../api/klient';

type TypPaneluTabletowego = 'PRODUKCJA' | 'PAKOWANIE';
type StatusAkcji = 'START' | 'PAUZA' | 'STOP';

type PracownikPanelu = {
  id: number;
  imie: string;
  nazwisko: string;
  nazwa: string;
  stanowisko: string;
  inicjaly: string;
  kolorAvatara: string;
  wymagaPin: boolean;
};

type ZleceniePanelu = {
  id: number;
  numer: string;
  status: 'STOP' | 'W_TOKU' | 'PAUZA' | 'GOTOWE' | 'ANULOWANE';
  iloscPlan: number;
  iloscWykonana: number;
  iloscBrakow: number;
  planowanyStart: string | null;
  planowanyStop: string | null;
  utworzonyW: string;
  maszyna: {
    id: number;
    nazwa: string;
    panelNazwa: string | null;
  };
  klient: {
    id: number;
    nazwa: string;
  } | null;
  zamowienie: {
    id: number;
    idProdio: string;
    zewnetrznyNumer: string | null;
    oczekiwanaData: string | null;
  };
  produkt: {
    id: number;
    nazwa: string;
    grupa: {
      id: number;
      nazwa: string;
    } | null;
    zdjecie: string | null;
  } | null;
  przypisaniPracownicy: Array<{
    id: number;
    nazwa: string;
    stanowisko: string;
    inicjaly: string;
    kolorAvatara: string;
  }>;
  historiaWykonaniaPracownicy: Array<{
    id: number;
    nazwa: string;
    stanowisko: string;
    inicjaly: string;
    kolorAvatara: string;
  }>;
  surowce: Array<{
    id: number;
    nazwa: string;
    jednostka: string;
    iloscNaSztuke: number;
    iloscPlan: number;
  }>;
  czasPracySekundy: number;
};

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

function formatujLiczbe(wartosc: number, miejsca = 0) {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: miejsca,
    maximumFractionDigits: miejsca,
  }).format(wartosc);
}

function formatujDate(wartosc: string | null, zGodzina = false) {
  if (!wartosc) return '-';
  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) return '-';
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(zGodzina ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(data);
}

function formatujCzas(sekundy: number) {
  const bezpieczne = Math.max(0, Math.round(sekundy));
  const godziny = Math.floor(bezpieczne / 3600);
  const minuty = Math.floor((bezpieczne % 3600) / 60);
  const pozostaleSekundy = bezpieczne % 60;
  return [godziny, minuty, pozostaleSekundy].map((item) => String(item).padStart(2, '0')).join(':');
}

function pasekPostepu(wykonane: number, plan: number) {
  if (plan <= 0) return 0;
  return Math.max(0, Math.min(100, (wykonane / plan) * 100));
}

function KafelekInfo({ etykieta, wartosc }: { etykieta: string; wartosc: React.ReactNode }) {
  return (
    <div className='rounded-[24px] border border-slate-700 bg-slate-950/35 px-4 py-4'>
      <p className='text-xs font-semibold uppercase tracking-[0.16em] text-slate-500'>{etykieta}</p>
      <div className='mt-2 text-lg font-semibold text-slate-100'>{wartosc}</div>
    </div>
  );
}

export default function PanelOperacjiTablet({ typ }: { typ: TypPaneluTabletowego }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [zlecenie, ustawZlecenie] = useState<ZleceniePanelu | null>(null);
  const [pracownicy, ustawPracownikow] = useState<PracownikPanelu[]>([]);
  const [wybranyPracownikId, ustawWybranyPracownikId] = useState<number | null>(null);
  const [stanPracownika, ustawStanPracownika] = useState<StanMeldunkowy | null>(null);
  const [szukaj, ustawSzukaj] = useState('');
  const [pin, ustawPin] = useState('');
  const [ladowanie, ustawLadowanie] = useState(true);
  const [odswiezanie, ustawOdswiezanie] = useState(false);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [komunikat, ustawKomunikat] = useState('');

  const sciezkaPowrotu = typ === 'PAKOWANIE' ? '/panel-pakowanie' : '/panel-produkcja';

  async function pobierzDane(wTle = false) {
    if (wTle) {
      ustawOdswiezanie(true);
    } else {
      ustawLadowanie(true);
    }

    ustawBlad('');

    try {
      const [zlecenieRes, pracownicyRes] = await Promise.all([
        klientApi.get<{ sukces: boolean; dane: ZleceniePanelu }>(`/plan-produkcji/panel-tablet/zlecenie/${id}`),
        klientApi.get<{ sukces: boolean; dane: PracownikPanelu[] }>('/plan-produkcji/panel-tablet/pracownicy', {
          params: { typ },
        }),
      ]);

      ustawZlecenie(zlecenieRes.data.dane);
      ustawPracownikow(pracownicyRes.data.dane ?? []);
    } catch (error: any) {
      ustawBlad(error?.response?.data?.wiadomosc ?? 'Nie udalo sie pobrac panelu operacji.');
      ustawZlecenie(null);
    } finally {
      ustawLadowanie(false);
      ustawOdswiezanie(false);
    }
  }

  async function pobierzStanPracownika(pracownikId: number) {
    try {
      const odpowiedz = await klientApi.post<{ sukces: boolean; dane: StanMeldunkowy }>('/pulpit/checkin/logowanie', {
        identyfikator: String(pracownikId),
      });
      ustawStanPracownika(odpowiedz.data.dane);
    } catch {
      ustawStanPracownika(null);
    }
  }

  useEffect(() => {
    void pobierzDane();
  }, [id, typ]);

  const wybranyPracownik = useMemo(
    () => pracownicy.find((pracownik) => pracownik.id === wybranyPracownikId) ?? null,
    [pracownicy, wybranyPracownikId]
  );

  const przefiltrowaniPracownicy = useMemo(() => {
    const fraza = szukaj.trim().toLowerCase();
    if (!fraza) return pracownicy;
    return pracownicy.filter((pracownik) =>
      [pracownik.nazwa, pracownik.stanowisko].join(' ').toLowerCase().includes(fraza)
    );
  }, [pracownicy, szukaj]);

  const czyNaTymZleceniu = Boolean(stanPracownika?.zlecenie?.id && stanPracownika.zlecenie.id === zlecenie?.id);
  const procent = zlecenie ? pasekPostepu(zlecenie.iloscWykonana, zlecenie.iloscPlan) : 0;

  async function wybierzPracownika(pracownikId: number) {
    ustawWybranyPracownikId(pracownikId);
    ustawPin('');
    ustawKomunikat('');
    await pobierzStanPracownika(pracownikId);
  }

  async function wykonajAkcje(akcja: StatusAkcji) {
    if (!wybranyPracownik || !zlecenie) {
      return;
    }

    ustawZapisywanie(true);
    ustawKomunikat('');
    ustawBlad('');

    try {
      await klientApi.post(`/plan-produkcji/panel-tablet/zlecenie/${zlecenie.id}/akcja`, {
        pracownikId: wybranyPracownik.id,
        pin,
        akcja,
      });

      await Promise.all([pobierzDane(true), pobierzStanPracownika(wybranyPracownik.id)]);
      ustawKomunikat(
        akcja === 'START'
          ? 'Pracownik zostal zalogowany do zlecenia.'
          : akcja === 'PAUZA'
            ? 'Uruchomiono pauze dla wybranego pracownika.'
            : 'Pracownik zostal wylogowany ze zlecenia.'
      );

      if (akcja === 'STOP') {
        ustawPin('');
      }
    } catch (error: any) {
      ustawBlad(error?.response?.data?.wiadomosc ?? 'Nie udalo sie wykonac akcji.');
    } finally {
      ustawZapisywanie(false);
    }
  }

  if (ladowanie) {
    return (
      <div className='min-h-screen bg-[radial-gradient(circle_at_top,#334155_0%,#1E2A3A_42%,#0f1724_100%)] px-4 py-5 text-slate-100'>
        <div className='mx-auto max-w-[1600px] space-y-4'>
          <div className='h-28 animate-pulse rounded-[28px] border border-slate-700 bg-slate-900/70' />
          <div className='grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_380px]'>
            <div className='h-[720px] animate-pulse rounded-[28px] border border-slate-700 bg-slate-900/70' />
            <div className='h-[720px] animate-pulse rounded-[28px] border border-slate-700 bg-slate-900/70' />
            <div className='h-[720px] animate-pulse rounded-[28px] border border-slate-700 bg-slate-900/70' />
          </div>
        </div>
      </div>
    );
  }

  if (blad && !zlecenie) {
    return (
      <div className='min-h-screen bg-[radial-gradient(circle_at_top,#334155_0%,#1E2A3A_42%,#0f1724_100%)] px-4 py-5 text-slate-100'>
        <div className='mx-auto max-w-[1600px] rounded-[28px] border border-red-500/30 bg-red-500/10 px-6 py-8 text-red-100'>
          <p className='text-xl font-semibold'>Nie udalo sie otworzyc panelu operacji</p>
          <p className='mt-2 text-sm text-red-100/80'>{blad}</p>
          <button
            type='button'
            onClick={() => navigate(sciezkaPowrotu)}
            className='mt-5 inline-flex items-center gap-2 rounded-2xl border border-red-400/30 px-4 py-2 text-sm font-semibold'
          >
            <ArrowLeft size={16} />
            Wroc
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-[radial-gradient(circle_at_top,#334155_0%,#1E2A3A_42%,#0f1724_100%)] text-slate-100'>
      <div className='mx-auto max-w-[1600px] px-4 py-5'>
        <section className='mb-4 rounded-[28px] border border-slate-700 bg-gradient-to-br from-[#1E2A3A] via-[#182230] to-[#0f1724] px-5 py-5 shadow-2xl shadow-black/20'>
          <div className='flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between'>
            <div>
              <button
                type='button'
                onClick={() => navigate(sciezkaPowrotu)}
                className='inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-orange-400/30 hover:text-orange-200'
              >
                <ArrowLeft size={16} />
                Wroc do panelu
              </button>
              <div className='mt-4 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200'>
                {typ === 'PAKOWANIE' ? 'Panel Pakowanie' : 'Panel Produkcja'}
              </div>
              <h1 className='mt-3 text-3xl font-semibold text-slate-100'>
                {zlecenie?.produkt?.nazwa ?? 'Operacja bez przypisanego produktu'} - start/stop pracy
              </h1>
              <p className='mt-2 text-sm text-slate-400'>
                Numer zlecenia: <span className='font-semibold text-orange-200'>{zlecenie?.numer}</span>
              </p>
            </div>

            <button
              type='button'
              onClick={() => void pobierzDane(true)}
              className='inline-flex h-12 items-center gap-2 self-start rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 text-sm font-semibold text-orange-200 transition hover:bg-orange-400/15'
            >
              <RefreshCcw size={16} className={odswiezanie ? 'animate-spin' : ''} />
              Odswiez
            </button>
          </div>
        </section>

        {blad && zlecenie ? (
          <div className='mb-4 rounded-[22px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div>
        ) : null}
        {komunikat ? (
          <div className='mb-4 rounded-[22px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200'>{komunikat}</div>
        ) : null}

        <section className='grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_380px]'>
          <aside className='overflow-hidden rounded-[28px] border border-slate-700 bg-slate-900/70 shadow-xl shadow-black/20'>
            <div className='border-b border-slate-700 px-5 py-5'>
              <h2 className='text-2xl font-semibold text-slate-100'>Wybierz siebie z listy pracownikow</h2>
              <div className='relative mt-4'>
                <Search className='pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500' size={18} />
                <input
                  value={szukaj}
                  onChange={(event) => ustawSzukaj(event.target.value)}
                  placeholder='Szukaj pracownika'
                  className='h-14 w-full rounded-2xl border border-slate-700 bg-slate-950/60 pl-11 pr-4 text-sm text-slate-100 outline-none transition focus:border-orange-400'
                />
              </div>
            </div>

            <div className='max-h-[calc(100vh-260px)] overflow-y-auto'>
              {przefiltrowaniPracownicy.map((pracownik) => {
                const aktywny = pracownik.id === wybranyPracownikId;
                return (
                  <button
                    key={pracownik.id}
                    type='button'
                    onClick={() => void wybierzPracownika(pracownik.id)}
                    className={`flex w-full items-center gap-4 border-b border-slate-800/80 px-5 py-4 text-left transition ${
                      aktywny ? 'bg-orange-400/10' : 'hover:bg-slate-950/40'
                    }`}
                  >
                    <div
                      className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white shadow-lg shadow-black/20'
                      style={{ backgroundColor: pracownik.kolorAvatara }}
                    >
                      {pracownik.inicjaly}
                    </div>
                    <div className='min-w-0'>
                      <p className='truncate text-lg font-semibold text-slate-100'>{pracownik.nazwa}</p>
                      <p className='truncate text-sm text-slate-400'>{pracownik.stanowisko}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className='space-y-4'>
            <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
              {wybranyPracownik ? (
                <div className='space-y-5'>
                  <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
                    <div>
                      <p className='text-sm uppercase tracking-[0.16em] text-slate-500'>Wybrany pracownik</p>
                      <h2 className='mt-1 text-2xl font-semibold text-slate-100'>{wybranyPracownik.nazwa}</h2>
                      <p className='mt-1 text-sm text-slate-400'>
                        {czyNaTymZleceniu
                          ? `Status na tym zleceniu: ${stanPracownika?.status ?? 'STOP'}`
                          : stanPracownika?.zlecenie
                            ? `Obecnie pracuje na zleceniu ${stanPracownika.zlecenie.numer}`
                            : 'Pracownik nie jest teraz zalogowany do zadnego zlecenia.'}
                      </p>
                    </div>

                    <div
                      className='flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white shadow-lg shadow-black/20'
                      style={{ backgroundColor: wybranyPracownik.kolorAvatara }}
                    >
                      {wybranyPracownik.inicjaly}
                    </div>
                  </div>

                  <div className='grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]'>
                    <div>
                      <label className='mb-2 block text-sm font-semibold uppercase tracking-[0.14em] text-slate-400'>PIN</label>
                      <input
                        value={pin}
                        onChange={(event) => ustawPin(event.target.value)}
                        inputMode='numeric'
                        placeholder={wybranyPracownik.wymagaPin ? 'Wpisz PIN' : 'Opcjonalnie'}
                        className='h-16 w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 text-2xl text-slate-100 outline-none transition focus:border-orange-400'
                      />
                    </div>

                    <div className='grid gap-3 md:grid-cols-2'>
                      {(!czyNaTymZleceniu || stanPracownika?.status === 'STOP' || !stanPracownika) ? (
                        <button
                          type='button'
                          onClick={() => void wykonajAkcje('START')}
                          disabled={zapisywanie}
                          className='flex min-h-16 items-center justify-center gap-3 rounded-[24px] border border-emerald-500/20 bg-emerald-500/12 px-6 text-2xl font-semibold text-emerald-300 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                          <PlayCircle size={28} />
                          START
                        </button>
                      ) : null}

                      {czyNaTymZleceniu && stanPracownika?.status === 'START' ? (
                        <>
                          <button
                            type='button'
                            onClick={() => void wykonajAkcje('PAUZA')}
                            disabled={zapisywanie}
                            className='flex min-h-16 items-center justify-center gap-3 rounded-[24px] border border-amber-500/20 bg-amber-500/12 px-6 text-2xl font-semibold text-amber-300 transition hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-60'
                          >
                            <PauseCircle size={28} />
                            PAUZA
                          </button>
                          <button
                            type='button'
                            onClick={() => void wykonajAkcje('STOP')}
                            disabled={zapisywanie}
                            className='flex min-h-16 items-center justify-center gap-3 rounded-[24px] border border-rose-500/20 bg-rose-500/12 px-6 text-2xl font-semibold text-rose-300 transition hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-60'
                          >
                            <Square size={24} />
                            STOP
                          </button>
                        </>
                      ) : null}

                      {czyNaTymZleceniu && stanPracownika?.status === 'PAUZA' ? (
                        <>
                          <button
                            type='button'
                            onClick={() => void wykonajAkcje('START')}
                            disabled={zapisywanie}
                            className='flex min-h-16 items-center justify-center gap-3 rounded-[24px] border border-emerald-500/20 bg-emerald-500/12 px-6 text-2xl font-semibold text-emerald-300 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-60'
                          >
                            <PlayCircle size={28} />
                            WZNOW
                          </button>
                          <button
                            type='button'
                            onClick={() => void wykonajAkcje('STOP')}
                            disabled={zapisywanie}
                            className='flex min-h-16 items-center justify-center gap-3 rounded-[24px] border border-rose-500/20 bg-rose-500/12 px-6 text-2xl font-semibold text-rose-300 transition hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-60'
                          >
                            <Square size={24} />
                            STOP
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className='flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-slate-700 bg-slate-950/20 px-6 text-center text-lg text-slate-400'>
                  Wybierz siebie z listy po lewej stronie, aby zalogowac sie do zlecenia.
                </div>
              )}
            </section>

            <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
              <div className='grid gap-4 xl:grid-cols-2'>
                <KafelekInfo etykieta='Numer zlecenia' wartosc={zlecenie?.numer ?? '-'} />
                <KafelekInfo etykieta='Maszyna / Operacja' wartosc={zlecenie?.maszyna.nazwa ?? '-'} />
                <KafelekInfo etykieta='Na kiedy?' wartosc={formatujDate(zlecenie?.zamowienie.oczekiwanaData ?? null)} />
                <KafelekInfo etykieta='Klient' wartosc={zlecenie?.klient?.nazwa ?? 'Produkcja na magazyn'} />
                <KafelekInfo etykieta='Data utworzenia' wartosc={formatujDate(zlecenie?.utworzonyW ?? null)} />
                <KafelekInfo etykieta='Zamowienie' wartosc={zlecenie?.zamowienie.idProdio ?? '-'} />
              </div>
            </section>

            <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
              <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]'>
                <div>
                  <p className='mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500'>Dodatkowe pola do produktu</p>
                  <div className='min-h-[160px] rounded-[24px] border border-slate-700 bg-slate-950/20 p-4 text-sm text-slate-500'>
                    {zlecenie?.produkt?.grupa?.nazwa ?? 'Brak dodatkowych pol produktu.'}
                  </div>
                </div>
                <div>
                  <p className='mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500'>Dodatkowe pola do zamowienia</p>
                  <div className='min-h-[160px] rounded-[24px] border border-slate-700 bg-slate-950/20 p-4 text-sm text-slate-500'>
                    {zlecenie?.zamowienie.zewnetrznyNumer ?? 'Brak dodatkowych pol zamowienia.'}
                  </div>
                </div>
                <div>
                  <p className='mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500'>Surowce</p>
                  <div className='max-h-[260px] space-y-3 overflow-y-auto rounded-[24px] border border-slate-700 bg-slate-950/20 p-4'>
                    {zlecenie?.surowce.length ? (
                      zlecenie.surowce.map((surowiec) => (
                        <div key={surowiec.id} className='rounded-2xl border border-slate-700 bg-slate-950/50 px-3 py-3'>
                          <p className='text-base font-semibold text-slate-200'>{surowiec.nazwa}</p>
                          <div className='mt-2 inline-flex rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1 text-lg font-semibold text-orange-200'>
                            {formatujLiczbe(surowiec.iloscNaSztuke, 4)} {surowiec.jednostka}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className='text-sm text-slate-500'>Brak pozycji surowcowych dla tej operacji.</div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className='space-y-4'>
            <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
              <div className='mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100'>
                <Camera size={20} className='text-orange-300' />
                Produkt zdjecia ({zlecenie?.produkt?.zdjecie ? '1' : '0'})
              </div>
              {zlecenie?.produkt?.zdjecie ? (
                <div className='rounded-[24px] border border-slate-700 bg-white/95 p-4'>
                  <img
                    src={zlecenie.produkt.zdjecie}
                    alt={zlecenie.produkt.nazwa}
                    className='h-48 w-full object-contain'
                  />
                </div>
              ) : (
                <div className='flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-slate-700 bg-slate-950/20 text-slate-500'>
                  Brak zdjecia produktu
                </div>
              )}
            </section>

            <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
              <div className='flex items-start justify-between gap-4'>
                <div className='text-xl font-semibold text-slate-300'>
                  <div>Gotowe/Zlecone</div>
                  <div>Pozostalo</div>
                </div>
                <div className='text-right text-2xl font-bold text-slate-100'>
                  <div>
                    {formatujLiczbe(zlecenie?.iloscWykonana ?? 0)} / {formatujLiczbe(zlecenie?.iloscPlan ?? 0)}
                  </div>
                  <div>{formatujLiczbe((zlecenie?.iloscPlan ?? 0) - (zlecenie?.iloscWykonana ?? 0))}</div>
                </div>
              </div>
              <div className='mt-4 h-2 overflow-hidden rounded-full bg-slate-800'>
                <div className='h-full rounded-full bg-orange-400 transition-all' style={{ width: `${procent}%` }} />
              </div>
            </section>

            <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
              <div className='flex items-center justify-between gap-4'>
                <span className='text-2xl font-semibold text-slate-300'>Czas</span>
                <span className='text-3xl font-bold text-slate-100'>{formatujCzas(zlecenie?.czasPracySekundy ?? 0)}</span>
              </div>
            </section>

            <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
              <div className='mb-4 flex items-center justify-between gap-4'>
                <span className='text-xl font-semibold uppercase tracking-[0.08em] text-slate-300'>Historia wykonania</span>
                <span className='rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-sm font-semibold text-orange-200'>
                  {zlecenie?.historiaWykonaniaPracownicy.length ?? 0}
                </span>
              </div>

              {zlecenie?.historiaWykonaniaPracownicy.length ? (
                <div className='space-y-3'>
                  {zlecenie.historiaWykonaniaPracownicy.map((pracownik) => (
                    <div key={pracownik.id} className='flex items-center gap-3 rounded-[22px] border border-slate-700 bg-slate-950/35 px-4 py-3'>
                      <div
                        className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-lg shadow-black/20'
                        style={{ backgroundColor: pracownik.kolorAvatara }}
                      >
                        {pracownik.inicjaly}
                      </div>
                      <div className='min-w-0'>
                        <div className='truncate text-base font-semibold text-slate-100'>{pracownik.nazwa}</div>
                        <div className='truncate text-sm text-slate-400'>{pracownik.stanowisko || 'Przypisany do operacji'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='flex min-h-[160px] items-center justify-center rounded-[24px] border border-dashed border-slate-700 bg-slate-950/20 px-4 text-center text-sm text-slate-500'>
                  Brak pracownikow zalogowanych do tego zlecenia.
                </div>
              )}
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}
