import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';
import {
  Activity,
  AlertTriangle,
  Boxes,
  Briefcase,
  ClipboardList,
  LayoutGrid,
  PackageCheck,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  Settings2,
  Square,
  Users,
} from 'lucide-react';
import klientApi from '../api/klient';

type KpiPulpitu = {
  aktywneZlecenia: number;
  zleceniaGotowe: number;
  zamowieniaWRealizacji: number;
  pracownicyNaHali: number;
  alertyMagazynowe: number;
  transakcjeNaDzisiaj: number;
  listaAktywnychZlecen: Array<{
    id: number;
    numer: string;
    status: string;
    iloscPlan: number;
    iloscWykonana: number;
    klient: { id: number; nazwa: string } | null;
    maszyna: { id: number; nazwa: string };
    zamowienie: { id: number; idProdio: string };
    produkt: { id: number; nazwa: string } | null;
  }>;
  statusyMaszyn: {
    wToku: number;
    pauza: number;
    stop: number;
  };
};

type ProdukcjaPulpitu = {
  maszyny: Array<{
    id: number;
    nazwa: string;
    status: 'W_TOKU' | 'PAUZA' | 'STOP';
    pracownik: { id: number; imie: string; nazwisko: string; kolorAvatara: string } | null;
    zlecenie: { id: number; numer: string; klient: { id: number; nazwa: string } | null; produkt: { id: number; nazwa: string } | null } | null;
    czasTrwaniaTekst: string;
    warstwyWykorzystania: Array<{ etykieta: string; wartosc: number; kolor: string }>;
  }>;
  pracownicy: Array<{
    id: number;
    imie: string;
    nazwisko: string;
    kolorAvatara: string;
    maszyna: { id: number; nazwa: string } | null;
    czasOdLogowaniaTekst: string;
    status: 'AKTYWNY' | 'PRZERWA';
    statusOpis: string;
  }>;
  timeline: Array<{
    id: string;
    typ: 'START' | 'STOP' | 'PAUZA';
    tytul: string;
    opis: string;
    relatywnie: string;
  }>;
  biuro: {
    nadchodzaceZamowienia: Array<{ id: number; idProdio: string; klient: { id: number; nazwa: string } | null; oczekiwanaData: string | null }>;
    zalegleZamowienia: Array<{ id: number; idProdio: string; klient: { id: number; nazwa: string } | null; oczekiwanaData: string | null }>;
    dniWolne: Array<{
      id: number;
      data: string;
      przyczyna: string | null;
      pracownik: { id: number; imie: string; nazwisko: string; kolorAvatara: string };
    }>;
  };
};

type MetrykiPulpitu = {
  porownanieCzasu: Array<{
    id: number;
    etykieta: string;
    zamowienie: string;
    produkt: string | null;
    planowaneMinuty: number;
    rzeczywisteMinuty: number;
  }>;
  kpi: Array<{ etykieta: string; wartosc: number; cel: number }>;
};

type AlertyPulpitu = {
  alerty: Array<{
    id: number;
    surowiec: string;
    jednostka: string;
    stanAktualny: number;
    srednieDzienneZuzycie: number;
    poziom: 'krytyczny' | 'ostrzegawczy';
    komunikat: string;
  }>;
};

type WidoczneSekcje = {
  wykresy: boolean;
  maszyny: boolean;
  pracownicy: boolean;
  timeline: boolean;
  biuro: boolean;
  alerty: boolean;
};

const DOMYSLNE_SEKCJE: WidoczneSekcje = {
  wykresy: true,
  maszyny: true,
  pracownicy: true,
  timeline: true,
  biuro: true,
  alerty: true,
};

function formatDate(date: string | null | undefined) {
  return date ? new Date(date).toLocaleDateString('pl-PL') : '--';
}

function formatTime(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(date)
    : '--:--:--';
}

