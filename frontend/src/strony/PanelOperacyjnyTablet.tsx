import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ArrowLeft,
  ChevronLeft,
  MoreHorizontal,
  PackageCheck,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Square,
  Users,
} from 'lucide-react';

type TypPaneluTabletowego = 'PRODUKCJA' | 'PAKOWANIE';
type StatusZlecenia = 'STOP' | 'W_TOKU' | 'PAUZA' | 'GOTOWE' | 'ANULOWANE';

type Pracownik = {
  id: number;
  nazwa: string;
  inicjaly: string;
  kolorAvatara: string;
};

type ZleceniePanelu = {
  id: number;
  numer: string;
  status: StatusZlecenia;
  iloscPlan: number;
  iloscWykonana: number;
  iloscBrakow: number;
  planowanyStart: string | null;
  planowanyStop: string | null;
  maszynaKoncowa: boolean;
  klient: { id: number; nazwa: string } | null;
  zamowienie: { id: number; idProdio: string; zewnetrznyNumer: string | null };
  produkt: {
    id: number;
    nazwa: string;
    grupa: { id: number; nazwa: string } | null;
    zdjecie: string | null;
  } | null;
  poprzednik: {
    id: number;
    numer: string;
    status: StatusZlecenia;
    iloscPlan: number;
    iloscWykonana: number;
  } | null;
  przypisaniPracownicy: Pracownik[];
};

type GrupaMaszyny = {
  maszyna: {
    id: number;
    nazwa: string;
    panelId: number | null;
    panelNazwa: string | null;
    kolejnosc: number;
  };
  sumaPlan: number;
  sumaWykonana: number;
  sumaBrakow: number;
  zlecenia: ZleceniePanelu[];
};

type OdpowiedzPanelu = {
  sukces: boolean;
  dane: {
    typ: TypPaneluTabletowego;
    grupy: GrupaMaszyny[];
    podsumowanie: {
      liczbaMaszyn: number;
      liczbaZlecen: number;
      sumaPlan: number;
      sumaWykonana: number;
    };
  };
  wiadomosc?: string;
};

const STATUS_META: Record<
  StatusZlecenia,
  {
    etykieta: string;
    klasy: string;
    ikona: JSX.Element;
  }
> = {
  STOP: {
    etykieta: 'STOP',
    klasy: 'border-slate-600 bg-slate-950 text-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.24)]',
    ikona: <Square size={12} className='fill-current' />,
  },
  W_TOKU: {
    etykieta: 'W TOKU',
    klasy: 'border-orange-400/30 bg-orange-500/15 text-orange-200',
    ikona: <Play size={12} className='fill-current' />,
  },
  PAUZA: {
    etykieta: 'PAUZA',
    klasy: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
    ikona: <Pause size={12} className='fill-current' />,
  },
  GOTOWE: {
    etykieta: 'GOTOWE',
    klasy: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
    ikona: <PackageCheck size={12} />,
  },
  ANULOWANE: {
    etykieta: 'ANULOWANE',
    klasy: 'border-red-500/40 bg-red-500/15 text-red-200',
    ikona: <Square size={12} />,
  },
};

function formatujLiczbe(wartosc: number) {
  return new Intl.NumberFormat('pl-PL').format(wartosc);
}

function formatujDate(wartosc: string | null) {
  if (!wartosc) return '-';
  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) return '-';
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

function formatujDateBezGodziny(wartosc: string | null) {
  if (!wartosc) return '-';
  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) return '-';
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

function formatujGodzine(wartosc: string | null) {
  if (!wartosc) return '--:--';
  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) return '--:--';
  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

function Progres({ wykonane, plan }: { wykonane: number; plan: number }) {
  const procent = plan > 0 ? Math.max(0, Math.min(100, (wykonane / plan) * 100)) : 0;

  return (
    <div>
      <div className='mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-400'>
        <span>Postep</span>
        <span>{Math.round(procent)}%</span>
      </div>
      <div className='h-2 overflow-hidden rounded-full bg-slate-800'>
        <div className='h-full rounded-full bg-orange-400 transition-all' style={{ width: `${procent}%` }} />
      </div>
    </div>
  );
}

function AvatarStack({ pracownicy }: { pracownicy: Pracownik[] }) {
  if (pracownicy.length === 0) {
    return (
      <div className='inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-400'>
        <Users size={14} />
        Brak przypisanych
      </div>
    );
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {pracownicy.slice(0, 4).map((pracownik) => (
        <div
          key={pracownik.id}
          title={pracownik.nazwa}
          className='flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-900 text-xs font-semibold text-white shadow-sm'
          style={{ backgroundColor: pracownik.kolorAvatara }}
        >
          {pracownik.inicjaly}
        </div>
      ))}
      {pracownicy.length > 4 ? (
        <div className='flex h-9 min-w-9 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-700 px-2 text-xs font-semibold text-slate-100 shadow-sm'>
          +{pracownicy.length - 4}
        </div>
      ) : null}
    </div>
  );
}

