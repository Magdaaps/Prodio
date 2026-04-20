import { useEffect, useMemo, useState } from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { AlertCircle, Factory, Package2, RefreshCcw, User2 } from 'lucide-react';
import klientApi from '../api/klient';
import Rozwijane from '../komponenty/ui/Rozwijane';
import type { OdpowiedzApi, StatusZlecenia } from '../typy/indeks';

type StatusKanban = Extract<StatusZlecenia, 'STOP' | 'W_TOKU' | 'PAUZA' | 'GOTOWE'>;

type ZlecenieKanban = {
  id: number;
  numer: string;
  status: StatusKanban;
  iloscPlan: number;
  iloscWykonana: number;
  procentPostepu: number;
  utworzonyW: string;
  maszyna: { id: number; nazwa: string };
  zamowienie: { id: number; idProdio: string; zewnetrznyNumer: string | null };
  klient: { id: number; nazwa: string } | null;
  produkt: {
    id: number;
    nazwa: string;
    grupa: { id: number; nazwa: string } | null;
    zdjecie: string | null;
  } | null;
};

type PlanProdukcji = Record<StatusKanban, ZlecenieKanban[]>;

type OdpowiedzListy<T> = OdpowiedzApi<T[]> & {
  lacznie: number;
  strona: number;
  iloscNaStrone: number;
};

type MaszynaOpcja = {
  id: number;
  nazwa: string;
};

const KOLUMNY: Array<{
  status: StatusKanban;
  etykieta: string;
  akcent: string;
  obramowanie: string;
}> = [
  { status: 'STOP', etykieta: 'Stop', akcent: 'bg-slate-500', obramowanie: 'border-slate-400/30' },
  { status: 'W_TOKU', etykieta: 'W toku', akcent: 'bg-sky-500', obramowanie: 'border-sky-400/30' },
  { status: 'PAUZA', etykieta: 'Pauza', akcent: 'bg-amber-500', obramowanie: 'border-amber-400/30' },
  { status: 'GOTOWE', etykieta: 'Gotowe', akcent: 'bg-emerald-500', obramowanie: 'border-emerald-400/30' },
];

function pustyPlan(): PlanProdukcji {
  return {
    STOP: [],
    W_TOKU: [],
    PAUZA: [],
    GOTOWE: [],
  };
}

function formatujLiczbe(wartosc: number, miejsca = 0) {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: miejsca,
    maximumFractionDigits: miejsca,
  }).format(wartosc);
}

function procentPaska(procent: number) {
  return Math.max(0, Math.min(100, procent));
}

function przeniesZlecenie(
  plan: PlanProdukcji,
  source: { droppableId: string; index: number },
  destination: { droppableId: string; index: number }
): PlanProdukcji {
  const zrodloStatus = source.droppableId as StatusKanban;
  const celStatus = destination.droppableId as StatusKanban;
  const kolejne = {
    STOP: [...plan.STOP],
    W_TOKU: [...plan.W_TOKU],
    PAUZA: [...plan.PAUZA],
    GOTOWE: [...plan.GOTOWE],
  };

  const [przenoszone] = kolejne[zrodloStatus].splice(source.index, 1);
  if (!przenoszone) return plan;

  const poZmianie =
    zrodloStatus === celStatus ? przenoszone : { ...przenoszone, status: celStatus };

  kolejne[celStatus].splice(destination.index, 0, poZmianie);
  return kolejne;
}

function KartaZlecenia({ zlecenie }: { zlecenie: ZlecenieKanban }) {
  return (
    <article className='rounded-2xl border border-obramowanie bg-tlo-karta p-4 shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold tracking-[0.16em] text-akcent'>{zlecenie.numer}</p>
          <h3 className='mt-1 text-base font-semibold text-tekst-glowny'>
            {zlecenie.produkt?.nazwa || 'Brak przypisanego produktu'}
          </h3>
        </div>
        <span className='rounded-full border border-obramowanie px-2.5 py-1 text-xs text-tekst-drugorzedny'>
          {zlecenie.zamowienie.idProdio}
        </span>
      </div>

      <div className='mt-4 space-y-2 text-sm text-tekst-drugorzedny'>
        <div className='flex items-center gap-2'>
          <User2 size={15} className='text-akcent' />
          <span>{zlecenie.klient?.nazwa || 'Brak klienta'}</span>
        </div>
        <div className='flex items-center gap-2'>
          <Factory size={15} className='text-akcent' />
          <span>{zlecenie.maszyna.nazwa}</span>
        </div>
        <div className='flex items-center gap-2'>
          <Package2 size={15} className='text-akcent' />
          <span>
            Plan / wykonane: {formatujLiczbe(zlecenie.iloscPlan)} / {formatujLiczbe(zlecenie.iloscWykonana)}
          </span>
        </div>
      </div>

      <div className='mt-4'>
        <div className='mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-tekst-drugorzedny'>
          <span>Postep</span>
          <span>{formatujLiczbe(zlecenie.procentPostepu, 1)}%</span>
        </div>
        <div className='h-2.5 overflow-hidden rounded-full bg-tlo-glowne'>
          <div
            className='h-full rounded-full bg-akcent transition-all'
            style={{ width: `${procentPaska(zlecenie.procentPostepu)}%` }}
          />
        </div>
      </div>
    </article>
  );
}