function KartaKpi({ etykieta, wartosc, opis, ikona }: { etykieta: string; wartosc: number; opis: string; ikona: ReactNode }) {
  return (
    <article className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <p className='text-xs uppercase tracking-[0.2em] text-slate-400'>{etykieta}</p>
          <p className='mt-3 text-3xl font-semibold text-slate-100'>{wartosc}</p>
          <p className='mt-2 text-sm text-slate-400'>{opis}</p>
        </div>
        <div className='rounded-2xl border border-orange-400/20 bg-orange-400/10 p-3 text-orange-200'>{ikona}</div>
      </div>
    </article>
  );
}

function KartaSekcji({ tytul, opis, akcje, children }: { tytul: string; opis: string; akcje?: ReactNode; children: ReactNode }) {
  return (
    <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
      <div className='mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h2 className='text-xl font-semibold text-slate-100'>{tytul}</h2>
          <p className='mt-1 text-sm text-slate-400'>{opis}</p>
        </div>
        {akcje}
      </div>
      {children}
    </section>
  );
}

function Avatar({ imie, nazwisko, kolor }: { imie: string; nazwisko: string; kolor: string }) {
  const inicjaly = `${imie[0] ?? ''}${nazwisko[0] ?? ''}`.toUpperCase();
  return (
    <div className='flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold text-white' style={{ backgroundColor: kolor }}>
      {inicjaly}
    </div>
  );
}