function KartaZlecenia({
  zlecenie,
  typ,
  onClick,
}: {
  zlecenie: ZleceniePanelu;
  typ: TypPaneluTabletowego;
  onClick: () => void;
}) {
  const status = STATUS_META[zlecenie.status];
  const poprzednik = zlecenie.poprzednik;
  const oczekiwanieNaPoprzednik = typ === 'PAKOWANIE' && poprzednik && poprzednik.status !== 'GOTOWE';
  const termin = zlecenie.planowanyStart || zlecenie.planowanyStop;

  return (
    <button
      type='button'
      onClick={onClick}
      className='block w-full rounded-[22px] border border-slate-700 bg-slate-900/70 p-4 text-left shadow-xl shadow-black/20 transition hover:border-orange-400/30 hover:bg-slate-900/90'
    >
      <div className='flex items-start justify-between gap-4'>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${status.klasy}`}>
          {status.ikona}
          <span>{status.etykieta}</span>
        </div>
        <div className='text-right'>
          <div className='text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500'>{zlecenie.numer}</div>
          <div className='mt-1 text-xl font-bold text-slate-100'>
            {formatujLiczbe(zlecenie.iloscWykonana)} z {formatujLiczbe(zlecenie.iloscPlan)}
          </div>
        </div>
      </div>

      <div className='mt-4'>
        <h3 className='text-[1.15rem] font-bold leading-tight text-slate-100'>
          {zlecenie.produkt?.nazwa ?? 'Brak przypisanego produktu'}
        </h3>
        <p className='mt-1 text-xs text-slate-500'>
          {zlecenie.produkt?.grupa?.nazwa ?? (typ === 'PAKOWANIE' ? 'Operacja pakowania' : 'Operacja produkcyjna')}
        </p>
      </div>

      {oczekiwanieNaPoprzednik && poprzednik ? (
        <div className='mt-4 rounded-xl border border-orange-400/20 bg-orange-500/15 px-4 py-2.5 text-sm font-semibold text-orange-100'>
          Czeka na: ({formatujLiczbe(poprzednik.iloscWykonana)}/{formatujLiczbe(poprzednik.iloscPlan)}) {poprzednik.numer}
        </div>
      ) : null}

      <div className='mt-4 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2'>
        <div className='flex items-center gap-2'>
          <CalendarDays size={15} className='text-orange-300' />
          <span className='text-slate-300'>{formatujDateBezGodziny(termin)}</span>
        </div>
        <div className='flex items-center gap-2'>
          <CalendarDays size={15} className='text-orange-300' />
          <span className='text-slate-300'>{formatujGodzine(termin)}</span>
        </div>
        <div className='truncate font-semibold text-slate-200'>{zlecenie.klient?.nazwa ?? 'Produkcja na magazyn'}</div>
        <div className='truncate text-slate-500'>{zlecenie.zamowienie.idProdio}</div>
      </div>

      <div className='mt-4 flex items-end justify-between gap-4'>
        <AvatarStack pracownicy={zlecenie.przypisaniPracownicy} />
        <div className='flex items-end gap-3'>
          <div className='min-w-[110px]'>
            <Progres wykonane={zlecenie.iloscWykonana} plan={zlecenie.iloscPlan} />
          </div>
          {zlecenie.produkt?.zdjecie ? (
            <img
              src={zlecenie.produkt.zdjecie}
              alt={zlecenie.produkt.nazwa}
              className='h-24 w-24 object-contain'
            />
          ) : (
            <div className='flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/40 text-slate-500'>
              <PackageCheck size={28} />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function PanelOperacyjnyTablet({ typ }: { typ: TypPaneluTabletowego }) {
  const navigate = useNavigate();
  const [grupy, ustawGrupy] = useState<GrupaMaszyny[]>([]);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [odswiezanie, ustawOdswiezanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [ostatniaAktualizacja, ustawOstatniaAktualizacja] = useState<string | null>(null);

  const meta = useMemo(
    () =>
      typ === 'PAKOWANIE'
        ? {
            etykieta: 'Panel Pakowanie',
            opis: 'Pokazuje tylko zaplanowane zlecenia ze statusem W TOKU lub STOP.',
          }
        : {
            etykieta: 'Panel Produkcja',
            opis: 'Pokazuje tylko zaplanowane zlecenia ze statusem W TOKU lub STOP.',
          },
    [typ]
  );

  async function pobierzDane(wTle = false) {
    if (wTle) {
      ustawOdswiezanie(true);
    } else {
      ustawLadowanie(true);
    }

    ustawBlad('');

    try {
      const odpowiedz = await axios.get<OdpowiedzPanelu>('/api/plan-produkcji/panel-tablet', {
        params: { typ },
      });
      ustawGrupy(odpowiedz.data.dane.grupy ?? []);
      ustawOstatniaAktualizacja(new Date().toISOString());
    } catch (error: any) {
      ustawBlad(error?.response?.data?.wiadomosc ?? 'Nie udalo sie pobrac danych panelu.');
      if (!wTle) {
        ustawGrupy([]);
      }
    } finally {
      ustawLadowanie(false);
      ustawOdswiezanie(false);
    }
  }

  useEffect(() => {
    void pobierzDane();
  }, [typ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void pobierzDane(true);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [typ]);

  return (
    <div className='min-h-screen bg-[radial-gradient(circle_at_top,#334155_0%,#1E2A3A_42%,#0f1724_100%)] text-slate-100'>
      <div className='mx-auto min-h-screen max-w-[1600px] px-3 py-4 md:px-4'>
        <section className='mb-4 rounded-[28px] border border-slate-700 bg-gradient-to-br from-[#1E2A3A] via-[#182230] to-[#0f1724] px-5 py-5 shadow-2xl shadow-black/20'>
          <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
            <div>
              <div className='inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200'>
                {meta.etykieta}
              </div>
              <h1 className='mt-3 text-3xl font-semibold text-slate-100'>{typ === 'PAKOWANIE' ? 'Pakowanie' : 'Produkcja'}</h1>
              <p className='mt-2 text-sm text-slate-400'>{meta.opis}</p>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <a
                href='/'
                className='inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/50 px-4 text-sm font-semibold text-slate-200 transition hover:border-orange-400/30 hover:text-orange-200'
              >
                <ArrowLeft size={16} />
                Wroc
              </a>
              <div className='rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-300'>
                Ostatnia aktualizacja: <span className='font-semibold text-orange-200'>{formatujDate(ostatniaAktualizacja)}</span>
              </div>
              <button
                type='button'
                onClick={() => void pobierzDane(true)}
                className='inline-flex h-12 items-center gap-2 rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 text-sm font-semibold text-orange-200 transition hover:bg-orange-400/15'
              >
                <RefreshCcw size={16} className={odswiezanie ? 'animate-spin' : ''} />
                Odswiez
              </button>
            </div>
          </div>

          {blad ? (
            <div className='mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
              {blad}
            </div>
          ) : null}
        </section>

        {ladowanie ? (
          <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 px-6 py-20 text-center text-lg text-slate-400 shadow-xl shadow-black/20'>
            Ladowanie panelu...
          </section>
        ) : grupy.length === 0 ? (
          <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 px-6 py-20 text-center text-lg text-slate-400 shadow-xl shadow-black/20'>
            Brak zaplanowanych zlecen dla tego panelu.
          </section>
        ) : (
          <section className='grid gap-5 xl:grid-cols-2'>
            {grupy.map((grupa) => {
              const maZlecenieWToku = grupa.zlecenia.some((item) => item.status === 'W_TOKU');

              return (
                <article key={grupa.maszyna.id} className='overflow-hidden rounded-[28px] border border-slate-700 bg-slate-900/70 shadow-xl shadow-black/20'>
                  <header className={`border-b border-slate-700 px-5 py-4 ${maZlecenieWToku ? 'bg-orange-500/15' : 'bg-slate-950/40'}`}>
                    <div className='flex items-start justify-between gap-4'>
                      <div>
                        <h2 className='text-[1.6rem] font-bold text-slate-100'>{grupa.maszyna.nazwa}</h2>
                        <p className='mt-1 text-xs text-slate-400'>
                          Suma {formatujLiczbe(grupa.sumaWykonana)} / {formatujLiczbe(grupa.sumaPlan)} sztuk
                        </p>
                      </div>
                      <div className='flex items-center gap-3'>
                        <button type='button' className='rounded-xl border border-slate-700 bg-slate-950/40 p-2 text-orange-200 transition hover:bg-orange-400/10'>
                          <Plus size={18} />
                        </button>
                        <button type='button' className='rounded-xl border border-slate-700 bg-slate-950/40 p-2 text-slate-300 transition hover:text-orange-200'>
                          <ChevronLeft size={18} />
                        </button>
                        <button type='button' className='rounded-xl border border-slate-700 bg-slate-950/40 p-2 text-slate-300 transition hover:text-orange-200'>
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                    </div>
                  </header>

                  <div className='max-h-[calc(100vh-290px)] space-y-3 overflow-y-auto px-4 py-4'>
                    {grupa.zlecenia.map((zlecenie) => (
                      <KartaZlecenia
                        key={zlecenie.id}
                        zlecenie={zlecenie}
                        typ={typ}
                        onClick={() =>
                          navigate(
                            typ === 'PAKOWANIE'
                              ? `/panel-pakowanie/zlecenie/${zlecenie.id}`
                              : `/panel-produkcja/zlecenie/${zlecenie.id}`
                          )
                        }
                      />
                    ))}
                  </div>

                  <div className='border-t border-slate-700 bg-slate-950/30 px-5 py-4'>
                    <button
                      type='button'
                      className='inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-orange-200 transition hover:text-orange-100'
                    >
                      <Plus size={16} />
                      Dodaj nowe zlecenie
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