export default function PlanProdukcji() {
  const [plan, ustawPlan] = useState<PlanProdukcji>(pustyPlan);
  const [maszyny, ustawMaszyny] = useState<MaszynaOpcja[]>([]);
  const [wybranaMaszyna, ustawWybranaMaszyne] = useState('wszystkie');
  const [ladowanie, ustawLadowanie] = useState(true);
  const [odswiezanie, ustawOdswiezanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [zapisywanyId, ustawZapisywanyId] = useState<number | null>(null);

  const opcjeMaszyn = useMemo(
    () => [
      { wartosc: 'wszystkie', etykieta: 'Wszystkie maszyny' },
      ...maszyny.map((maszyna) => ({ wartosc: String(maszyna.id), etykieta: maszyna.nazwa })),
    ],
    [maszyny]
  );

  const pobierzMaszyny = async () => {
    try {
      const odpowiedz = await klientApi.get<OdpowiedzListy<MaszynaOpcja>>('/maszyny', {
        params: { strona: 1, iloscNaStrone: 100, sortPole: 'nazwa', sortKierunek: 'asc' },
      });
      ustawMaszyny(odpowiedz.data.dane);
    } catch {
      ustawMaszyny([]);
    }
  };

  const pobierzPlan = async (wTle = false) => {
    if (wTle) {
      ustawOdswiezanie(true);
    } else {
      ustawLadowanie(true);
    }
    ustawBlad('');

    try {
      const odpowiedz = await klientApi.get<OdpowiedzApi<PlanProdukcji>>('/plan-produkcji', {
        params: {
          maszynaId: wybranaMaszyna !== 'wszystkie' ? wybranaMaszyna : undefined,
        },
      });
      ustawPlan({ ...pustyPlan(), ...odpowiedz.data.dane });
    } catch {
      ustawBlad('Nie udalo sie pobrac planu produkcji.');
      if (!wTle) {
        ustawPlan(pustyPlan());
      }
    } finally {
      ustawLadowanie(false);
      ustawOdswiezanie(false);
    }
  };

  useEffect(() => {
    void pobierzMaszyny();
  }, []);

  useEffect(() => {
    void pobierzPlan();
  }, [wybranaMaszyna]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void pobierzPlan(true);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [wybranaMaszyna]);

  const onDragEnd = async (wynik: DropResult) => {
    const { source, destination, draggableId } = wynik;
    if (!destination) return;

    const tenSamStatus = source.droppableId === destination.droppableId;
    const taSamaPozycja = tenSamStatus && source.index === destination.index;
    if (taSamaPozycja) return;

    const poprzedniPlan = plan;
    const nowyPlan = przeniesZlecenie(plan, source, destination);
    ustawPlan(nowyPlan);

    if (tenSamStatus) return;

    const noweStatus = destination.droppableId as StatusKanban;
    const zlecenieId = parseInt(draggableId, 10);
    ustawZapisywanyId(zlecenieId);
    ustawBlad('');

    try {
      await klientApi.patch(`/plan-produkcji/${zlecenieId}/status`, { status: noweStatus });
    } catch {
      ustawPlan(poprzedniPlan);
      ustawBlad('Nie udalo sie zmienic statusu zlecenia. Przywrocilem poprzedni uklad.');
    } finally {
      ustawZapisywanyId(null);
    }
  };

  const lacznieKart = plan.STOP.length + plan.W_TOKU.length + plan.PAUZA.length + plan.GOTOWE.length;

  return (
    <div className='space-y-6'>
      <section className='rounded-3xl border border-obramowanie bg-tlo-karta p-6 shadow-xl shadow-black/10'>
        <div className='flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.24em] text-akcent'>Sprint 6</p>
            <h1 className='mt-2 text-3xl font-semibold text-tekst-glowny'>Plan produkcji</h1>
            <p className='mt-3 max-w-3xl text-sm text-tekst-drugorzedny'>
              Przeglad zlecen w ukladzie Kanban z szybka zmiana statusu przez przeciaganie kart miedzy etapami.
            </p>
          </div>

          <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
            <Rozwijane
              etykieta='Filtr maszyny'
              opcje={opcjeMaszyn}
              wartosc={wybranaMaszyna}
              onZmiana={(wartosc) => ustawWybranaMaszyne(String(wartosc))}
              className='min-w-[260px]'
            />
            <button
              type='button'
              onClick={() => void pobierzPlan(true)}
              className='inline-flex h-[42px] items-center justify-center gap-2 rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-medium text-tekst-glowny transition-colors hover:border-akcent hover:text-akcent'
            >
              <RefreshCcw size={16} className={odswiezanie ? 'animate-spin' : ''} />
              Odswiez
            </button>
          </div>
        </div>

        <div className='mt-6 flex flex-wrap gap-3'>
          <div className='rounded-2xl border border-obramowanie bg-tlo-glowne px-4 py-3'>
            <p className='text-xs uppercase tracking-[0.18em] text-tekst-drugorzedny'>Liczba kart</p>
            <p className='mt-1 text-2xl font-semibold text-tekst-glowny'>{lacznieKart}</p>
          </div>
          <div className='rounded-2xl border border-obramowanie bg-tlo-glowne px-4 py-3'>
            <p className='text-xs uppercase tracking-[0.18em] text-tekst-drugorzedny'>Odswiezanie</p>
            <p className='mt-1 text-sm font-medium text-tekst-glowny'>Co 30 sekund</p>
          </div>
          {zapisywanyId ? (
            <div className='rounded-2xl border border-akcent/30 bg-akcent/10 px-4 py-3 text-sm text-tekst-glowny'>
              Zapisywanie statusu zlecenia #{zapisywanyId}...
            </div>
          ) : null}
        </div>

        {blad ? (
          <div className='mt-6 flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
            <AlertCircle size={18} className='mt-0.5 shrink-0' />
            <span>{blad}</span>
          </div>
        ) : null}
      </section>

      {ladowanie ? (
        <section className='rounded-3xl border border-obramowanie bg-tlo-karta px-6 py-16 text-center text-tekst-drugorzedny shadow-xl shadow-black/10'>
          Ladowanie planu produkcji...
        </section>
      ) : (
        <DragDropContext onDragEnd={(wynik) => void onDragEnd(wynik)}>
          <section className='overflow-x-auto pb-2'>
            <div className='flex min-w-max gap-5'>
              {KOLUMNY.map((kolumna) => (
                <Droppable droppableId={kolumna.status} key={kolumna.status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex w-[320px] shrink-0 flex-col rounded-3xl border bg-tlo-karta p-4 shadow-xl shadow-black/10 transition-colors ${
                        snapshot.isDraggingOver
                          ? `${kolumna.obramowanie} ring-2 ring-akcent/30`
                          : 'border-obramowanie'
                      }`}
                    >
                      <div className='mb-4 flex items-center justify-between gap-3'>
                        <div className='flex items-center gap-3'>
                          <span className={`h-3 w-3 rounded-full ${kolumna.akcent}`} />
                          <h2 className='text-lg font-semibold text-tekst-glowny'>{kolumna.etykieta}</h2>
                        </div>
                        <span className='rounded-full border border-obramowanie px-2.5 py-1 text-xs text-tekst-drugorzedny'>
                          {plan[kolumna.status].length}
                        </span>
                      </div>

                      <div className='flex min-h-[420px] flex-1 flex-col gap-3 rounded-2xl bg-tlo-glowne/30 p-1'>
                        {plan[kolumna.status].map((zlecenie, index) => (
                          <Draggable
                            key={zlecenie.id}
                            draggableId={String(zlecenie.id)}
                            index={index}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={dragSnapshot.isDragging ? 'rotate-[1deg]' : ''}
                              >
                                <KartaZlecenia zlecenie={zlecenie} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {plan[kolumna.status].length === 0 ? (
                          <div className='flex flex-1 items-center justify-center rounded-2xl border border-dashed border-obramowanie px-4 py-10 text-center text-sm text-tekst-drugorzedny'>
                            Brak zlecen w tej kolumnie.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </section>
        </DragDropContext>
      )}
    </div>
  );
}