function WykresCzasu({ dane }: { dane: MetrykiPulpitu['porownanieCzasu'] }) {
  const daneWykresu = dane.slice(0, 6).map((wiersz) => ({
    ...wiersz,
    etykietaSkrocona: wiersz.etykieta.slice(0, 8),
  }));
  return (
    <div className='h-[280px] rounded-3xl border border-slate-800 bg-slate-950/40 p-4'>
      <ResponsiveContainer width='100%' height={280}>
        <BarChart data={daneWykresu} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke='#1e293b' strokeDasharray='3 3' vertical={false} />
          <XAxis dataKey='etykietaSkrocona' stroke='#94a3b8' tickLine={false} axisLine={{ stroke: '#334155' }} />
          <YAxis stroke='#94a3b8' tickLine={false} axisLine={{ stroke: '#334155' }} />
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
            contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '16px', color: '#f1f5f9' }}
            labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
            formatter={(value: unknown, name: unknown) => [`${String(value)} min`, String(name) === 'planowaneMinuty' ? 'Planowane' : 'Rzeczywiste']}
          />
          <Bar dataKey='planowaneMinuty' fill='#64748b' radius={[6, 6, 0, 0]} />
          <Bar dataKey='rzeczywisteMinuty' fill='#f97316' radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function WykresKpi({ dane }: { dane: MetrykiPulpitu['kpi'] }) {
  return (
    <div className='grid gap-4 md:grid-cols-3'>
      {dane.map((wiersz) => (
        <div key={wiersz.etykieta} className='rounded-3xl border border-slate-800 bg-slate-950/40 p-4'>
          <div className='mb-3 flex items-center justify-between gap-3'>
            <p className='text-sm font-semibold text-slate-100'>{wiersz.etykieta}</p>
          </div>
          <div className='flex items-center gap-4'>
            <div className='h-32 w-32'>
              <ResponsiveContainer width='100%' height='100%'>
                <RadialBarChart
                  data={[{ etykieta: wiersz.etykieta, wartosc: Math.max(0, Math.min(wiersz.wartosc, 100)) }]}
                  innerRadius='72%'
                  outerRadius='100%'
                  startAngle={90}
                  endAngle={-270}
                  barSize={14}
                >
                  <RadialBar dataKey='wartosc' fill='#f97316' background={{ fill: '#1e293b' }} cornerRadius={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '16px', color: '#f1f5f9' }}
                    labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                    formatter={(value: unknown) => [`${String(value)}%`, 'Wartosc']}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className='space-y-1'>
              <div className='text-3xl font-semibold text-orange-200'>{wiersz.wartosc}%</div>
              <div className='text-sm text-slate-400'>Cel {wiersz.cel}%</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Pulpit() {
  const [dane, ustawDane] = useState<KpiPulpitu | null>(null);
  const [produkcja, ustawProdukcje] = useState<ProdukcjaPulpitu | null>(null);
  const [metryki, ustawMetryki] = useState<MetrykiPulpitu | null>(null);
  const [alerty, ustawAlerty] = useState<AlertyPulpitu | null>(null);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [odswiezanie, ustawOdswiezanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [ostatniaAktualizacja, ustawOstatniaAktualizacje] = useState<Date | null>(null);
  const [aktywnyStatusMaszyn, ustawAktywnyStatusMaszyn] = useState<'W_TOKU' | 'PAUZA' | 'STOP'>('W_TOKU');
  const [pokazDostosowanie, ustawPokazDostosowanie] = useState(false);
  const [widoczneSekcje, ustawWidoczneSekcje] = useState<WidoczneSekcje>(DOMYSLNE_SEKCJE);

  useEffect(() => {
    let anulowano = false;

    async function pobierzWszystko(czyCiche = false) {
      if (czyCiche) {
        ustawOdswiezanie(true);
      } else {
        ustawLadowanie(true);
      }
      ustawBlad('');

      try {
        const [odpowiedzPulpit, odpowiedzProdukcja, odpowiedzMetryki, odpowiedzAlerty] = await Promise.all([
          klientApi.get<{ sukces: boolean; dane: KpiPulpitu }>('/pulpit'),
          klientApi.get<{ sukces: boolean; dane: ProdukcjaPulpitu }>('/pulpit/produkcja'),
          klientApi.get<{ sukces: boolean; dane: MetrykiPulpitu }>('/pulpit/metryki'),
          klientApi.get<{ sukces: boolean; dane: AlertyPulpitu }>('/pulpit/alerty'),
        ]);

        if (!anulowano) {
          ustawDane(odpowiedzPulpit.data.dane);
          ustawProdukcje(odpowiedzProdukcja.data.dane);
          ustawMetryki(odpowiedzMetryki.data.dane);
          ustawAlerty(odpowiedzAlerty.data.dane);
          ustawOstatniaAktualizacje(new Date());
        }
      } catch {
        if (!anulowano) {
          ustawBlad('Nie udalo sie pobrac danych pulpitu.');
          ustawDane(null);
          ustawProdukcje(null);
          ustawMetryki(null);
          ustawAlerty(null);
        }
      } finally {
        if (!anulowano) {
          ustawLadowanie(false);
          ustawOdswiezanie(false);
        }
      }
    }

    void pobierzWszystko();
    const interwal = window.setInterval(() => {
      void pobierzWszystko(true);
    }, 180000);

    return () => {
      anulowano = true;
      window.clearInterval(interwal);
    };
  }, []);

  const maszynyFiltrowane = useMemo(
    () => produkcja?.maszyny.filter((maszyna) => maszyna.status === aktywnyStatusMaszyn) ?? [],
    [aktywnyStatusMaszyn, produkcja]
  );

  const przelaczSekcje = (klucz: keyof WidoczneSekcje) => {
    ustawWidoczneSekcje((poprzednie) => ({
      ...poprzednie,
      [klucz]: !poprzednie[klucz],
    }));
  };

  return (
    <div className='space-y-6 text-slate-100'>
      <section className='rounded-[28px] border border-slate-700 bg-gradient-to-br from-[#1E2A3A] via-[#182230] to-[#0f1724] p-6 shadow-2xl shadow-black/20'>
        <div className='flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
          <div>
            <div className='mb-3 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-200'>
              Sprint 11
            </div>
            <h1 className='text-3xl font-semibold'>Pulpit operacyjny</h1>
            <p className='mt-2 max-w-3xl text-sm text-slate-400'>
              Produkcja, pracownicy, biuro i alerty magazynowe w jednym widoku z auto-refresh co 3 minuty.
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-3'>
            <div className='rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-300'>
              Dzisiaj: <span className='font-semibold text-orange-200'>{new Date().toLocaleDateString('pl-PL')}</span>
            </div>
            <div className='rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-300'>
              Ostatnia aktualizacja: <span className='font-semibold text-orange-200'>{formatTime(ostatniaAktualizacja)}</span>
            </div>
            <button
              type='button'
              onClick={() => ustawPokazDostosowanie((poprzednie) => !poprzednie)}
              className='inline-flex items-center gap-2 rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 py-3 text-sm font-medium text-orange-200 transition hover:bg-orange-400/15'
            >
              <Settings2 size={16} />
              DOSTOSUJ
            </button>
          </div>
        </div>

        {pokazDostosowanie ? (
          <div className='mt-5 grid gap-3 rounded-[24px] border border-slate-700 bg-slate-950/40 p-4 md:grid-cols-3'>
            {Object.entries(widoczneSekcje).map(([klucz, aktywna]) => (
              <button
                key={klucz}
                type='button'
                onClick={() => przelaczSekcje(klucz as keyof WidoczneSekcje)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  aktywna ? 'border-orange-400/30 bg-orange-400/10 text-orange-200' : 'border-slate-700 bg-slate-950/40 text-slate-400'
                }`}
              >
                {klucz.toUpperCase()}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {blad ? <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        <KartaKpi etykieta='Aktywne zlecenia' wartosc={dane?.aktywneZlecenia ?? 0} opis='Zlecenia w toku na produkcji' ikona={<ClipboardList size={22} />} />
        <KartaKpi etykieta='Zlecenia gotowe' wartosc={dane?.zleceniaGotowe ?? 0} opis='Gotowe i oczekujace na rozliczenie' ikona={<PackageCheck size={22} />} />
        <KartaKpi etykieta='Zamowienia w realizacji' wartosc={dane?.zamowieniaWRealizacji ?? 0} opis='Aktywne zamowienia klientow' ikona={<Boxes size={22} />} />
        <KartaKpi etykieta='Pracownicy na hali' wartosc={dane?.pracownicyNaHali ?? 0} opis='Otwarte rejestracje bez wyjscia' ikona={<Users size={22} />} />
        <KartaKpi etykieta='Alerty magazynowe' wartosc={dane?.alertyMagazynowe ?? 0} opis='Wyliczane z realnych ruchow magazynowych' ikona={<Activity size={22} />} />
        <KartaKpi etykieta='Transakcje dzisiaj' wartosc={dane?.transakcjeNaDzisiaj ?? 0} opis='Ruchy magazynowe od poczatku dnia' ikona={<Boxes size={22} />} />
      </section>

      {widoczneSekcje.wykresy ? (
        <div className='grid gap-6 xl:grid-cols-[1.2fr_0.8fr]'>
          <KartaSekcji
            tytul='Porownanie czasu plan vs real'
            opis='Por\u00F3wnanie planowanego i rzeczywistego czasu realizacji zlece\u0144.'
            akcje={
              <div className='inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs text-slate-400'>
                <RefreshCcw size={14} className={odswiezanie ? 'animate-spin' : ''} />
                {odswiezanie ? 'Odswiezanie...' : 'Dane biezace'}
              </div>
            }
          >
            {metryki ? <WykresCzasu dane={metryki.porownanieCzasu} /> : <div className='text-sm text-slate-400'>{ladowanie ? 'Ladowanie wykresu...' : 'Brak danych.'}</div>}
          </KartaSekcji>
          <KartaSekcji tytul='KPI produkcyjne' opis='Wydajnosc, OEE i wykonanie planu.'>
            {metryki ? <WykresKpi dane={metryki.kpi} /> : <div className='text-sm text-slate-400'>{ladowanie ? 'Ladowanie KPI...' : 'Brak danych.'}</div>}
          </KartaSekcji>
        </div>
      ) : null}

      {widoczneSekcje.maszyny ? (
        <KartaSekcji
          tytul='Maszyny / Operacje'
          opis='Panel maszyn z podzialem na W TOKU, PAUZA i STOP.'
          akcje={
            <div className='flex flex-wrap gap-2'>
              {[
                { klucz: 'W_TOKU', etykieta: 'W TOKU', liczba: dane?.statusyMaszyn.wToku ?? 0, ikona: <PlayCircle size={14} /> },
                { klucz: 'PAUZA', etykieta: 'PAUZA', liczba: dane?.statusyMaszyn.pauza ?? 0, ikona: <PauseCircle size={14} /> },
                { klucz: 'STOP', etykieta: 'STOP', liczba: dane?.statusyMaszyn.stop ?? 0, ikona: <Square size={14} /> },
              ].map((tab) => (
                <button
                  key={tab.klucz}
                  type='button'
                  onClick={() => ustawAktywnyStatusMaszyn(tab.klucz as 'W_TOKU' | 'PAUZA' | 'STOP')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                    aktywnyStatusMaszyn === tab.klucz ? 'bg-orange-500 text-white' : 'border border-slate-700 bg-slate-950/40 text-slate-300'
                  }`}
                >
                  {tab.ikona}
                  {tab.etykieta} ({tab.liczba})
                </button>
              ))}
            </div>
          }
        >
          <div className='grid gap-4 xl:grid-cols-3'>
            {ladowanie ? (
              <div className='rounded-3xl border border-dashed border-slate-700 bg-slate-950/30 p-8 text-sm text-slate-400'>Ladowanie panelu maszyn...</div>
            ) : maszynyFiltrowane.length === 0 ? (
              <div className='rounded-3xl border border-dashed border-slate-700 bg-slate-950/30 p-8 text-sm text-slate-400'>Brak maszyn w wybranym statusie.</div>
            ) : (
              maszynyFiltrowane.map((maszyna) => (
                <article key={maszyna.id} className='rounded-[28px] border border-slate-800 bg-slate-950/40 p-5'>
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>Maszyna</p>
                      <h3 className='mt-2 text-xl font-semibold text-slate-100'>{maszyna.nazwa}</h3>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      maszyna.status === 'W_TOKU' ? 'bg-emerald-500/15 text-emerald-300' : maszyna.status === 'PAUZA' ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {maszyna.status}
                    </span>
                  </div>
                  <div className='mt-5 space-y-3 text-sm text-slate-300'>
                    <div className='rounded-2xl border border-slate-800 bg-slate-950/50 p-3'>
                      <div className='text-slate-500'>Pracownik</div>
                      <div className='mt-1 font-medium text-slate-100'>
                        {maszyna.pracownik ? `${maszyna.pracownik.imie} ${maszyna.pracownik.nazwisko}` : 'Nieprzypisany'}
                      </div>
                    </div>
                    <div className='rounded-2xl border border-slate-800 bg-slate-950/50 p-3'>
                      <div className='text-slate-500'>Zlecenie</div>
                      <div className='mt-1 font-medium text-orange-200'>{maszyna.zlecenie?.numer ?? 'Brak aktywnego zlecenia'}</div>
                      <div className='mt-1 text-slate-400'>{maszyna.zlecenie?.produkt?.nazwa ?? '--'}</div>
                    </div>
                    <div className='rounded-2xl border border-slate-800 bg-slate-950/50 p-3'>
                      <div className='text-slate-500'>Czas trwania</div>
                      <div className='mt-1 font-medium text-slate-100'>{maszyna.czasTrwaniaTekst}</div>
                    </div>
                  </div>
                  <div className='mt-5 space-y-3'>
                    {maszyna.warstwyWykorzystania.map((warstwa) => (
                      <div key={warstwa.etykieta}>
                        <div className='mb-1 flex items-center justify-between text-xs text-slate-400'>
                          <span>{warstwa.etykieta}</span>
                          <span>{warstwa.wartosc}%</span>
                        </div>
                        <div className='h-2 overflow-hidden rounded-full bg-slate-800'>
                          <div className='h-full rounded-full' style={{ width: `${warstwa.wartosc}%`, backgroundColor: warstwa.kolor }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        </KartaSekcji>
      ) : null}

      <div className='grid gap-6 xl:grid-cols-[0.9fr_1.1fr]'>
        {widoczneSekcje.pracownicy ? (
          <KartaSekcji tytul='Pracownicy w pracy' opis='Karty operatorow aktualnie zalogowanych na hali.'>
            <div className='grid gap-4 md:grid-cols-2'>
              {produkcja?.pracownicy.length ? (
                produkcja.pracownicy.map((pracownik) => (
                  <article key={pracownik.id} className='rounded-[24px] border border-slate-800 bg-slate-950/40 p-4'>
                    <div className='flex items-center gap-3'>
                      <Avatar imie={pracownik.imie} nazwisko={pracownik.nazwisko} kolor={pracownik.kolorAvatara} />
                      <div>
                        <h3 className='font-semibold text-slate-100'>{pracownik.imie} {pracownik.nazwisko}</h3>
                        <p className='text-sm text-slate-400'>{pracownik.maszyna?.nazwa ?? 'Bez przypisanej maszyny'}</p>
                      </div>
                    </div>
                    <div className='mt-4 flex items-center justify-between gap-3 text-sm'>
                      <span className={`inline-flex rounded-full px-3 py-1 font-medium ${
                        pracownik.status === 'AKTYWNY' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                      }`}>
                        {pracownik.status === 'AKTYWNY' ? 'aktywny' : 'przerwa'}
                      </span>
                      <span className='text-slate-400'>{pracownik.czasOdLogowaniaTekst}</span>
                    </div>
                    <p className='mt-3 text-sm text-slate-400'>{pracownik.statusOpis}</p>
                  </article>
                ))
              ) : (
                <div className='rounded-3xl border border-dashed border-slate-700 bg-slate-950/30 p-8 text-sm text-slate-400'>
                  {ladowanie ? 'Ladowanie pracownikow...' : 'Brak pracownikow aktualnie w pracy.'}
                </div>
              )}
            </div>
          </KartaSekcji>
        ) : null}

        {widoczneSekcje.timeline ? (
          <KartaSekcji tytul='Timeline ostatnich operacji' opis='Ostatnie zdarzenia start/stop/pauza.'>
            <div className='space-y-3'>
              {produkcja?.timeline.length ? (
                produkcja.timeline.map((wpis) => (
                  <article key={wpis.id} className='flex gap-4 rounded-[24px] border border-slate-800 bg-slate-950/40 p-4'>
                    <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-2xl ${
                      wpis.typ === 'START' ? 'bg-emerald-500/15 text-emerald-300' : wpis.typ === 'PAUZA' ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300'
                    }`}>
                      {wpis.typ === 'START' ? <PlayCircle size={18} /> : wpis.typ === 'PAUZA' ? <PauseCircle size={18} /> : <Square size={18} />}
                    </div>
                    <div className='flex-1'>
                      <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                        <h3 className='font-semibold text-slate-100'>{wpis.tytul}</h3>
                        <span className='text-xs uppercase tracking-[0.16em] text-slate-500'>{wpis.relatywnie}</span>
                      </div>
                      <p className='mt-1 text-sm text-slate-400'>{wpis.opis}</p>
                    </div>
                  </article>
                ))
              ) : (
                <div className='rounded-3xl border border-dashed border-slate-700 bg-slate-950/30 p-8 text-sm text-slate-400'>
                  {ladowanie ? 'Ladowanie timeline...' : 'Brak ostatnich zdarzen.'}
                </div>
              )}
            </div>
          </KartaSekcji>
        ) : null}
      </div>

      <div className='grid gap-6 xl:grid-cols-[1.15fr_0.85fr]'>
        {widoczneSekcje.biuro ? (
          <KartaSekcji tytul='Sekcja biuro' opis='Nadchodzace i zalegle zamowienia oraz dni wolne.'>
            <div className='grid gap-4 xl:grid-cols-3'>
              <div className='rounded-[24px] border border-slate-800 bg-slate-950/40 p-4'>
                <div className='mb-4 flex items-center gap-2 text-orange-200'>
                  <Briefcase size={16} />
                  <h3 className='font-semibold'>Nadchodzace zamowienia</h3>
                </div>
                <div className='space-y-3'>
                  {produkcja?.biuro.nadchodzaceZamowienia.length ? (
                    produkcja.biuro.nadchodzaceZamowienia.map((zamowienie) => (
                      <div key={zamowienie.id} className='rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-sm'>
                        <div className='font-semibold text-slate-100'>{zamowienie.idProdio}</div>
                        <div className='mt-1 text-slate-400'>{zamowienie.klient?.nazwa ?? 'Bez klienta'}</div>
                        <div className='mt-1 text-xs text-slate-500'>Termin {formatDate(zamowienie.oczekiwanaData)}</div>
                      </div>
                    ))
                  ) : (
                    <div className='text-sm text-slate-400'>Brak zamowien w ciagu 7 dni.</div>
                  )}
                </div>
              </div>

              <div className='rounded-[24px] border border-slate-800 bg-slate-950/40 p-4'>
                <div className='mb-4 flex items-center gap-2 text-red-300'>
                  <AlertTriangle size={16} />
                  <h3 className='font-semibold'>Zalegle zamowienia</h3>
                </div>
                <div className='space-y-3'>
                  {produkcja?.biuro.zalegleZamowienia.length ? (
                    produkcja.biuro.zalegleZamowienia.map((zamowienie) => (
                      <div key={zamowienie.id} className='rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-sm'>
                        <div className='font-semibold text-slate-100'>{zamowienie.idProdio}</div>
                        <div className='mt-1 text-slate-400'>{zamowienie.klient?.nazwa ?? 'Bez klienta'}</div>
                        <div className='mt-1 text-xs text-red-200'>Po terminie od {formatDate(zamowienie.oczekiwanaData)}</div>
                      </div>
                    ))
                  ) : (
                    <div className='text-sm text-slate-400'>Brak zaleglych zamowien.</div>
                  )}
                </div>
              </div>

              <div className='rounded-[24px] border border-slate-800 bg-slate-950/40 p-4'>
                <div className='mb-4 flex items-center gap-2 text-sky-300'>
                  <LayoutGrid size={16} />
                  <h3 className='font-semibold'>Dni wolne</h3>
                </div>
                <div className='space-y-3'>
                  {produkcja?.biuro.dniWolne.length ? (
                    produkcja.biuro.dniWolne.map((dzien) => (
                      <div key={dzien.id} className='rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-sm'>
                        <div className='font-semibold text-slate-100'>{dzien.pracownik.imie} {dzien.pracownik.nazwisko}</div>
                        <div className='mt-1 text-slate-400'>{formatDate(dzien.data)}</div>
                        <div className='mt-1 text-xs text-slate-500'>{dzien.przyczyna ?? 'Bez przyczyny'}</div>
                      </div>
                    ))
                  ) : (
                    <div className='text-sm text-slate-400'>Brak zaplanowanych dni wolnych.</div>
                  )}
                </div>
              </div>
            </div>
          </KartaSekcji>
        ) : null}

        {widoczneSekcje.alerty ? (
          <KartaSekcji tytul='Alerty magazynowe' opis='Rzeczywiste alerty wyliczone z ruchow magazynowych.'>
            <div className='space-y-3'>
              {alerty?.alerty.length ? (
                alerty.alerty.slice(0, 6).map((alert) => (
                  <article key={alert.id} className={`rounded-[24px] border p-4 ${
                    alert.poziom === 'krytyczny' ? 'border-red-500/25 bg-red-500/8' : 'border-amber-500/25 bg-amber-500/8'
                  }`}>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <h3 className='font-semibold text-slate-100'>{alert.surowiec}</h3>
                        <p className='mt-1 text-sm text-slate-400'>{alert.komunikat}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        alert.poziom === 'krytyczny' ? 'bg-red-500/15 text-red-200' : 'bg-amber-500/15 text-amber-200'
                      }`}>
                        {alert.poziom}
                      </span>
                    </div>
                    <div className='mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2'>
                      <div>Stan: <span className='font-medium text-slate-100'>{alert.stanAktualny} {alert.jednostka}</span></div>
                      <div>Zuzycie: <span className='font-medium text-slate-100'>{alert.srednieDzienneZuzycie} / dzien</span></div>
                    </div>
                  </article>
                ))
              ) : (
                <div className='rounded-3xl border border-dashed border-slate-700 bg-slate-950/30 p-8 text-sm text-slate-400'>
                  {ladowanie ? 'Ladowanie alertow...' : 'Brak aktywnych alertow magazynowych.'}
                </div>
              )}
            </div>
          </KartaSekcji>
        ) : null}
      </div>

      <KartaSekcji tytul='Aktywne zlecenia produkcyjne' opis='Najswiezsze zlecenia ze statusem `W_TOKU`.'>
        <div className='overflow-x-auto rounded-3xl border border-slate-700 bg-slate-950/40'>
          <table className='min-w-[1100px] w-full text-sm'>
            <thead className='bg-slate-950/80 text-slate-300'>
              <tr>
                {['Nr zlecenia', 'Zamowienie', 'Produkt', 'Klient', 'Maszyna', 'Postep', 'Status'].map((label) => (
                  <th key={label} className='px-4 py-3 text-left font-medium'>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ladowanie ? (
                <tr><td colSpan={7} className='px-4 py-10 text-center text-slate-400'>Ladowanie pulpitu...</td></tr>
              ) : !dane || dane.listaAktywnychZlecen.length === 0 ? (
                <tr><td colSpan={7} className='px-4 py-10 text-center text-slate-400'>Brak aktywnych zlecen w toku.</td></tr>
              ) : (
                dane.listaAktywnychZlecen.map((wiersz) => {
                  const procent = wiersz.iloscPlan > 0 ? Math.round((wiersz.iloscWykonana / wiersz.iloscPlan) * 100) : 0;
                  return (
                    <tr key={wiersz.id} className='border-t border-slate-800 odd:bg-slate-900/20'>
                      <td className='px-4 py-3 font-semibold text-orange-200'>{wiersz.numer}</td>
                      <td className='px-4 py-3'>{wiersz.zamowienie.idProdio}</td>
                      <td className='px-4 py-3'>{wiersz.produkt?.nazwa ?? '--'}</td>
                      <td className='px-4 py-3'>{wiersz.klient?.nazwa ?? '--'}</td>
                      <td className='px-4 py-3'>{wiersz.maszyna.nazwa}</td>
                      <td className='px-4 py-3'>
                        <div className='min-w-[180px]'>
                          <div className='mb-1 flex items-center justify-between gap-3 text-xs text-slate-400'>
                            <span>{wiersz.iloscWykonana}/{wiersz.iloscPlan}</span>
                            <span>{procent}%</span>
                          </div>
                          <div className='h-2 overflow-hidden rounded-full bg-slate-800'>
                            <div className='h-full rounded-full bg-orange-400' style={{ width: `${Math.max(0, Math.min(procent, 100))}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className='px-4 py-3'>
                        <span className='inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300'>
                          {wiersz.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </KartaSekcji>
    </div>
  );
}


