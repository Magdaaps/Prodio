import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUp,
  ArrowDownToLine,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Copy,
  Eye,
  ExternalLink,
  EyeOff,
  FolderOpen,
  GripVertical,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Power,
  Printer,
  Search,
  Settings2,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import klientApi from '../api/klient';
import { useTabelaDanych } from '../hooki/useTabelaDanych';
import Modal from '../komponenty/ui/Modal';
import Pole from '../komponenty/ui/Pole';
import Przycisk from '../komponenty/ui/Przycisk';
import Przelacznik from '../komponenty/ui/Przelacznik';
import Rozwijane from '../komponenty/ui/Rozwijane';
import type { OdpowiedzApi, StatusZlecenia } from '../typy/indeks';

type OdpowiedzListy<T> = OdpowiedzApi<T[]> & {
  lacznie: number;
  strona: number;
  iloscNaStrone: number;
};

type OpcjaPodstawowa = {
  id: number;
  nazwa: string;
};

type PracownikOpcja = {
  id: number;
  imie: string;
  nazwisko: string;
  stanowisko?: string | null;
  aktywny?: boolean;
};

type ZlecenieLista = {
  id: number;
  numer: string;
  status: StatusZlecenia;
  aktywne: boolean;
  iloscPlan: number;
  iloscWykonana: number;
  maszynaKoncowa: boolean;
  zamowienieId: number;
  idProdio: string;
  zewnetrznyNumer: string | null;
  klient: { id: number; nazwa: string } | null;
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
    procent: number;
  } | null;
};

type SzczegolyZlecenia = {
  id: number;
  numer: string;
  status: StatusZlecenia;
  aktywne: boolean;
  iloscPlan: number;
  iloscWykonana: number;
  iloscBrakow: number;
  planowanyStart: string | null;
  planowanyStop: string | null;
  poprzednikId: number | null;
  normaSztGodz: number | string;
  przypisaniPracownicyIds: number[];
  tagi: string[];
  parametry: string | null;
  uwagi: string | null;
  maszynaKoncowa: boolean;
  zamowienieId: number;
  maszynaId: number;
  przypisaniPracownicy: PracownikOpcja[];
  kandydaciPoprzednika: Array<{
    id: number;
    numer: string;
    iloscPlan: number;
    iloscWykonana: number;
  }>;
};

type ZamowieniePlanowania = {
  id: number;
  idProdio: string;
  zewnetrznyNumer: string | null;
  oczekiwanaData: string | null;
  status: string;
  klient: { id: number; nazwa: string } | null;
  pozycje: Array<{
    id: number;
    ilosc: number;
    produkt: { id: number; nazwa: string; zdjecie: string | null } | null;
  }>;
  zlecenia: Array<{
    id: number;
    numer: string;
    status: StatusZlecenia;
    iloscPlan: number;
    iloscWykonana: number;
    iloscBrakow: number;
    planowanyStart: string | null;
    planowanyStop: string | null;
    normaSztGodz: number | string;
    maszynaKoncowa: boolean;
    tagi: string[];
    parametry: string | null;
    uwagi: string | null;
    przypisaniPracownicyIds: number[];
    maszyna: { id: number; nazwa: string } | null;
  }>;
};

type FormularzEdycji = {
  maszynaId: string;
  iloscPlan: string;
  iloscWykonana: string;
  iloscBrakow: string;
  poprzednikId: string;
  planowanyStart: string;
  planowanyStop: string;
  normaSztGodz: string;
  status: StatusZlecenia;
  tagi: string;
  parametry: string;
  przypisaniPracownicyIds: number[];
  aktywne: boolean;
  maszynaKoncowa: boolean;
  uwagi: string;
};

type FiltryTabeli = {
  status: string;
  numer: string;
  idProdio: string;
  zewnetrznyNumer: string;
  klient: string;
  produkt: string;
};

type ElementMenuAkcji = {
  etykieta: string;
  ikona: ReactNode;
  akcja?: () => void;
  niebezpieczna?: boolean;
  wylaczone?: boolean;
};

const STATUSY_ZLECEN: Array<{ wartosc: StatusZlecenia; etykieta: string }> = [
  { wartosc: 'STOP', etykieta: 'STOP' },
  { wartosc: 'W_TOKU', etykieta: 'W TOKU' },
  { wartosc: 'PAUZA', etykieta: 'PAUZA' },
  { wartosc: 'GOTOWE', etykieta: 'GOTOWE' },
  { wartosc: 'ANULOWANE', etykieta: 'ANULOWANE' },
];

const STATUS_META: Record<
  StatusZlecenia,
  { etykieta: string; klasy: string; ikonka: string }
> = {
  STOP: { etykieta: 'STOP', klasy: 'bg-tlo-naglowek text-white', ikonka: '■' },
  W_TOKU: { etykieta: 'W TOKU', klasy: 'bg-akcent text-white', ikonka: '▶' },
  PAUZA: { etykieta: 'PAUZA', klasy: 'bg-obramowanie text-white', ikonka: '▌' },
  GOTOWE: { etykieta: 'GOTOWE', klasy: 'bg-emerald-500 text-white', ikonka: '✓' },
  ANULOWANE: { etykieta: 'ANULOWANE', klasy: 'bg-red-500 text-white', ikonka: '✕' },
};

const domyslnyFormularzEdycji = (): FormularzEdycji => ({
  maszynaId: '',
  iloscPlan: '',
  iloscWykonana: '',
  iloscBrakow: '',
  poprzednikId: '',
  planowanyStart: '',
  planowanyStop: '',
  normaSztGodz: '',
  status: 'STOP',
  tagi: '',
  parametry: '',
  przypisaniPracownicyIds: [],
  aktywne: true,
  maszynaKoncowa: false,
  uwagi: '',
});

const domyslneFiltry = (): FiltryTabeli => ({
  status: '',
  numer: '',
  idProdio: '',
  zewnetrznyNumer: '',
  klient: '',
  produkt: '',
});

function formatujLiczbe(wartosc: number | string, miejsca = 0) {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: miejsca,
    maximumFractionDigits: miejsca,
  }).format(Number(wartosc) || 0);
}

function naDateTimeLocal(wartosc: string | null) {
  if (!wartosc) return '';
  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) return '';
  const przesuniecie = data.getTimezoneOffset() * 60000;
  return new Date(data.getTime() - przesuniecie).toISOString().slice(0, 16);
}

function pobierzDateZDateTimeLocal(wartosc: string) {
  return wartosc ? wartosc.slice(0, 10) : '';
}

function pobierzGodzineZDateTimeLocal(wartosc: string) {
  return wartosc && wartosc.length >= 16 ? wartosc.slice(11, 16) : '';
}

function polaczDateIGodzine(data: string, godzina: string) {
  if (!data && !godzina) return '';
  if (!data) return '';
  return `${data}T${godzina || '00:00'}`;
}

function rozdzielTagi(wartosc: string) {
  return wartosc
    .split(',')
    .map((element) => element.trim())
    .filter(Boolean);
}

function pobierzNazwePracownika(pracownik: PracownikOpcja | undefined, fallbackId?: number) {
  if (!pracownik) {
    return fallbackId ? `Pracownik #${fallbackId}` : 'Nieznany pracownik';
  }

  const pelnaNazwa = `${pracownik.imie ?? ''} ${pracownik.nazwisko ?? ''}`.trim();
  return pelnaNazwa || `Pracownik #${pracownik.id}`;
}

function normalizuj(wartosc: string | null | undefined) {
  return String(wartosc ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function pobierzTekstStatusu(status: StatusZlecenia) {
  return STATUS_META[status]?.etykieta ?? status;
}

function formatujDatePlanowania(wartosc: string | null) {
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

function formatujNaglowekPlanowania(wartosc: string) {
  if (!wartosc) {
    return {
      rok: '----',
      dzien: 'Wybierz termin',
      godzina: '--:--',
    };
  }

  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) {
    return {
      rok: '----',
      dzien: 'Wybierz termin',
      godzina: '--:--',
    };
  }

  return {
    rok: new Intl.DateTimeFormat('pl-PL', { year: 'numeric' }).format(data),
    dzien: new Intl.DateTimeFormat('pl-PL', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(data),
    godzina: new Intl.DateTimeFormat('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(data),
  };
}

type KartaWyboruTerminuProps = {
  etykieta: string;
  wartosc: string;
  onZmiana: (wartosc: string) => void;
  onZapisz: () => void;
  disabled?: boolean;
  ariaLabelZapisu: string;
};

function KartaWyboruTerminu({
  etykieta,
  wartosc,
  onZmiana,
  onZapisz,
  disabled = false,
  ariaLabelZapisu,
}: KartaWyboruTerminuProps) {
  const naglowek = formatujNaglowekPlanowania(wartosc);
  const data = pobierzDateZDateTimeLocal(wartosc);
  const godzina = pobierzGodzineZDateTimeLocal(wartosc);

  return (
    <div className='min-w-[280px] overflow-hidden rounded-[18px] border border-obramowanie/80 bg-tlo-glowne shadow-[0_18px_40px_rgba(15,23,42,0.24)]'>
      <div className='flex items-start justify-between gap-3 bg-gradient-to-r from-tlo-naglowek via-slate-800 to-slate-700 px-4 py-4'>
        <div>
          <div className='text-[11px] font-semibold uppercase tracking-[0.22em] text-akcent/80'>{etykieta}</div>
          <div className='mt-2 text-xs font-medium text-tekst-drugorzedny'>{naglowek.rok}</div>
          <div className='mt-1 text-base font-semibold text-tekst-glowny'>{naglowek.dzien}</div>
        </div>
        <div className='rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-lg font-light tracking-[0.18em] text-white'>
          {naglowek.godzina}
        </div>
      </div>

      <div className='space-y-3 bg-tlo-karta/65 px-4 py-4'>
        <label className='block'>
          <span className='mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-tekst-drugorzedny'>
            <CalendarDays className='h-3.5 w-3.5 text-akcent' />
            Data
          </span>
          <div className='relative'>
            <input
              type='date'
              value={data}
              onChange={(event) => onZmiana(polaczDateIGodzine(event.target.value, godzina))}
              className='h-12 w-full rounded-[14px] border border-obramowanie bg-tlo-glowne/85 px-4 pr-11 text-sm text-tekst-glowny outline-none transition focus:border-akcent [color-scheme:dark]'
            />
            <ChevronRight className='pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-tekst-drugorzedny' />
          </div>
        </label>

        <label className='block'>
          <span className='mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-tekst-drugorzedny'>
            <Clock3 className='h-3.5 w-3.5 text-akcent' />
            Godzina
          </span>
          <div className='relative'>
            <input
              type='time'
              value={godzina}
              onChange={(event) => onZmiana(polaczDateIGodzine(data, event.target.value))}
              className='h-12 w-full rounded-[14px] border border-obramowanie bg-tlo-glowne/85 px-4 pr-11 text-sm font-medium tracking-[0.18em] text-tekst-glowny outline-none transition focus:border-akcent [color-scheme:dark]'
            />
            <Clock3 className='pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-akcent' />
          </div>
        </label>

        <button
          type='button'
          onClick={onZapisz}
          disabled={disabled}
          className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-akcent/30 bg-akcent/10 px-4 text-sm font-semibold text-akcent transition hover:bg-akcent/20 disabled:cursor-not-allowed disabled:border-obramowanie disabled:bg-tlo-glowne disabled:text-tekst-drugorzedny'
          aria-label={ariaLabelZapisu}
        >
          <Check className='h-4 w-4' />
          Zapisz termin
        </button>
      </div>
    </div>
  );
}

function formatujNormatywnyCzas(iloscPlan: number, normaSztGodz: number | string) {
  const norma = Number(String(normaSztGodz).replace(',', '.'));
  if (!Number.isFinite(norma) || norma <= 0 || iloscPlan <= 0) {
    return '-';
  }

  const lacznieSekund = Math.round((iloscPlan / norma) * 60 * 60);
  const godziny = String(Math.floor(lacznieSekund / 3600)).padStart(2, '0');
  const minuty = String(Math.floor((lacznieSekund % 3600) / 60)).padStart(2, '0');
  const sekundy = String(lacznieSekund % 60).padStart(2, '0');

  return `${godziny}:${minuty}:${sekundy}`;
}

function pobierzKlaseStatusuPlanowania(status: string) {
  switch (status) {
    case 'NOWE':
      return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
    case 'W_REALIZACJI':
      return 'bg-akcent/15 text-akcent border border-akcent/30';
    case 'GOTOWE':
      return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
    case 'ANULOWANE':
      return 'bg-red-500/15 text-red-300 border border-red-500/30';
    default:
      return 'bg-obramowanie/60 text-tekst-glowny border border-obramowanie';
  }
}

function StatusZleceniaPill({ status }: { status: StatusZlecenia }) {
  const meta = STATUS_META[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold ${meta.klasy}`}
    >
      <span className='text-[10px]'>{meta.ikonka}</span>
      <span>{meta.etykieta}</span>
    </span>
  );
}

function PasekPoprzednika({
  poprzednik,
}: {
  poprzednik: ZlecenieLista['poprzednik'];
}) {
  if (!poprzednik) {
    return <span className='text-sm text-tekst-drugorzedny'>-</span>;
  }

  const procent = Math.max(0, Math.min(100, poprzednik.procent));

  return (
    <div className='min-w-[130px] rounded-none bg-obramowanie px-3 py-2 text-white'>
      <div className='flex items-center gap-3'>
        <div className='flex h-7 w-7 items-center justify-center rounded-full bg-akcent'>
          <Play className='h-3.5 w-3.5 fill-current' />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='truncate text-sm font-semibold'>
            {formatujLiczbe(poprzednik.iloscWykonana, 0)}/{formatujLiczbe(poprzednik.iloscPlan, 0)}
          </div>
          <div className='mt-1 h-1.5 overflow-hidden rounded-full bg-white/20'>
            <div className='h-full rounded-full bg-blue-400' style={{ width: `${procent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuAkcji({
  elementy,
  otwarte,
  onToggle,
  onClose,
}: {
  elementy: ElementMenuAkcji[];
  otwarte: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const przyciskRef = useRef<HTMLButtonElement | null>(null);
  const [pozycjaMenu, ustawPozycjeMenu] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useEffect(() => {
    if (!otwarte) {
      return;
    }

    const obsluzKlik = (event: MouseEvent) => {
      const target = event.target as Node;
      const klikWPrzycisku = ref.current?.contains(target);
      const klikWPortalu = portalRef.current?.contains(target);

      if (!klikWPrzycisku && !klikWPortalu) {
        onClose();
      }
    };

    document.addEventListener('mousedown', obsluzKlik);
    return () => document.removeEventListener('mousedown', obsluzKlik);
  }, [onClose, otwarte]);

  useEffect(() => {
    if (!otwarte || !przyciskRef.current) {
      return;
    }

    const obliczPozycje = () => {
      if (!przyciskRef.current) {
        return;
      }

      const rect = przyciskRef.current.getBoundingClientRect();
      const szerokoscMenu = 232;
      const odstep = 8;
      const margines = 12;
      const preferowanyTop = rect.bottom + odstep;
      const preferowanyBottom = rect.top - odstep;
      const wysokoscWdol = window.innerHeight - preferowanyTop - margines;
      const wysokoscWGore = preferowanyBottom - margines;
      const otwierajWGore = wysokoscWdol < 260 && wysokoscWGore > wysokoscWdol;
      const top = otwierajWGore
        ? Math.max(margines, preferowanyBottom - Math.min(420, wysokoscWGore))
        : preferowanyTop;
      const maxHeight = Math.max(180, otwierajWGore ? wysokoscWGore : wysokoscWdol);

      const left = Math.min(
        window.innerWidth - szerokoscMenu - margines,
        Math.max(margines, rect.right - szerokoscMenu)
      );

      ustawPozycjeMenu({ top, left, maxHeight });
    };

    obliczPozycje();
    window.addEventListener('resize', obliczPozycje);
    window.addEventListener('scroll', obliczPozycje, true);

    return () => {
      window.removeEventListener('resize', obliczPozycje);
      window.removeEventListener('scroll', obliczPozycje, true);
    };
  }, [elementy.length, otwarte]);

  return (
    <div ref={ref} className='relative flex justify-center'>
      <button
        ref={przyciskRef}
        type='button'
        onClick={onToggle}
        className='flex h-10 w-10 items-center justify-center rounded-full border border-obramowanie bg-tlo-glowne text-akcent transition hover:border-akcent hover:bg-akcent/10'
        aria-label='Pokaz akcje'
      >
        <MoreHorizontal className='h-5 w-5' />
      </button>

      {otwarte && pozycjaMenu
        ? createPortal(
            <div
              ref={portalRef}
              className='fixed z-[9999] w-[232px] overflow-y-auto overflow-x-hidden rounded-xl border border-obramowanie bg-tlo-karta shadow-2xl'
              style={{ top: pozycjaMenu.top, left: pozycjaMenu.left, maxHeight: `${pozycjaMenu.maxHeight}px` }}
            >
              {elementy.map((element) => (
                <button
                  key={element.etykieta}
                  type='button'
                  disabled={element.wylaczone}
                  onClick={() => {
                    element.akcja?.();
                    onClose();
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition ${
                    element.wylaczone
                      ? 'cursor-not-allowed text-tekst-drugorzedny/50'
                      : element.niebezpieczna
                        ? 'text-red-300 hover:bg-red-500/10'
                        : 'text-tekst-glowny hover:bg-tlo-glowne'
                  }`}
                >
                  <span className='shrink-0'>{element.ikona}</span>
                  <span>{element.etykieta}</span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function PoleDatyZPotwierdzeniem({
  etykieta,
  roboczaWartosc,
  zatwierdzonaWartosc,
  onZmianaRobocza,
  onZatwierdz,
}: {
  etykieta: string;
  roboczaWartosc: string;
  zatwierdzonaWartosc: string;
  onZmianaRobocza: (wartosc: string) => void;
  onZatwierdz: () => void;
}) {
  const czyMoznaZatwierdzic = roboczaWartosc !== zatwierdzonaWartosc;

  return (
    <div className='space-y-2'>
      <label className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>{etykieta}</label>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <input
          type='datetime-local'
          value={roboczaWartosc}
          onChange={(event) => onZmianaRobocza(event.target.value)}
          className='w-full rounded-lg border border-obramowanie bg-tlo-glowne px-4 py-2.5 text-sm text-tekst-glowny transition focus:border-akcent focus:outline-none'
        />
        <button
          type='button'
          onClick={onZatwierdz}
          disabled={!czyMoznaZatwierdzic}
          className='inline-flex h-[42px] shrink-0 items-center justify-center rounded-lg border border-akcent/40 bg-akcent/10 px-4 text-sm font-semibold text-akcent transition hover:bg-akcent/15 disabled:cursor-not-allowed disabled:border-obramowanie disabled:bg-tlo-naglowek disabled:text-tekst-drugorzedny'
        >
          Zatwierdz
        </button>
      </div>
      <p className='text-xs text-tekst-drugorzedny'>
        Zatwierdzona wartosc:{' '}
        <span className='font-medium text-tekst-glowny'>{zatwierdzonaWartosc || 'brak'}</span>
      </p>
    </div>
  );
}

export default function ZleceniaProdukcyjne() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    strona,
    iloscNaStrone,
    kluczSortowania,
    kierunekSortowania,
    onZmianaStrony,
    onSortowanie,
  } = useTabelaDanych(30);

  const [zlecenia, ustawZlecenia] = useState<ZlecenieLista[]>([]);
  const [kolejnoscIds, ustawKolejnoscIds] = useState<number[]>([]);
  const [lacznie, ustawLacznie] = useState(0);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [blad, ustawBlad] = useState('');
  const [pokazNieaktywne, ustawPokazNieaktywne] = useState(true);
  const [ukryjGotowe, ustawUkryjGotowe] = useState(false);
  const [pokazFiltry, ustawPokazFiltry] = useState(true);
  const [otwarteMenuId, ustawOtwarteMenuId] = useState<number | null>(null);
  const [zaznaczoneIds, ustawZaznaczoneIds] = useState<number[]>([]);
  const [filtry, ustawFiltry] = useState<FiltryTabeli>(domyslneFiltry);
  const [maszynyOpcje, ustawMaszynyOpcje] = useState<OpcjaPodstawowa[]>([]);
  const [pracownicyOpcje, ustawPracownicyOpcje] = useState<PracownikOpcja[]>([]);
  const [czyModalEdycji, ustawCzyModalEdycji] = useState(false);
  const [edytowaneId, ustawEdytowaneId] = useState<number | null>(null);
  const [szczegoly, ustawSzczegoly] = useState<SzczegolyZlecenia | null>(null);
  const [formularz, ustawFormularz] = useState<FormularzEdycji>(domyslnyFormularzEdycji);
  const [bladFormularza, ustawBladFormularza] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [ladowanieSzczegolow, ustawLadowanieSzczegolow] = useState(false);
  const [roboczyPlanowanyStart, ustawRoboczyPlanowanyStart] = useState('');
  const [roboczyPlanowanyStop, ustawRoboczyPlanowanyStop] = useState('');
  const [operacjaId, ustawOperacjaId] = useState<number | null>(null);
  const [roboczeTerminyPlanowania, ustawRoboczeTerminyPlanowania] = useState<
    Record<number, { planowanyStart: string; planowanyStop: string }>
  >({});
  const [roboczeIlosciPlanowania, ustawRoboczeIlosciPlanowania] = useState<Record<number, string>>({});
  const [roboczeTagiPlanowania, ustawRoboczeTagiPlanowania] = useState<Record<number, string>>({});
  const [roboczeParametryPlanowania, ustawRoboczeParametryPlanowania] = useState<Record<number, string>>({});
  const [roboczyPracownicyPlanowania, ustawRoboczyPracownicyPlanowania] = useState<Record<number, number[]>>({});
  const [otwartePrzypisaniePracownikowId, ustawOtwartePrzypisaniePracownikowId] = useState<number | null>(null);
  const [szukajPracownikaPlanowania, ustawSzukajPracownikaPlanowania] = useState('');
  const [pokazPanelPlanowania, ustawPokazPanelPlanowania] = useState(false);
  const [szukajPlanowania, ustawSzukajPlanowania] = useState('');
  const [otwarteWynikiPlanowania, ustawOtwarteWynikiPlanowania] = useState(false);
  const [kandydatPlanowaniaId, ustawKandydatPlanowaniaId] = useState<number | null>(null);
  const [wybraneDoPlanowaniaIds, ustawWybraneDoPlanowaniaIds] = useState<number[]>([]);
  const [zamowieniePlanowania, ustawZamowieniePlanowania] = useState<ZamowieniePlanowania | null>(null);
  const [ladowaniePlanowania, ustawLadowaniePlanowania] = useState(false);
  const [bladPlanowania, ustawBladPlanowania] = useState('');
  const [inicjalizacjaPlanowania, ustawInicjalizacjaPlanowania] = useState(false);
  const refPlanowania = useRef<HTMLDivElement | null>(null);
  const inicjalizowaneZamowieniaRef = useRef<Set<number>>(new Set());
  const otwarteZParametruRef = useRef<number | null>(null);
  const zamowienieIdParam = Number(searchParams.get('zamowienieId') ?? '');
  const zlecenieDoOtwarciaParam = Number(searchParams.get('zlecenie') ?? '');
  const czyWidokPlanowaniaZamowienia = Number.isFinite(zamowienieIdParam) && zamowienieIdParam > 0;

  const opcjeStatusow = useMemo(
    () => STATUSY_ZLECEN.map((status) => ({ wartosc: status.wartosc, etykieta: status.etykieta })),
    []
  );

  const opcjeMaszyn = useMemo(
    () => maszynyOpcje.map((maszyna) => ({ wartosc: String(maszyna.id), etykieta: maszyna.nazwa })),
    [maszynyOpcje]
  );

  const mapaPracownikow = useMemo(
    () => new Map(pracownicyOpcje.map((pracownik) => [pracownik.id, pracownik])),
    [pracownicyOpcje]
  );

  const przefiltrowaniPracownicyPlanowania = useMemo(() => {
    const wzorzec = normalizuj(szukajPracownikaPlanowania);

    if (!wzorzec) {
      return pracownicyOpcje;
    }

    return pracownicyOpcje.filter((pracownik) =>
      normalizuj(`${pracownik.imie} ${pracownik.nazwisko} ${pracownik.stanowisko ?? ''}`).includes(wzorzec)
    );
  }, [pracownicyOpcje, szukajPracownikaPlanowania]);

  const mapaZlecen = useMemo(
    () => new Map(zlecenia.map((zlecenie) => [zlecenie.id, zlecenie])),
    [zlecenia]
  );

  const uporzadkowaneZlecenia = useMemo(() => {
    const widziane = new Set<number>();
    const poKolei = kolejnoscIds
      .map((id) => mapaZlecen.get(id))
      .filter((wiersz): wiersz is ZlecenieLista => Boolean(wiersz))
      .filter((wiersz) => {
        if (widziane.has(wiersz.id)) {
          return false;
        }
        widziane.add(wiersz.id);
        return true;
      });

    const brakujace = zlecenia.filter((wiersz) => !widziane.has(wiersz.id));
    return [...poKolei, ...brakujace];
  }, [kolejnoscIds, mapaZlecen, zlecenia]);

  const widoczneZlecenia = useMemo(
    () =>
      uporzadkowaneZlecenia.filter((zlecenie) => {
        const zgodnyStatus =
          !filtry.status || zlecenie.status === filtry.status;
        const zgodnyNumer = normalizuj(zlecenie.numer).includes(normalizuj(filtry.numer));
        const zgodnyIdProdio = normalizuj(zlecenie.idProdio).includes(normalizuj(filtry.idProdio));
        const zgodnyZewnetrzny = normalizuj(zlecenie.zewnetrznyNumer).includes(normalizuj(filtry.zewnetrznyNumer));
        const zgodnyKlient = normalizuj(zlecenie.klient?.nazwa).includes(normalizuj(filtry.klient));
        const zgodnyProdukt = normalizuj(zlecenie.produkt?.nazwa).includes(normalizuj(filtry.produkt));

        return (
          zgodnyStatus &&
          zgodnyNumer &&
          zgodnyIdProdio &&
          zgodnyZewnetrzny &&
          zgodnyKlient &&
          zgodnyProdukt
        );
      }),
    [filtry, uporzadkowaneZlecenia]
  );

  const kandydaciPlanowania = useMemo(
    () =>
      uporzadkowaneZlecenia.filter((zlecenie) => {
        if (wybraneDoPlanowaniaIds.includes(zlecenie.id)) {
          return false;
        }

        const wzorzec = normalizuj(szukajPlanowania);
        if (!wzorzec) {
          return true;
        }

        return [
          zlecenie.idProdio,
          zlecenie.zewnetrznyNumer,
          zlecenie.klient?.nazwa,
          zlecenie.produkt?.nazwa,
          zlecenie.numer,
        ].some((wartosc) => normalizuj(wartosc).includes(wzorzec));
      }),
    [szukajPlanowania, uporzadkowaneZlecenia, wybraneDoPlanowaniaIds]
  );

  const wybraneDoPlanowania = useMemo(
    () =>
      wybraneDoPlanowaniaIds
        .map((id) => mapaZlecen.get(id))
        .filter((wiersz): wiersz is ZlecenieLista => Boolean(wiersz)),
    [mapaZlecen, wybraneDoPlanowaniaIds]
  );

  const uporzadkowaneZleceniaPlanowania = useMemo(() => {
    if (!zamowieniePlanowania) {
      return [];
    }

    const mapaPlanowania = new Map(zamowieniePlanowania.zlecenia.map((zlecenie) => [zlecenie.id, zlecenie]));
    const widziane = new Set<number>();

    const poKolei = kolejnoscIds
      .map((id) => mapaPlanowania.get(id))
      .filter((wiersz): wiersz is ZamowieniePlanowania['zlecenia'][number] => Boolean(wiersz))
      .filter((wiersz) => {
        if (widziane.has(wiersz.id)) {
          return false;
        }
        widziane.add(wiersz.id);
        return true;
      });

    const brakujace = zamowieniePlanowania.zlecenia.filter((wiersz) => !widziane.has(wiersz.id));
    return [...poKolei, ...brakujace];
  }, [kolejnoscIds, zamowieniePlanowania]);

  useEffect(() => {
    if (!zamowieniePlanowania) {
      ustawRoboczeTerminyPlanowania({});
      ustawRoboczeIlosciPlanowania({});
      ustawRoboczeTagiPlanowania({});
      ustawRoboczeParametryPlanowania({});
      ustawRoboczyPracownicyPlanowania({});
      ustawKolejnoscIds([]);
      return;
    }

    ustawKolejnoscIds(zamowieniePlanowania.zlecenia.map((zlecenie) => zlecenie.id));

    ustawRoboczeTerminyPlanowania(
      Object.fromEntries(
        zamowieniePlanowania.zlecenia.map((zlecenie) => [
          zlecenie.id,
          {
            planowanyStart: naDateTimeLocal(zlecenie.planowanyStart),
            planowanyStop: naDateTimeLocal(zlecenie.planowanyStop),
          },
        ])
      )
    );

    ustawRoboczeIlosciPlanowania(
      Object.fromEntries(
        zamowieniePlanowania.zlecenia.map((zlecenie) => [zlecenie.id, String(zlecenie.iloscPlan)])
      )
    );

    ustawRoboczeTagiPlanowania(
      Object.fromEntries(
        zamowieniePlanowania.zlecenia.map((zlecenie) => [zlecenie.id, zlecenie.tagi.join(', ')])
      )
    );

    ustawRoboczeParametryPlanowania(
      Object.fromEntries(
        zamowieniePlanowania.zlecenia.map((zlecenie) => [zlecenie.id, zlecenie.parametry ?? ''])
      )
    );

    ustawRoboczyPracownicyPlanowania(
      Object.fromEntries(
        zamowieniePlanowania.zlecenia.map((zlecenie) => [zlecenie.id, zlecenie.przypisaniPracownicyIds ?? []])
      )
    );
  }, [zamowieniePlanowania]);

  const zaznaczoneWidoczne =
    widoczneZlecenia.length > 0 &&
    widoczneZlecenia.every((zlecenie) => zaznaczoneIds.includes(zlecenie.id));

  const liczbaStron = Math.max(1, Math.ceil(lacznie / iloscNaStrone));
  const zakresOd = lacznie === 0 ? 0 : (strona - 1) * iloscNaStrone + 1;
  const zakresDo = Math.min(strona * iloscNaStrone, lacznie);

  const pobierzListe = async () => {
    ustawLadowanie(true);
    ustawBlad('');

    try {
      const odpowiedz = await klientApi.get<OdpowiedzListy<ZlecenieLista>>('/zlecenia-produkcyjne', {
        params: {
          strona,
          iloscNaStrone,
          pokazNieaktywne,
          ukryjGotowe,
          sortPole: kluczSortowania,
          sortKierunek: kierunekSortowania,
        },
      });

      ustawZlecenia(odpowiedz.data.dane);
      ustawLacznie(odpowiedz.data.lacznie);
      ustawKolejnoscIds(odpowiedz.data.dane.map((wiersz) => wiersz.id));
    } catch {
      ustawBlad('Nie udalo sie pobrac listy zlecen produkcyjnych.');
      ustawZlecenia([]);
      ustawLacznie(0);
      ustawKolejnoscIds([]);
    } finally {
      ustawLadowanie(false);
    }
  };

  const pobierzMaszyny = async () => {
    try {
      const odpowiedz = await klientApi.get<OdpowiedzListy<OpcjaPodstawowa>>('/maszyny', {
        params: { strona: 1, iloscNaStrone: 100, sortPole: 'nazwa', sortKierunek: 'asc' },
      });
      ustawMaszynyOpcje(odpowiedz.data.dane);
    } catch {
      ustawMaszynyOpcje([]);
    }
  };

  const pobierzPracownikow = async () => {
    try {
      const odpowiedz = await klientApi.get<OdpowiedzListy<PracownikOpcja>>('/pracownicy', {
        params: { strona: 1, iloscNaStrone: 100, sortPole: 'nazwisko', sortKierunek: 'asc' },
      });
      ustawPracownicyOpcje(odpowiedz.data.dane);
    } catch {
      ustawPracownicyOpcje([]);
    }
  };

  const pobierzSzczegolyJednorazowo = async (id: number) => {
    const odpowiedz = await klientApi.get<OdpowiedzApi<SzczegolyZlecenia>>(`/zlecenia-produkcyjne/${id}`);
    return odpowiedz.data.dane;
  };

  const pobierzZamowieniePlanowania = async () => {
    if (!czyWidokPlanowaniaZamowienia) {
      ustawZamowieniePlanowania(null);
      return;
    }

    ustawLadowaniePlanowania(true);
    ustawBladPlanowania('');

    try {
      const odpowiedz = await klientApi.get<OdpowiedzApi<ZamowieniePlanowania>>(`/zamowienia/${zamowienieIdParam}`);
      ustawZamowieniePlanowania(odpowiedz.data.dane);
    } catch {
      ustawBladPlanowania('Nie udalo sie pobrac danych do planowania zamowienia.');
      ustawZamowieniePlanowania(null);
    } finally {
      ustawLadowaniePlanowania(false);
    }
  };

  const utworzOperacjeDlaZamowienia = async (zamowienie: ZamowieniePlanowania) => {
    const pozycjeZProduktami = zamowienie.pozycje.filter((pozycja) => pozycja.produkt?.id);
    if (pozycjeZProduktami.length === 0) {
      return false;
    }

    ustawInicjalizacjaPlanowania(true);

    try {
      await klientApi.post('/zlecenia-produkcyjne/inicjalizuj-zamowienie', {
        zamowienieId: String(zamowienie.id),
      });
      return true;
    } catch {
      ustawBladPlanowania('Nie udalo sie przygotowac operacji planowania dla tego zamowienia.');
      return false;
    } finally {
      ustawInicjalizacjaPlanowania(false);
    }
  };

  const odswiezWidok = async () => {
    if (czyWidokPlanowaniaZamowienia) {
      await pobierzZamowieniePlanowania();
      return;
    }

    await pobierzListe();
  };

  const zapiszTerminPlanowania = async (
    id: number,
    pole: 'planowanyStart' | 'planowanyStop'
  ) => {
    const wartosc = roboczeTerminyPlanowania[id]?.[pole] ?? '';

    await zaktualizujNaPodstawieSzczegolow(
      id,
      () => ({ [pole]: wartosc || null }),
      pole === 'planowanyStart'
        ? 'Nie udalo sie zapisac planowanego startu.'
        : 'Nie udalo sie zapisac planowanego stopu.'
    );
  };

  const zapiszIloscPlanowania = async (id: number) => {
    const wartosc = (roboczeIlosciPlanowania[id] ?? '').trim();
    const ilosc = Number(wartosc.replace(',', '.'));

    if (!wartosc || !Number.isFinite(ilosc) || ilosc < 0) {
      ustawBlad('Podaj poprawna ilosc planowana.');
      return;
    }

    await zaktualizujNaPodstawieSzczegolow(
      id,
      () => ({ iloscPlan: String(ilosc) }),
      'Nie udalo sie zapisac ilosci planowanej.'
    );
  };

  const zapiszTagiPlanowania = async (id: number) => {
    const wartosc = roboczeTagiPlanowania[id] ?? '';

    await zaktualizujNaPodstawieSzczegolow(
      id,
      () => ({ tagi: rozdzielTagi(wartosc) }),
      'Nie udalo sie zapisac tagow operacji.'
    );
  };

  const zapiszParametryPlanowania = async (id: number) => {
    const wartosc = roboczeParametryPlanowania[id] ?? '';

    await zaktualizujNaPodstawieSzczegolow(
      id,
      () => ({ parametry: wartosc.trim() || null }),
      'Nie udalo sie zapisac parametrow operacji.'
    );
  };

  const zapiszPracownikowPlanowania = async (id: number) => {
    const zapisano = await zaktualizujNaPodstawieSzczegolow(
      id,
      () => ({ przypisaniPracownicyIds: roboczyPracownicyPlanowania[id] ?? [] }),
      'Nie udalo sie zapisac przypisanych pracownikow.'
    );

    if (zapisano) {
      ustawOtwartePrzypisaniePracownikowId(null);
      ustawSzukajPracownikaPlanowania('');
    }
  };

  const wyczyscRoboczeDatyPlanowania = () => {
    ustawRoboczyPlanowanyStart('');
    ustawRoboczyPlanowanyStop('');
  };

  const zamknijModalEdycji = () => {
    ustawCzyModalEdycji(false);
    wyczyscRoboczeDatyPlanowania();
  };

  const otworzEdycje = async (id: number) => {
    ustawCzyModalEdycji(true);
    ustawEdytowaneId(id);
    ustawLadowanieSzczegolow(true);
    ustawBladFormularza('');

    try {
      const dane = await pobierzSzczegolyJednorazowo(id);
      ustawSzczegoly(dane);
      ustawFormularz({
        maszynaId: String(dane.maszynaId),
        iloscPlan: String(dane.iloscPlan),
        iloscWykonana: String(dane.iloscWykonana),
        iloscBrakow: String(dane.iloscBrakow),
        poprzednikId: dane.poprzednikId ? String(dane.poprzednikId) : '',
        planowanyStart: naDateTimeLocal(dane.planowanyStart),
        planowanyStop: naDateTimeLocal(dane.planowanyStop),
        normaSztGodz: String(dane.normaSztGodz ?? 0),
        status: dane.status,
        tagi: dane.tagi.join(', '),
        parametry: dane.parametry ?? '',
        przypisaniPracownicyIds: dane.przypisaniPracownicyIds ?? [],
        aktywne: dane.aktywne,
        maszynaKoncowa: dane.maszynaKoncowa,
        uwagi: dane.uwagi ?? '',
      });
      ustawRoboczyPlanowanyStart(naDateTimeLocal(dane.planowanyStart));
      ustawRoboczyPlanowanyStop(naDateTimeLocal(dane.planowanyStop));
    } catch {
      ustawBladFormularza('Nie udalo sie pobrac szczegolow zlecenia.');
      ustawSzczegoly(null);
      wyczyscRoboczeDatyPlanowania();
    } finally {
      ustawLadowanieSzczegolow(false);
    }
  };

  const zapiszZmiany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!edytowaneId) {
      return;
    }

    ustawZapisywanie(true);
    ustawBladFormularza('');

    try {
      await klientApi.put(`/zlecenia-produkcyjne/${edytowaneId}`, {
        maszynaId: formularz.maszynaId,
        iloscPlan: formularz.iloscPlan,
        iloscWykonana: formularz.iloscWykonana,
        iloscBrakow: formularz.iloscBrakow,
        poprzednikId: formularz.poprzednikId || null,
        planowanyStart: formularz.planowanyStart || null,
        planowanyStop: formularz.planowanyStop || null,
        normaSztGodz: formularz.normaSztGodz,
        status: formularz.status,
        tagi: formularz.tagi
          .split(',')
          .map((element) => element.trim())
          .filter(Boolean),
        parametry: formularz.parametry || null,
        przypisaniPracownicyIds: formularz.przypisaniPracownicyIds,
        aktywne: formularz.aktywne,
        maszynaKoncowa: formularz.maszynaKoncowa,
        uwagi: formularz.uwagi,
      });

      zamknijModalEdycji();
      await odswiezWidok();
    } catch (error: unknown) {
      const wiadomosc =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { wiadomosc?: string } } }).response?.data?.wiadomosc === 'string'
          ? (error as { response?: { data?: { wiadomosc?: string } } }).response?.data?.wiadomosc
          : 'Nie udalo sie zapisac zlecenia produkcyjnego.';

      ustawBladFormularza(wiadomosc ?? 'Nie udalo sie zapisac zlecenia produkcyjnego.');
    } finally {
      ustawZapisywanie(false);
    }
  };

  const zaktualizujNaPodstawieSzczegolow = async (
    id: number,
    modyfikator: (dane: SzczegolyZlecenia) => Record<string, unknown>,
    bladOperacji: string
  ) => {
    ustawOperacjaId(id);
    ustawBlad('');

    try {
      const dane = await pobierzSzczegolyJednorazowo(id);

      await klientApi.put(`/zlecenia-produkcyjne/${id}`, {
        maszynaId: String(dane.maszynaId),
        iloscPlan: String(dane.iloscPlan),
        iloscWykonana: String(dane.iloscWykonana),
        iloscBrakow: String(dane.iloscBrakow),
        poprzednikId: dane.poprzednikId ? String(dane.poprzednikId) : null,
        planowanyStart: dane.planowanyStart,
        planowanyStop: dane.planowanyStop,
        normaSztGodz: String(dane.normaSztGodz ?? 0),
        status: dane.status,
        tagi: dane.tagi,
        parametry: dane.parametry ?? null,
        przypisaniPracownicyIds: dane.przypisaniPracownicyIds ?? [],
        aktywne: dane.aktywne,
        maszynaKoncowa: dane.maszynaKoncowa,
        uwagi: dane.uwagi ?? '',
        ...modyfikator(dane),
      });

      await odswiezWidok();
      return true;
    } catch {
      ustawBlad(bladOperacji);
      return false;
    } finally {
      ustawOperacjaId(null);
    }
  };

  const duplikujZlecenie = async (id: number) => {
    ustawOperacjaId(id);
    ustawBlad('');

    try {
      const dane = await pobierzSzczegolyJednorazowo(id);

      await klientApi.post('/zlecenia-produkcyjne', {
        zamowienieId: String(dane.zamowienieId),
        maszynaId: String(dane.maszynaId),
        iloscPlan: String(dane.iloscPlan),
        normaSztGodz: String(dane.normaSztGodz ?? 0),
        status: dane.status,
      });

      await odswiezWidok();
    } catch {
      ustawBlad('Nie udalo sie zduplikowac zlecenia produkcyjnego.');
    } finally {
      ustawOperacjaId(null);
    }
  };

  const usunZlecenie = async (id: number, numer: string) => {
    if (!window.confirm(`Czy na pewno chcesz usunac zlecenie ${numer}?`)) {
      return;
    }

    ustawOperacjaId(id);
    ustawBlad('');

    try {
      await klientApi.delete(`/zlecenia-produkcyjne/${id}`);
      ustawWybraneDoPlanowaniaIds((poprzednie) => poprzednie.filter((elementId) => elementId !== id));
      ustawZaznaczoneIds((poprzednie) => poprzednie.filter((elementId) => elementId !== id));
      await odswiezWidok();
    } catch {
      ustawBlad('Nie udalo sie usunac zlecenia produkcyjnego.');
    } finally {
      ustawOperacjaId(null);
    }
  };

  const przesunWiersz = (id: number, typ: 'gora' | 'dol' | 'koniec') => {
    ustawKolejnoscIds((poprzednie) => {
      const indeks = poprzednie.indexOf(id);
      if (indeks === -1) {
        return poprzednie;
      }

      if (typ === 'gora') {
        if (indeks === 0) {
          return poprzednie;
        }

        const kopia = [...poprzednie];
        [kopia[indeks - 1], kopia[indeks]] = [kopia[indeks], kopia[indeks - 1]];
        return kopia;
      }

      if (typ === 'dol') {
        if (indeks === poprzednie.length - 1) {
          return poprzednie;
        }

        const kopia = [...poprzednie];
        [kopia[indeks], kopia[indeks + 1]] = [kopia[indeks + 1], kopia[indeks]];
        return kopia;
      }

      const bezBiezacego = poprzednie.filter((elementId) => elementId !== id);
      return [...bezBiezacego, id];
    });
  };

  const eksportujCsv = () => {
    const wiersze = widoczneZlecenia.map((wiersz) => ({
      Status: pobierzTekstStatusu(wiersz.status),
      'Nr zlecenia': wiersz.numer,
      'ID Prodio': wiersz.idProdio,
      'Zew. nr zamowienia': wiersz.zewnetrznyNumer ?? '',
      Klient: wiersz.klient?.nazwa ?? '',
      Produkt: wiersz.produkt?.nazwa ?? '',
    }));

    const arkusz = XLSX.utils.json_to_sheet(wiersze);
    const csv = XLSX.utils.sheet_to_csv(arkusz);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zlecenia-produkcyjne.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const eksportujXlsx = () => {
    const wiersze = widoczneZlecenia.map((wiersz) => ({
      Status: pobierzTekstStatusu(wiersz.status),
      'Nr zlecenia': wiersz.numer,
      'ID Prodio': wiersz.idProdio,
      'Zew. nr zamowienia': wiersz.zewnetrznyNumer ?? '',
      Klient: wiersz.klient?.nazwa ?? '',
      Produkt: wiersz.produkt?.nazwa ?? '',
    }));

    const arkusz = XLSX.utils.json_to_sheet(wiersze);
    const skoroszyt = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(skoroszyt, arkusz, 'Zlecenia');
    XLSX.writeFile(skoroszyt, 'zlecenia-produkcyjne.xlsx');
  };

  useEffect(() => {
    if (czyWidokPlanowaniaZamowienia) {
      return;
    }

    void pobierzListe();
  }, [strona, iloscNaStrone, pokazNieaktywne, ukryjGotowe, kluczSortowania, kierunekSortowania, czyWidokPlanowaniaZamowienia]);

  useEffect(() => {
    void pobierzMaszyny();
  }, []);

  useEffect(() => {
    void pobierzPracownikow();
  }, []);

  useEffect(() => {
    if (!czyWidokPlanowaniaZamowienia) {
      ustawZamowieniePlanowania(null);
      ustawBladPlanowania('');
      return;
    }

    void pobierzZamowieniePlanowania();
  }, [czyWidokPlanowaniaZamowienia, zamowienieIdParam]);

  useEffect(() => {
    if (!czyWidokPlanowaniaZamowienia || !zamowieniePlanowania || inicjalizacjaPlanowania) {
      return;
    }

    if (zamowieniePlanowania.zlecenia.length > 0) {
      inicjalizowaneZamowieniaRef.current.add(zamowieniePlanowania.id);
      return;
    }

    if (inicjalizowaneZamowieniaRef.current.has(zamowieniePlanowania.id)) {
      return;
    }

    inicjalizowaneZamowieniaRef.current.add(zamowieniePlanowania.id);

    void (async () => {
      const utworzono = await utworzOperacjeDlaZamowienia(zamowieniePlanowania);
      if (utworzono) {
        await pobierzZamowieniePlanowania();
        return;
      }

      inicjalizowaneZamowieniaRef.current.delete(zamowieniePlanowania.id);
    })();
  }, [czyWidokPlanowaniaZamowienia, inicjalizacjaPlanowania, zamowieniePlanowania]);

  useEffect(() => {
    if (czyWidokPlanowaniaZamowienia || ladowanie) {
      return;
    }

    if (!Number.isFinite(zlecenieDoOtwarciaParam) || zlecenieDoOtwarciaParam <= 0) {
      otwarteZParametruRef.current = null;
      return;
    }

    if (otwarteZParametruRef.current === zlecenieDoOtwarciaParam) {
      return;
    }

    otwarteZParametruRef.current = zlecenieDoOtwarciaParam;
    void otworzEdycje(zlecenieDoOtwarciaParam);
  }, [czyWidokPlanowaniaZamowienia, ladowanie, zlecenieDoOtwarciaParam]);

  useEffect(() => {
    const obsluzKlik = (event: MouseEvent) => {
      if (!refPlanowania.current?.contains(event.target as Node)) {
        ustawOtwarteWynikiPlanowania(false);
      }
    };

    document.addEventListener('mousedown', obsluzKlik);
    return () => document.removeEventListener('mousedown', obsluzKlik);
  }, []);

  const elementyMenu = (wiersz: ZlecenieLista): ElementMenuAkcji[] => [
    {
      etykieta: 'Drukuj zamowienie',
      ikona: <Printer className='h-4 w-4 text-akcent' />,
      akcja: () => window.print(),
    },
    {
      etykieta: 'Drukuj karte paletowa',
      ikona: <Printer className='h-4 w-4 text-akcent' />,
      akcja: () => window.print(),
    },
    {
      etykieta: 'Drukuj etykiete',
      ikona: <Printer className='h-4 w-4 text-akcent' />,
      akcja: () => window.print(),
    },
    {
      etykieta: 'Drukuj zlecenie',
      ikona: <Printer className='h-4 w-4 text-akcent' />,
      akcja: () => window.print(),
    },
    {
      etykieta: 'Edytuj',
      ikona: <Pencil className='h-4 w-4 text-akcent' />,
      akcja: () => void otworzEdycje(wiersz.id),
    },
    {
      etykieta: 'Przesun na gore kolejki',
      ikona: <ArrowUp className='h-4 w-4 text-akcent' />,
      akcja: () => przesunWiersz(wiersz.id, 'gora'),
    },
    {
      etykieta: 'Przesun na koniec kolejki',
      ikona: <ArrowDownToLine className='h-4 w-4 text-akcent' />,
      akcja: () => przesunWiersz(wiersz.id, 'koniec'),
    },
    {
      etykieta: 'Duplikuj',
      ikona: <Copy className='h-4 w-4 text-akcent' />,
      akcja: () => void duplikujZlecenie(wiersz.id),
      wylaczone: operacjaId === wiersz.id,
    },
    {
      etykieta: wiersz.aktywne ? 'Dezaktywuj' : 'Aktywuj',
      ikona: wiersz.aktywne ? (
        <EyeOff className='h-4 w-4 text-red-500' />
      ) : (
        <Eye className='h-4 w-4 text-emerald-500' />
      ),
      akcja: () =>
        void zaktualizujNaPodstawieSzczegolow(
          wiersz.id,
          () => ({ aktywne: !wiersz.aktywne }),
          wiersz.aktywne
            ? 'Nie udalo sie dezaktywowac zlecenia produkcyjnego.'
            : 'Nie udalo sie aktywowac zlecenia produkcyjnego.'
        ),
      niebezpieczna: wiersz.aktywne,
      wylaczone: operacjaId === wiersz.id,
    },
    {
      etykieta: 'Zakoncz',
      ikona: <Power className='h-4 w-4 text-red-500' />,
      akcja: () =>
        void zaktualizujNaPodstawieSzczegolow(
          wiersz.id,
          () => ({ status: 'GOTOWE' }),
          'Nie udalo sie zakonczyc zlecenia produkcyjnego.'
        ),
      niebezpieczna: true,
      wylaczone: operacjaId === wiersz.id || wiersz.status === 'GOTOWE',
    },
    {
      etykieta: 'Usun',
      ikona: <Trash2 className='h-4 w-4 text-red-500' />,
      akcja: () => void usunZlecenie(wiersz.id, wiersz.numer),
      niebezpieczna: true,
      wylaczone: operacjaId === wiersz.id,
    },
    {
      etykieta: 'Otworz w nowej karcie',
      ikona: <ExternalLink className='h-4 w-4 text-akcent' />,
      akcja: () => window.open(`${window.location.origin}/zlecenia-produkcyjne/${wiersz.id}`, '_blank', 'noopener,noreferrer'),
    },
  ];

  if (czyWidokPlanowaniaZamowienia) {
    const liczbaPozycji =
      zamowieniePlanowania?.pozycje.reduce((suma, pozycja) => suma + (pozycja.ilosc || 0), 0) ?? 0;
    const etykietaZamowienia =
      zamowieniePlanowania?.zewnetrznyNumer || zamowieniePlanowania?.idProdio || `Zamowienie ${zamowienieIdParam}`;
    const klientEtykieta = zamowieniePlanowania?.klient?.nazwa || 'Brak klienta';
    const klasaStatusu = pobierzKlaseStatusuPlanowania(zamowieniePlanowania?.status || 'NOWE');

    return (
      <>
        <div className='min-h-full overflow-hidden rounded-[28px] border border-obramowanie bg-tlo-karta text-tekst-glowny shadow-xl shadow-black/10'>
          <section className='border-b border-obramowanie bg-tlo-karta px-6 py-5'>
            <div className='flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between'>
              <div className='flex flex-wrap items-center gap-4'>
                <div className='flex items-center gap-4'>
                  <h1 className='text-[24px] font-semibold tracking-tight text-tekst-glowny'>Planowanie zamowienia</h1>
                  <button
                    type='button'
                    className='inline-flex h-9 w-9 items-center justify-center rounded-full border border-obramowanie bg-tlo-glowne text-tekst-drugorzedny transition hover:border-akcent hover:text-akcent'
                    aria-label='Pomoc'
                  >
                    <CircleDot className='h-4 w-4' />
                  </button>
                </div>
                <div className='flex flex-wrap items-center gap-2 text-[15px]'>
                  <span className='inline-flex items-center gap-2 text-akcent'>
                    <CalendarDays className='h-4 w-4' />
                    <span className='border-b border-dashed border-akcent/40 font-semibold text-akcent'>
                      {etykietaZamowienia}
                    </span>
                  </span>
                  <span className='font-medium text-tekst-glowny'>(0/{formatujLiczbe(liczbaPozycji)})</span>
                </div>
              </div>

              <div className='flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-tekst-drugorzedny'>
                <div className='inline-flex items-center gap-2'>
                  <UserRound className='h-4 w-4 text-akcent' />
                  <span>{klientEtykieta}</span>
                </div>
                <div className='inline-flex items-center gap-2'>
                  <FolderOpen className='h-4 w-4 text-akcent' />
                  <span className='max-w-[190px] truncate'>{zamowieniePlanowania?.pozycje[0]?.produkt?.nazwa || '-'}</span>
                </div>
                <div className='inline-flex items-center gap-2'>
                  <CalendarDays className='h-4 w-4 text-akcent' />
                  <span>{formatujDatePlanowania(zamowieniePlanowania?.oczekiwanaData ?? null)}</span>
                </div>
                <span className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide ${klasaStatusu}`}>
                  {zamowieniePlanowania?.status || 'NOWE'}
                </span>
                <button
                  type='button'
                  onClick={() => navigate('/zamowienia')}
                  className='inline-flex h-9 w-9 items-center justify-center rounded-full text-tekst-drugorzedny transition hover:bg-tlo-glowne hover:text-akcent'
                  aria-label='Zamknij planowanie'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>
            </div>
          </section>

          {bladPlanowania ? (
            <div className='border-b border-red-500/30 bg-red-500/10 px-6 py-4 text-sm text-red-300'>{bladPlanowania}</div>
          ) : null}

          <section className='overflow-x-auto bg-tlo-karta'>
            <table className='min-w-[1960px] w-full border-collapse text-sm'>
              <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                <tr>
                  <th className='w-14 border-b border-r border-obramowanie px-3 py-3 text-center font-semibold'>#</th>
                  <th className='w-12 border-b border-r border-obramowanie px-2 py-3 text-center font-semibold'>
                    <ArrowUp className='mx-auto h-4 w-4' />
                  </th>
                  <th className='min-w-[320px] border-b border-r border-obramowanie px-4 py-3 text-left font-semibold'>Maszyna/Operacja</th>
                  <th className='min-w-[190px] border-b border-r border-obramowanie px-4 py-3 text-center font-semibold'>Planowany start</th>
                  <th className='min-w-[190px] border-b border-r border-obramowanie px-4 py-3 text-center font-semibold'>Planowany stop</th>
                  <th className='min-w-[180px] border-b border-r border-obramowanie px-4 py-3 text-center font-semibold'>Ilosc</th>
                  <th className='min-w-[120px] border-b border-r border-obramowanie px-4 py-3 text-center font-semibold'>Kolejnosc w maszynie</th>
                  <th className='min-w-[160px] border-b border-r border-obramowanie px-4 py-3 text-center font-semibold'>Tagi</th>
                  <th className='min-w-[170px] border-b border-r border-obramowanie px-4 py-3 text-center font-semibold'>Pracownicy</th>
                  <th className='min-w-[120px] border-b border-r border-obramowanie px-4 py-3 text-center font-semibold'>Normatywny czas</th>
                  <th className='min-w-[170px] border-b border-r border-obramowanie px-4 py-3 text-center font-semibold'>Parametry operacji</th>
                  <th className='min-w-[150px] border-b border-r border-obramowanie px-4 py-3 text-center font-semibold'>Uwagi</th>
                  <th className='min-w-[210px] border-b border-r border-obramowanie px-4 py-3 text-center font-semibold'>Poprzednik operacji</th>
                  <th className='min-w-[190px] border-b border-r border-obramowanie px-4 py-3 text-center font-semibold'>Typ operacji</th>
                  <th className='min-w-[110px] border-b border-r border-obramowanie px-4 py-3 text-center font-semibold'>Maszyna koncowa</th>
                  <th className='min-w-[110px] border-b border-obramowanie px-4 py-3 text-center font-semibold'>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {ladowaniePlanowania || inicjalizacjaPlanowania ? (
                  Array.from({ length: 2 }, (_, indeks) => (
                    <tr key={`planowanie-skeleton-${indeks}`} className='odd:bg-tlo-karta even:bg-tlo-glowne/30'>
                      {Array.from({ length: 16 }, (__, kolumna) => (
                        <td key={kolumna} className='border-b border-r border-obramowanie px-4 py-5 last:border-r-0'>
                          <div className='h-10 animate-pulse rounded-md bg-obramowanie' />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !zamowieniePlanowania || zamowieniePlanowania.zlecenia.length === 0 ? (
                  <tr>
                    <td colSpan={16} className='px-6 py-16 text-center text-tekst-drugorzedny'>
                      To zamowienie nie ma jeszcze dodanych operacji do planowania.
                    </td>
                  </tr>
                ) : (
                  uporzadkowaneZleceniaPlanowania.map((zlecenie, indeks) => (
                    <tr key={zlecenie.id} className='align-top odd:bg-tlo-karta even:bg-tlo-glowne/30 hover:bg-akcent/5'>
                      <td className='border-b border-r border-obramowanie px-3 py-3 text-center align-middle text-tekst-glowny'>{indeks + 1}</td>
                      <td className='border-b border-r border-obramowanie px-2 py-3 align-middle text-center text-akcent'>
                        <GripVertical className='mx-auto h-4 w-4' />
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle'>
                        <button
                          type='button'
                          onClick={() => void otworzEdycje(zlecenie.id)}
                          className='flex h-[52px] w-full items-center justify-between rounded-[6px] border border-obramowanie bg-tlo-glowne px-3 py-2 text-left transition hover:border-akcent'
                        >
                          <div>
                            <div className='font-semibold text-tekst-glowny'>{zlecenie.maszyna?.nazwa || `Operacja ${indeks + 1}`}</div>
                            <div className='mt-0.5 text-xs text-tekst-drugorzedny'>{zlecenie.numer}</div>
                          </div>
                          <div className='flex items-center gap-2 text-tekst-drugorzedny'>
                            <CircleDot className='h-3.5 w-3.5' />
                            <Pencil className='h-3.5 w-3.5' />
                          </div>
                        </button>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle'>
                        <KartaWyboruTerminu
                          etykieta='Start operacji'
                          wartosc={roboczeTerminyPlanowania[zlecenie.id]?.planowanyStart ?? ''}
                          onZmiana={(wartosc) =>
                            ustawRoboczeTerminyPlanowania((poprzednie) => ({
                              ...poprzednie,
                              [zlecenie.id]: {
                                planowanyStart: wartosc,
                                planowanyStop:
                                  poprzednie[zlecenie.id]?.planowanyStop ?? naDateTimeLocal(zlecenie.planowanyStop),
                              },
                            }))
                          }
                          onZapisz={() => void zapiszTerminPlanowania(zlecenie.id, 'planowanyStart')}
                          disabled={operacjaId === zlecenie.id}
                          ariaLabelZapisu={`Zapisz planowany start dla ${zlecenie.numer}`}
                        />
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle'>
                        <KartaWyboruTerminu
                          etykieta='Stop operacji'
                          wartosc={roboczeTerminyPlanowania[zlecenie.id]?.planowanyStop ?? ''}
                          onZmiana={(wartosc) =>
                            ustawRoboczeTerminyPlanowania((poprzednie) => ({
                              ...poprzednie,
                              [zlecenie.id]: {
                                planowanyStart:
                                  poprzednie[zlecenie.id]?.planowanyStart ?? naDateTimeLocal(zlecenie.planowanyStart),
                                planowanyStop: wartosc,
                              },
                            }))
                          }
                          onZapisz={() => void zapiszTerminPlanowania(zlecenie.id, 'planowanyStop')}
                          disabled={operacjaId === zlecenie.id}
                          ariaLabelZapisu={`Zapisz planowany stop dla ${zlecenie.numer}`}
                        />
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle'>
                        <div className='min-w-[148px] space-y-2 rounded-[10px] border border-obramowanie bg-tlo-glowne p-3'>
                          <div className='flex h-[48px] items-center rounded-[8px] border border-obramowanie bg-tlo-karta px-3'>
                            <input
                              type='number'
                              min='0'
                              step='1'
                              value={roboczeIlosciPlanowania[zlecenie.id] ?? String(zlecenie.iloscPlan)}
                              onChange={(event) =>
                                ustawRoboczeIlosciPlanowania((poprzednie) => ({
                                  ...poprzednie,
                                  [zlecenie.id]: event.target.value,
                                }))
                              }
                              className='w-full bg-transparent text-base font-semibold text-tekst-glowny outline-none'
                              aria-label={`Ilosc planowana dla ${zlecenie.numer}`}
                            />
                          </div>
                          <button
                            type='button'
                            onClick={() => void zapiszIloscPlanowania(zlecenie.id)}
                            disabled={operacjaId === zlecenie.id}
                            className='inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-akcent/30 bg-akcent/10 text-sm font-semibold text-akcent transition hover:bg-akcent/20 disabled:cursor-not-allowed disabled:border-obramowanie disabled:bg-tlo-glowne disabled:text-tekst-drugorzedny'
                            aria-label={`Zapisz ilosc planowana dla ${zlecenie.numer}`}
                          >
                            <Check className='h-4 w-4' />
                            Zapisz ilosc
                          </button>
                        </div>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle'>
                        <div className='space-y-2 rounded-[10px] border border-obramowanie bg-tlo-glowne p-3 text-center'>
                          <div className='text-xs font-semibold uppercase tracking-[0.16em] text-tekst-drugorzedny'>
                            Pozycja {indeks + 1}
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <button
                              type='button'
                              onClick={() => przesunWiersz(zlecenie.id, 'gora')}
                              disabled={indeks === 0}
                              className='inline-flex h-9 items-center justify-center rounded-[8px] border border-obramowanie bg-tlo-karta px-3 text-lg font-bold leading-none text-akcent transition hover:border-akcent hover:bg-akcent/10 disabled:cursor-not-allowed disabled:text-tekst-drugorzedny disabled:hover:border-obramowanie disabled:hover:bg-tlo-karta'
                              aria-label={`Przesun ${zlecenie.numer} w gore`}
                            >
                              <span aria-hidden='true'>↑</span>
                            </button>
                            <button
                              type='button'
                              onClick={() => przesunWiersz(zlecenie.id, 'dol')}
                              disabled={indeks === uporzadkowaneZleceniaPlanowania.length - 1}
                              className='inline-flex h-9 items-center justify-center rounded-[8px] border border-obramowanie bg-tlo-karta px-3 text-lg font-bold leading-none text-akcent transition hover:border-akcent hover:bg-akcent/10 disabled:cursor-not-allowed disabled:text-tekst-drugorzedny disabled:hover:border-obramowanie disabled:hover:bg-tlo-karta'
                              aria-label={`Przesun ${zlecenie.numer} w dol`}
                            >
                              <span aria-hidden='true'>↓</span>
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle'>
                        <div className='flex items-center gap-2'>
                          <div className='flex min-h-[52px] flex-1 items-center rounded-[6px] border border-obramowanie bg-tlo-glowne px-3 py-2'>
                            <input
                              type='text'
                              value={roboczeTagiPlanowania[zlecenie.id] ?? zlecenie.tagi.join(', ')}
                              onChange={(event) =>
                                ustawRoboczeTagiPlanowania((poprzednie) => ({
                                  ...poprzednie,
                                  [zlecenie.id]: event.target.value,
                                }))
                              }
                              placeholder='np. pilne, do zrobienia'
                              className='w-full bg-transparent text-sm text-tekst-glowny outline-none placeholder:text-tekst-drugorzedny'
                              aria-label={`Tagi dla ${zlecenie.numer}`}
                            />
                          </div>
                          <button
                            type='button'
                            onClick={() => void zapiszTagiPlanowania(zlecenie.id)}
                            disabled={operacjaId === zlecenie.id}
                            className='inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-akcent/30 bg-akcent/10 text-akcent transition hover:bg-akcent/20 disabled:cursor-not-allowed disabled:border-obramowanie disabled:bg-tlo-glowne disabled:text-tekst-drugorzedny'
                            aria-label={`Zapisz tagi dla ${zlecenie.numer}`}
                          >
                            <Check className='h-4 w-4' />
                          </button>
                        </div>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle'>
                        <div className='space-y-2 rounded-[10px] border border-obramowanie bg-tlo-glowne p-3'>
                          <div className='flex flex-wrap gap-2'>
                            {(roboczyPracownicyPlanowania[zlecenie.id] ?? zlecenie.przypisaniPracownicyIds).length > 0 ? (
                              (roboczyPracownicyPlanowania[zlecenie.id] ?? zlecenie.przypisaniPracownicyIds).map((pracownikId) => {
                                const pracownik = mapaPracownikow.get(pracownikId);

                                return (
                                  <span
                                    key={pracownikId}
                                    className='inline-flex items-center rounded-full border border-akcent/20 bg-akcent/10 px-2.5 py-1 text-xs font-medium text-tekst-glowny'
                                  >
                                    {pobierzNazwePracownika(pracownik, pracownikId)}
                                  </span>
                                );
                              })
                            ) : (
                              <span className='text-sm text-tekst-drugorzedny'>Brak przypisanych</span>
                            )}
                          </div>

                          <div className='flex items-center gap-2'>
                            <button
                              type='button'
                              onClick={() => {
                                ustawOtwartePrzypisaniePracownikowId((poprzednie) =>
                                  poprzednie === zlecenie.id ? null : zlecenie.id
                                );
                                ustawSzukajPracownikaPlanowania('');
                              }}
                              className='inline-flex h-9 flex-1 items-center justify-between rounded-[8px] border border-obramowanie bg-tlo-karta px-3 text-sm text-tekst-glowny transition hover:border-akcent'
                            >
                              <span>
                                {(roboczyPracownicyPlanowania[zlecenie.id] ?? zlecenie.przypisaniPracownicyIds).length > 0
                                  ? 'Edytuj przypisanie'
                                  : 'Dodaj pracownikow'}
                              </span>
                              <ArrowDownToLine className='h-3.5 w-3.5 rotate-90 text-tekst-drugorzedny' />
                            </button>
                          </div>

                          {otwartePrzypisaniePracownikowId === zlecenie.id ? (
                            <div className='space-y-2 rounded-[8px] border border-obramowanie bg-tlo-karta p-2'>
                              <div className='relative'>
                                <Search className='pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tekst-drugorzedny' />
                                <input
                                  type='text'
                                  value={szukajPracownikaPlanowania}
                                  onChange={(event) => ustawSzukajPracownikaPlanowania(event.target.value)}
                                  placeholder='Szukaj pracownika'
                                  className='h-9 w-full rounded-[8px] border border-obramowanie bg-tlo-glowne pl-9 pr-3 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                                />
                              </div>

                              <div className='max-h-52 space-y-1 overflow-y-auto pr-1'>
                                {przefiltrowaniPracownicyPlanowania.map((pracownik) => {
                                  const wybrani = roboczyPracownicyPlanowania[zlecenie.id] ?? zlecenie.przypisaniPracownicyIds;
                                  const zaznaczony = wybrani.includes(pracownik.id);

                                  return (
                                    <button
                                      key={pracownik.id}
                                      type='button'
                                      onClick={() =>
                                        ustawRoboczyPracownicyPlanowania((poprzednie) => {
                                          const aktualni = poprzednie[zlecenie.id] ?? zlecenie.przypisaniPracownicyIds;
                                          const kolejni = aktualni.includes(pracownik.id)
                                            ? aktualni.filter((id) => id !== pracownik.id)
                                            : [...aktualni, pracownik.id];

                                          return {
                                            ...poprzednie,
                                            [zlecenie.id]: kolejni,
                                          };
                                        })
                                      }
                                      className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-sm transition ${
                                        zaznaczony ? 'bg-akcent/10 text-tekst-glowny' : 'text-tekst-glowny hover:bg-tlo-glowne'
                                      }`}
                                    >
                                      <span className='pr-3'>
                                        {pobierzNazwePracownika(pracownik)}
                                        {pracownik.stanowisko ? (
                                          <span className='ml-2 text-xs text-tekst-drugorzedny'>{pracownik.stanowisko}</span>
                                        ) : null}
                                      </span>
                                      <span
                                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                                          zaznaczony ? 'border-akcent bg-akcent text-white' : 'border-obramowanie text-transparent'
                                        }`}
                                      >
                                        <Check className='h-3 w-3' />
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className='flex gap-2'>
                                <button
                                  type='button'
                                  onClick={() => {
                                    ustawOtwartePrzypisaniePracownikowId(null);
                                    ustawSzukajPracownikaPlanowania('');
                                  }}
                                  className='inline-flex h-9 flex-1 items-center justify-center rounded-[8px] border border-obramowanie bg-tlo-glowne px-3 text-sm font-medium text-tekst-glowny transition hover:border-akcent'
                                >
                                  Zamknij
                                </button>
                                <button
                                  type='button'
                                  onClick={() => void zapiszPracownikowPlanowania(zlecenie.id)}
                                  disabled={operacjaId === zlecenie.id}
                                  className='inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-[8px] border border-akcent/30 bg-akcent/10 px-3 text-sm font-semibold text-akcent transition hover:bg-akcent/20 disabled:cursor-not-allowed disabled:border-obramowanie disabled:bg-tlo-glowne disabled:text-tekst-drugorzedny'
                                >
                                  <Check className='h-4 w-4' />
                                  Zapisz
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle text-center'>
                        <div className='inline-flex items-center gap-2 text-tekst-glowny'>
                          <span>{formatujNormatywnyCzas(zlecenie.iloscPlan, zlecenie.normaSztGodz)}</span>
                        </div>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle text-center'>
                        <div className='space-y-2 rounded-[10px] border border-obramowanie bg-tlo-glowne p-3'>
                          <textarea
                            value={roboczeParametryPlanowania[zlecenie.id] ?? zlecenie.parametry ?? ''}
                            onChange={(event) =>
                              ustawRoboczeParametryPlanowania((poprzednie) => ({
                                ...poprzednie,
                                [zlecenie.id]: event.target.value,
                              }))
                            }
                            rows={3}
                            placeholder='Wpisz parametry operacji'
                            className='w-full resize-y rounded-[8px] border border-obramowanie bg-tlo-karta px-3 py-2 text-sm text-tekst-glowny outline-none transition focus:border-akcent placeholder:text-tekst-drugorzedny'
                            aria-label={`Parametry operacji ${zlecenie.numer}`}
                          />
                          <button
                            type='button'
                            onClick={() => void zapiszParametryPlanowania(zlecenie.id)}
                            disabled={operacjaId === zlecenie.id}
                            className='inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-akcent/30 bg-akcent/10 px-3 text-sm font-semibold text-akcent transition hover:bg-akcent/20 disabled:cursor-not-allowed disabled:border-obramowanie disabled:bg-tlo-glowne disabled:text-tekst-drugorzedny'
                            aria-label={`Zapisz parametry operacji ${zlecenie.numer}`}
                          >
                            <Check className='h-4 w-4' />
                            Zapisz parametry
                          </button>
                        </div>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle'>
                        <button
                          type='button'
                          onClick={() => void otworzEdycje(zlecenie.id)}
                          className='flex min-h-[52px] w-full items-start justify-between rounded-[8px] border border-obramowanie bg-tlo-glowne px-3 py-2 text-left transition hover:border-akcent'
                          aria-label={`Edytuj uwagi operacji ${zlecenie.numer}`}
                        >
                          <span className='line-clamp-3 pr-3 text-sm text-tekst-glowny'>
                            {zlecenie.uwagi?.trim() ? zlecenie.uwagi : 'Brak uwag'}
                          </span>
                          <Pencil className='mt-0.5 h-4 w-4 shrink-0 text-akcent' />
                        </button>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle'>
                        <div className='flex items-center gap-3'>
                          <div className='flex h-[52px] flex-1 items-center rounded-[6px] border border-obramowanie bg-tlo-glowne px-3 text-tekst-glowny'>
                            {zlecenie.numer && indeks > 0 ? uporzadkowaneZleceniaPlanowania[indeks - 1]?.numer || '-' : '-'}
                          </div>
                          <button
                            type='button'
                            className='text-akcent transition hover:text-akcent-hover'
                            aria-label={`Otworz poprzednik operacji ${zlecenie.numer}`}
                          >
                            <FolderOpen className='h-4 w-4' />
                          </button>
                        </div>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle'>
                        <div className='flex h-[52px] items-center justify-between rounded-[6px] border border-obramowanie bg-tlo-glowne px-3 text-tekst-glowny'>
                          <span className='font-semibold'>Standardowa operacja</span>
                          <div className='flex items-center gap-2 text-tekst-drugorzedny'>
                            <CircleDot className='h-3.5 w-3.5' />
                            <ArrowDownToLine className='h-3.5 w-3.5 rotate-90' />
                          </div>
                        </div>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 align-middle text-center'>
                        <button
                          type='button'
                          onClick={() =>
                            void zaktualizujNaPodstawieSzczegolow(
                              zlecenie.id,
                              () => ({ maszynaKoncowa: !zlecenie.maszynaKoncowa }),
                              'Nie udalo sie zmienic oznaczenia maszyny koncowej.'
                            )
                          }
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                            zlecenie.maszynaKoncowa ? 'bg-akcent' : 'bg-obramowanie'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                              zlecenie.maszynaKoncowa ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className='border-b border-obramowanie px-4 py-3 align-middle'>
                        <MenuAkcji
                          elementy={elementyMenu({
                            id: zlecenie.id,
                            numer: zlecenie.numer,
                            status: zlecenie.status,
                            aktywne: true,
                            iloscPlan: zlecenie.iloscPlan,
                            iloscWykonana: zlecenie.iloscWykonana,
                            maszynaKoncowa: zlecenie.maszynaKoncowa,
                            zamowienieId: zamowieniePlanowania.id,
                            idProdio: zamowieniePlanowania.idProdio,
                            zewnetrznyNumer: zamowieniePlanowania.zewnetrznyNumer,
                            klient: zamowieniePlanowania.klient,
                            produkt: zamowieniePlanowania.pozycje[0]?.produkt
                              ? {
                                  id: zamowieniePlanowania.pozycje[0].produkt!.id,
                                  nazwa: zamowieniePlanowania.pozycje[0].produkt!.nazwa,
                                  grupa: null,
                                  zdjecie: zamowieniePlanowania.pozycje[0].produkt!.zdjecie,
                                }
                              : null,
                            poprzednik:
                              indeks > 0
                                ? {
                                    id: uporzadkowaneZleceniaPlanowania[indeks - 1].id,
                                    numer: uporzadkowaneZleceniaPlanowania[indeks - 1].numer,
                                    status: uporzadkowaneZleceniaPlanowania[indeks - 1].status,
                                    iloscPlan: uporzadkowaneZleceniaPlanowania[indeks - 1].iloscPlan,
                                    iloscWykonana: uporzadkowaneZleceniaPlanowania[indeks - 1].iloscWykonana,
                                    procent:
                                      uporzadkowaneZleceniaPlanowania[indeks - 1].iloscPlan > 0
                                        ? (uporzadkowaneZleceniaPlanowania[indeks - 1].iloscWykonana /
                                            uporzadkowaneZleceniaPlanowania[indeks - 1].iloscPlan) *
                                          100
                                        : 0,
                                  }
                                : null,
                          })}
                          otwarte={otwarteMenuId === zlecenie.id}
                          onToggle={() => ustawOtwarteMenuId((poprzednie) => (poprzednie === zlecenie.id ? null : zlecenie.id))}
                          onClose={() => ustawOtwarteMenuId(null)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className='flex flex-col gap-4 border-t border-obramowanie bg-tlo-karta px-6 py-5 lg:flex-row lg:items-center lg:justify-between'>
            <div className='max-w-3xl text-sm text-tekst-drugorzedny'>
              Podpowiedz: jesli chcesz szybciej dodawac zlecenia, przypisz do produktu maszyny, na jakich sa one wytwarzane.
            </div>
            <div className='flex flex-wrap items-center gap-3'>
              <button
                type='button'
                onClick={() => navigate(`/zamowienia/${zamowienieIdParam}`)}
                className='inline-flex h-11 items-center rounded-full border border-obramowanie bg-tlo-glowne px-5 text-sm font-semibold text-tekst-glowny transition hover:border-akcent hover:text-akcent'
              >
                Szczegoly zamowienia
              </button>
              <button
                type='button'
                onClick={() => void pobierzZamowieniePlanowania()}
                className='inline-flex h-11 items-center rounded-full border border-obramowanie bg-tlo-glowne px-5 text-sm font-semibold text-tekst-glowny transition hover:border-akcent hover:text-akcent'
              >
                Aktualizuj technologie
              </button>
              <button
                type='button'
                onClick={() => navigate('/zamowienia')}
                className='inline-flex h-11 items-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-white transition hover:bg-emerald-600'
              >
                Zapisz zlecenie/a
              </button>
            </div>
          </section>
        </div>

        <Modal
          czyOtwarty={czyModalEdycji}
          onZamknij={() => {
            if (zapisywanie) {
              return;
            }

            zamknijModalEdycji();
            ustawSzczegoly(null);
            ustawBladFormularza('');
            ustawFormularz(domyslnyFormularzEdycji());
          }}
          tytul={edytowaneId ? `Edytuj zlecenie ${edytowaneId}` : 'Edytuj zlecenie'}
          rozmiar='duzy'
          akcje={
            <>
              <Przycisk
                type='button'
                wariant='drugorzedny'
                onClick={zamknijModalEdycji}
                disabled={zapisywanie}
              >
                Zamknij
              </Przycisk>
              <Przycisk type='submit' form='formularz-edycji-zlecenia' czyLaduje={zapisywanie}>
                Zapisz zmiany
              </Przycisk>
            </>
          }
        >
          {ladowanieSzczegolow ? (
            <div className='py-12 text-center text-sm text-tekst-drugorzedny'>Ladowanie szczegolow...</div>
          ) : (
            <form id='formularz-edycji-zlecenia' onSubmit={zapiszZmiany} className='space-y-5'>
              <div className='grid gap-4 md:grid-cols-2'>
                <Rozwijane
                  etykieta='Maszyna'
                  opcje={opcjeMaszyn}
                  wartosc={formularz.maszynaId}
                  onZmiana={(wartosc) => ustawFormularz((poprzedni) => ({ ...poprzedni, maszynaId: String(wartosc) }))}
                  placeholder='Wybierz maszyne'
                />
                <Rozwijane
                  etykieta='Status'
                  opcje={opcjeStatusow}
                  wartosc={formularz.status}
                  onZmiana={(wartosc) =>
                    ustawFormularz((poprzedni) => ({ ...poprzedni, status: wartosc as StatusZlecenia }))
                  }
                />
                <Pole
                  etykieta='Ilosc plan'
                  type='number'
                  min='0'
                  value={formularz.iloscPlan}
                  onChange={(event) => ustawFormularz((poprzedni) => ({ ...poprzedni, iloscPlan: event.target.value }))}
                />
                <Pole
                  etykieta='Ilosc wykonana'
                  type='number'
                  min='0'
                  value={formularz.iloscWykonana}
                  onChange={(event) =>
                    ustawFormularz((poprzedni) => ({ ...poprzedni, iloscWykonana: event.target.value }))
                  }
                />
                <Pole
                  etykieta='Ilosc brakow'
                  type='number'
                  min='0'
                  value={formularz.iloscBrakow}
                  onChange={(event) => ustawFormularz((poprzedni) => ({ ...poprzedni, iloscBrakow: event.target.value }))}
                />
                <Rozwijane
                  etykieta='Poprzednik'
                  opcje={(szczegoly?.kandydaciPoprzednika ?? []).map((kandydat) => ({
                    wartosc: String(kandydat.id),
                    etykieta: `${kandydat.numer} (${formatujLiczbe(kandydat.iloscWykonana)}/${formatujLiczbe(kandydat.iloscPlan)})`,
                  }))}
                  wartosc={formularz.poprzednikId}
                  onZmiana={(wartosc) => ustawFormularz((poprzedni) => ({ ...poprzedni, poprzednikId: String(wartosc) }))}
                  placeholder='Bez poprzednika'
                />
                <PoleDatyZPotwierdzeniem
                  etykieta='Planowany start'
                  roboczaWartosc={roboczyPlanowanyStart}
                  zatwierdzonaWartosc={formularz.planowanyStart}
                  onZmianaRobocza={ustawRoboczyPlanowanyStart}
                  onZatwierdz={() =>
                    ustawFormularz((poprzedni) => ({ ...poprzedni, planowanyStart: roboczyPlanowanyStart }))
                  }
                />
                <PoleDatyZPotwierdzeniem
                  etykieta='Planowany stop'
                  roboczaWartosc={roboczyPlanowanyStop}
                  zatwierdzonaWartosc={formularz.planowanyStop}
                  onZmianaRobocza={ustawRoboczyPlanowanyStop}
                  onZatwierdz={() =>
                    ustawFormularz((poprzedni) => ({ ...poprzedni, planowanyStop: roboczyPlanowanyStop }))
                  }
                />
                <Pole
                  etykieta='Norma szt./godz.'
                  value={formularz.normaSztGodz}
                  onChange={(event) => ustawFormularz((poprzedni) => ({ ...poprzedni, normaSztGodz: event.target.value }))}
                />
                <Pole
                  etykieta='Tagi (po przecinku)'
                  value={formularz.tagi}
                  onChange={(event) => ustawFormularz((poprzedni) => ({ ...poprzedni, tagi: event.target.value }))}
                />
                <Pole
                  etykieta='Parametry operacji'
                  value={formularz.parametry}
                  onChange={(event) => ustawFormularz((poprzedni) => ({ ...poprzedni, parametry: event.target.value }))}
                />
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                <Przelacznik
                  wartosc={formularz.aktywne}
                  onZmiana={(wartosc) => ustawFormularz((poprzedni) => ({ ...poprzedni, aktywne: wartosc }))}
                  etykieta='Aktywne'
                />
                <Przelacznik
                  wartosc={formularz.maszynaKoncowa}
                  onZmiana={(wartosc) => ustawFormularz((poprzedni) => ({ ...poprzedni, maszynaKoncowa: wartosc }))}
                  etykieta='Maszyna koncowa'
                />
              </div>

              <Pole
                etykieta='Uwagi'
                value={formularz.uwagi}
                onChange={(event) => ustawFormularz((poprzedni) => ({ ...poprzedni, uwagi: event.target.value }))}
              />

              {bladFormularza ? (
                <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600'>
                  {bladFormularza}
                </div>
              ) : null}
            </form>
          )}
        </Modal>
      </>
    );
  }

  return (
    <div className='space-y-6'>
      <section className='rounded-[28px] border border-obramowanie bg-tlo-karta px-5 py-6 shadow-xl shadow-black/10'>
        <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex items-center gap-4'>
            <h1 className='text-3xl font-semibold text-tekst-glowny'>Zlecenia produkcyjne</h1>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <button
              type='button'
              className='inline-flex h-12 items-center gap-2 rounded-full bg-tlo-naglowek px-5 text-sm font-semibold text-white transition hover:bg-obramowanie'
            >
              <ListChecks className='h-4 w-4' />
              ETAPY
            </button>
            <button
              type='button'
              onClick={() => ustawPokazPanelPlanowania((poprzedni) => !poprzedni)}
              className='inline-flex h-12 items-center gap-2 rounded-full bg-akcent px-5 text-sm font-semibold text-white transition hover:bg-akcent-hover'
            >
              <Plus className='h-4 w-4' />
              {pokazPanelPlanowania ? 'LISTA' : 'DODAJ'}
            </button>
            <button
              type='button'
              onClick={() => ustawPokazFiltry((poprzedni) => !poprzedni)}
              className='inline-flex h-12 items-center gap-2 rounded-full border border-obramowanie bg-tlo-karta px-5 text-sm font-semibold text-tekst-glowny transition hover:border-akcent'
            >
              <Settings2 className='h-4 w-4' />
              DOSTOSUJ
            </button>
          </div>
        </div>
      </section>

      {!pokazPanelPlanowania ? (
      <section className='overflow-hidden rounded-[28px] border border-obramowanie bg-tlo-karta shadow-xl shadow-black/10'>
        <div className='flex flex-col gap-4 border-b border-obramowanie px-4 py-6 xl:flex-row xl:items-center xl:justify-between'>
          <div className='flex items-center gap-3 text-sm text-tekst-drugorzedny'>
            <span>Eksport:</span>
            <button type='button' onClick={eksportujCsv} className='font-semibold text-tekst-glowny hover:text-akcent'>
              CSV
            </button>
            <button type='button' onClick={eksportujXlsx} className='font-semibold text-tekst-glowny hover:text-akcent'>
              XLSX
            </button>
          </div>

          <div className='flex flex-wrap items-center gap-5 text-sm'>
            <Przelacznik wartosc={pokazNieaktywne} onZmiana={ustawPokazNieaktywne} etykieta='Wyswietl nieaktywne' />
            <Przelacznik wartosc={ukryjGotowe} onZmiana={ustawUkryjGotowe} etykieta='Ukryj gotowe' />
            <div className='text-tekst-drugorzedny'>
              Elementow na stronie: <span className='font-semibold text-tekst-glowny'>{iloscNaStrone}</span>
            </div>
            <div className='text-tekst-drugorzedny'>
              {zakresOd}-{zakresDo} z {lacznie}
            </div>
          </div>
        </div>

        {blad ? (
          <div className='border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600'>{blad}</div>
        ) : null}

        <div className='overflow-x-auto'>
          <table className='min-w-[1500px] w-full border-collapse text-sm text-tekst-glowny'>
            <thead>
              <tr className='bg-tlo-naglowek text-xs font-semibold uppercase tracking-wide text-tekst-drugorzedny'>
                <th className='w-14 border-b border-r border-obramowanie px-4 py-6 text-center'>
                  <input
                    type='checkbox'
                    checked={zaznaczoneWidoczne}
                    onChange={(event) => {
                      if (event.target.checked) {
                        ustawZaznaczoneIds((poprzednie) => [
                          ...new Set([...poprzednie, ...widoczneZlecenia.map((zlecenie) => zlecenie.id)]),
                        ]);
                        return;
                      }

                      ustawZaznaczoneIds((poprzednie) =>
                        poprzednie.filter((id) => !widoczneZlecenia.some((zlecenie) => zlecenie.id === id))
                      );
                    }}
                    className='h-5 w-5 rounded border-obramowanie'
                  />
                </th>
                <th className='border-b border-r border-obramowanie px-4 py-6 text-left'>Status</th>
                <th
                  className='border-b border-r border-obramowanie px-4 py-6 text-left'
                  onClick={() =>
                    onSortowanie(
                      'numer',
                      kluczSortowania === 'numer' && kierunekSortowania === 'asc' ? 'desc' : 'asc'
                    )
                  }
                >
                  <button type='button' className='inline-flex items-center gap-2 hover:text-akcent'>
                    Nr zlecenia
                  </button>
                </th>
                <th className='border-b border-r border-obramowanie px-4 py-6 text-left'>Obraz</th>
                <th className='border-b border-r border-obramowanie px-4 py-6 text-left'>ID Prodio</th>
                <th className='border-b border-r border-obramowanie px-4 py-6 text-left'>Zew. nr zamowienia</th>
                <th className='border-b border-r border-obramowanie px-4 py-6 text-left'>Poprzednik operacji</th>
                <th className='border-b border-r border-obramowanie px-4 py-6 text-left'>Klient</th>
                <th className='border-b border-r border-obramowanie px-4 py-6 text-left'>Produkt</th>
                <th className='border-b border-obramowanie px-4 py-6 text-center'>Akcje</th>
              </tr>

              {pokazFiltry ? (
                <tr className='bg-tlo-karta'>
                  <th className='border-b border-r border-obramowanie px-4 py-2' />
                  <th className='border-b border-r border-obramowanie px-2 py-2'>
                    <select
                      value={filtry.status}
                      onChange={(event) => ustawFiltry((poprzednie) => ({ ...poprzednie, status: event.target.value }))}
                      className='h-10 w-full rounded-md border border-obramowanie bg-tlo-glowne px-3 text-tekst-glowny'
                    >
                      <option value=''>Wybierz</option>
                      {opcjeStatusow.map((opcja) => (
                        <option key={opcja.wartosc} value={opcja.wartosc}>
                          {opcja.etykieta}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className='border-b border-r border-obramowanie px-2 py-2'>
                    <input
                      value={filtry.numer}
                      onChange={(event) => ustawFiltry((poprzednie) => ({ ...poprzednie, numer: event.target.value }))}
                      placeholder='Szukaj'
                      className='h-10 w-full rounded-md border border-obramowanie bg-tlo-glowne px-3 text-tekst-glowny'
                    />
                  </th>
                  <th className='border-b border-r border-obramowanie px-2 py-2' />
                  <th className='border-b border-r border-obramowanie px-2 py-2'>
                    <input
                      value={filtry.idProdio}
                      onChange={(event) => ustawFiltry((poprzednie) => ({ ...poprzednie, idProdio: event.target.value }))}
                      placeholder='Szukaj'
                      className='h-10 w-full rounded-md border border-obramowanie bg-tlo-glowne px-3 text-tekst-glowny'
                    />
                  </th>
                  <th className='border-b border-r border-obramowanie px-2 py-2'>
                    <input
                      value={filtry.zewnetrznyNumer}
                      onChange={(event) =>
                        ustawFiltry((poprzednie) => ({ ...poprzednie, zewnetrznyNumer: event.target.value }))
                      }
                      placeholder='Szukaj'
                      className='h-10 w-full rounded-md border border-obramowanie bg-tlo-glowne px-3 text-tekst-glowny'
                    />
                  </th>
                  <th className='border-b border-r border-obramowanie px-2 py-2'>
                    <div className='h-10 rounded-md border border-obramowanie bg-tlo-glowne' />
                  </th>
                  <th className='border-b border-r border-obramowanie px-2 py-2'>
                    <input
                      value={filtry.klient}
                      onChange={(event) => ustawFiltry((poprzednie) => ({ ...poprzednie, klient: event.target.value }))}
                      placeholder='Wybierz'
                      className='h-10 w-full rounded-md border border-obramowanie bg-tlo-glowne px-3 text-tekst-glowny'
                    />
                  </th>
                  <th className='border-b border-r border-obramowanie px-2 py-2'>
                    <input
                      value={filtry.produkt}
                      onChange={(event) => ustawFiltry((poprzednie) => ({ ...poprzednie, produkt: event.target.value }))}
                      placeholder='Wybierz'
                      className='h-10 w-full rounded-md border border-obramowanie bg-tlo-glowne px-3 text-tekst-glowny'
                    />
                  </th>
                  <th className='border-b border-obramowanie px-2 py-2' />
                </tr>
              ) : null}
            </thead>

            <tbody>
              {ladowanie ? (
                Array.from({ length: 7 }, (_, indeks) => (
                  <tr key={`skeleton-${indeks}`} className='odd:bg-tlo-karta even:bg-tlo-glowne/40'>
                    {Array.from({ length: 10 }, (__, kolumna) => (
                      <td key={kolumna} className='border-b border-r border-obramowanie px-4 py-5 last:border-r-0'>
                        <div className='h-6 animate-pulse rounded-md bg-obramowanie' />
                      </td>
                    ))}
                  </tr>
                ))
              ) : widoczneZlecenia.length === 0 ? (
                <tr>
                  <td colSpan={10} className='px-6 py-16 text-center text-tekst-drugorzedny'>
                    Brak danych
                  </td>
                </tr>
              ) : (
                widoczneZlecenia.map((wiersz) => (
                  <tr key={wiersz.id} className='odd:bg-tlo-karta even:bg-tlo-glowne/40'>
                    <td className='border-b border-r border-obramowanie px-4 py-4 text-center align-middle'>
                      <input
                        type='checkbox'
                        checked={zaznaczoneIds.includes(wiersz.id)}
                        onChange={(event) =>
                          ustawZaznaczoneIds((poprzednie) =>
                            event.target.checked
                              ? [...new Set([...poprzednie, wiersz.id])]
                              : poprzednie.filter((id) => id !== wiersz.id)
                          )
                        }
                        className='h-5 w-5 rounded border-obramowanie'
                      />
                    </td>
                    <td className='border-b border-r border-obramowanie px-4 py-4 align-middle'>
                      <StatusZleceniaPill status={wiersz.status} />
                    </td>
                    <td className='border-b border-r border-obramowanie px-4 py-4 align-middle'>
                      <button
                        type='button'
                        onClick={() => navigate(`/zlecenia-produkcyjne/${wiersz.id}`)}
                        className='border-b border-dashed border-akcent font-medium text-akcent hover:text-akcent-hover'
                      >
                        {wiersz.numer}
                      </button>
                    </td>
                    <td className='border-b border-r border-obramowanie px-4 py-4 align-middle'>
                      {wiersz.produkt?.zdjecie ? (
                        <img src={wiersz.produkt.zdjecie} alt={wiersz.produkt.nazwa} className='h-12 w-12 object-contain' />
                      ) : (
                        <div className='flex h-12 w-12 items-center justify-center rounded-md bg-tlo-glowne text-tekst-drugorzedny'>
                          <CircleDot className='h-5 w-5' />
                        </div>
                      )}
                    </td>
                    <td className='border-b border-r border-obramowanie px-4 py-4 align-middle text-akcent'>
                      <button
                        type='button'
                        onClick={() => navigate(`/zamowienia/${wiersz.zamowienieId}`)}
                        className='border-b border-dashed border-akcent transition hover:text-akcent-hover'
                      >
                        {wiersz.idProdio}
                      </button>
                    </td>
                    <td className='border-b border-r border-obramowanie px-4 py-4 align-middle text-akcent'>
                      {wiersz.zewnetrznyNumer ? (
                        <button
                          type='button'
                          onClick={() => {
                            const numerZewnetrzny = wiersz.zewnetrznyNumer ?? '';

                            if (numerZewnetrzny.toUpperCase().startsWith('ZK/')) {
                              navigate(`/zamowienia/zgrupowane?numer=${encodeURIComponent(numerZewnetrzny)}`);
                              return;
                            }

                            navigate(`/zamowienia/${wiersz.zamowienieId}`);
                          }}
                          className='border-b border-dashed border-akcent transition hover:text-akcent-hover'
                        >
                          {wiersz.zewnetrznyNumer}
                        </button>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className='border-b border-r border-obramowanie px-0 py-4 align-middle'>
                      <PasekPoprzednika poprzednik={wiersz.poprzednik} />
                    </td>
                    <td className='border-b border-r border-obramowanie px-4 py-4 align-middle text-akcent'>
                      {wiersz.klient ? (
                        <button
                          type='button'
                          onClick={() => navigate(`/klienci?klientId=${wiersz.klient!.id}`)}
                          className='border-b border-dashed border-akcent transition hover:text-akcent-hover'
                        >
                          {wiersz.klient.nazwa}
                        </button>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className='border-b border-r border-obramowanie px-4 py-4 align-middle'>
                      <div className='max-w-[420px]'>{wiersz.produkt?.nazwa || '-'}</div>
                    </td>
                    <td className='border-b border-obramowanie px-4 py-4 align-middle'>
                      <MenuAkcji
                        elementy={elementyMenu(wiersz)}
                        otwarte={otwarteMenuId === wiersz.id}
                        onToggle={() => ustawOtwarteMenuId((poprzednie) => (poprzednie === wiersz.id ? null : wiersz.id))}
                        onClose={() => ustawOtwarteMenuId(null)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className='flex flex-col gap-3 border-t border-obramowanie px-4 py-4 text-sm text-tekst-drugorzedny sm:flex-row sm:items-center sm:justify-between'>
          <div>
            Strona {strona} z {liczbaStron}
          </div>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => onZmianaStrony(strona - 1)}
              disabled={strona <= 1}
              className='rounded-md border border-obramowanie bg-tlo-glowne px-4 py-2 transition hover:border-akcent hover:text-akcent disabled:cursor-not-allowed disabled:opacity-50'
            >
              Poprzednia
            </button>
            <button type='button' className='rounded-md border border-akcent bg-akcent/10 px-4 py-2 font-medium text-akcent'>
              {strona}
            </button>
            <button
              type='button'
              onClick={() => onZmianaStrony(strona + 1)}
              disabled={strona >= liczbaStron}
              className='rounded-md border border-obramowanie bg-tlo-glowne px-4 py-2 transition hover:border-akcent hover:text-akcent disabled:cursor-not-allowed disabled:opacity-50'
            >
              Nastepna
            </button>
          </div>
        </div>
      </section>
      ) : null}

      {pokazPanelPlanowania ? (
        <section className='rounded-[28px] border border-obramowanie bg-tlo-karta p-6 shadow-xl shadow-black/10'>
          <div className='flex flex-col gap-3 border-b border-obramowanie pb-5'>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex items-center gap-3'>
                <h2 className='text-3xl font-semibold text-tekst-glowny'>Dodaj zamowienia do planowania</h2>
                <span className='text-sm text-tekst-drugorzedny'>(kolejnosc nie ma znaczenia, mozesz ja pozniej zmienic)</span>
              </div>
              <button
                type='button'
                onClick={() => ustawPokazPanelPlanowania(false)}
                className='inline-flex h-10 w-10 items-center justify-center rounded-full border border-obramowanie bg-tlo-glowne text-tekst-drugorzedny transition hover:border-akcent hover:text-akcent'
                aria-label='Zamknij widok dodawania'
              >
                <X className='h-5 w-5' />
              </button>
            </div>
            <p className='text-sm text-tekst-glowny'>
              Podpowiedz: Jesli chcesz szybciej dodawac zlecenia, przypisz do produktu maszyny, na jakich sa one wytwarzane.
              Przejdz do listy produktow i edytuj wybrany produkt.
            </p>
          </div>

          <div className='mt-10 flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between'>
            <div className='flex items-center justify-center xl:w-[220px]'>
              <div className='flex h-36 w-36 items-center justify-center rounded-full bg-akcent/10'>
                <div className='rounded-2xl border border-obramowanie bg-tlo-glowne p-6 shadow-sm'>
                  <div className='mb-3 flex gap-1.5'>
                    <span className='h-2.5 w-2.5 rounded-full bg-akcent/40' />
                    <span className='h-2.5 w-2.5 rounded-full bg-akcent/60' />
                    <span className='h-2.5 w-2.5 rounded-full bg-akcent' />
                  </div>
                  <div className='flex items-center justify-center text-green-500'>
                    <Settings2 className='h-10 w-10' />
                  </div>
                </div>
              </div>
            </div>

            <div className='flex-1 space-y-6'>
              <div className='mt-4 flex flex-col gap-4 xl:mt-6 xl:flex-row xl:items-center'>
                <div ref={refPlanowania} className='relative flex-1'>
                  <div className='relative'>
                    <input
                      value={szukajPlanowania}
                      onFocus={() => ustawOtwarteWynikiPlanowania(true)}
                      onChange={(event) => {
                        ustawSzukajPlanowania(event.target.value);
                        ustawOtwarteWynikiPlanowania(true);
                        ustawKandydatPlanowaniaId(null);
                      }}
                      placeholder='Szukaj'
                      className='h-10 w-full rounded-md border border-obramowanie bg-tlo-glowne px-4 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                    />
                    <button type='button' className='absolute right-4 top-1/2 -translate-y-1/2 text-akcent'>
                      <Search className='h-4 w-4' />
                    </button>
                  </div>

                  {otwarteWynikiPlanowania ? (
                    <div className='absolute left-0 right-0 top-[58px] z-20 max-h-[430px] overflow-y-auto rounded-b-xl border border-obramowanie bg-tlo-karta shadow-2xl'>
                      {kandydaciPlanowania.length === 0 ? (
                        <div className='px-5 py-6 text-sm text-tekst-drugorzedny'>Nie znaleziono danych</div>
                      ) : (
                        kandydaciPlanowania.map((zlecenie) => {
                          const aktywny = kandydatPlanowaniaId === zlecenie.id;
                          return (
                            <button
                              key={zlecenie.id}
                              type='button'
                              onClick={() => {
                                ustawKandydatPlanowaniaId(zlecenie.id);
                                ustawSzukajPlanowania(zlecenie.produkt?.nazwa || zlecenie.idProdio);
                                ustawOtwarteWynikiPlanowania(false);
                              }}
                              className={`grid w-full grid-cols-[70px_minmax(0,1fr)_160px_160px_110px_160px] gap-5 px-6 py-4 text-left transition ${
                                aktywny ? 'bg-akcent/10' : 'hover:bg-tlo-glowne'
                              }`}
                            >
                              <div className='flex items-start justify-center'>
                                {zlecenie.produkt?.zdjecie ? (
                                  <img src={zlecenie.produkt.zdjecie} alt={zlecenie.produkt.nazwa} className='h-14 w-14 object-contain' />
                                ) : (
                                  <div className='flex h-14 w-14 items-center justify-center rounded-md bg-tlo-glowne text-tekst-drugorzedny'>
                                    <CircleDot className='h-5 w-5' />
                                  </div>
                                )}
                              </div>
                              <div className='space-y-1 text-sm text-tekst-glowny'>
                                <div><span className='font-semibold'>ID Prodio:</span> {zlecenie.idProdio}</div>
                                <div><span className='font-semibold'>Produkt:</span> {zlecenie.produkt?.nazwa || '-'}</div>
                              </div>
                              <div className='space-y-1 text-sm text-tekst-glowny'>
                                <div><span className='font-semibold'>Zew. nr zamowienia:</span></div>
                                <div>{zlecenie.zewnetrznyNumer || '-'}</div>
                              </div>
                              <div className='space-y-1 text-sm text-tekst-glowny'>
                                <div><span className='font-semibold'>Klient:</span></div>
                                <div>{zlecenie.klient?.nazwa || '-'}</div>
                              </div>
                              <div className='space-y-1 text-sm text-tekst-glowny'>
                                <div><span className='font-semibold'>Status:</span></div>
                                <StatusZleceniaPill status={zlecenie.status} />
                              </div>
                              <div className='space-y-1 text-sm text-tekst-glowny'>
                                <div><span className='font-semibold'>Produkty (got./wszyszt.):</span></div>
                                <div>{formatujLiczbe(zlecenie.iloscWykonana)}/{formatujLiczbe(zlecenie.iloscPlan)}</div>
                                <div className='h-1.5 overflow-hidden rounded-full bg-obramowanie'>
                                  <div
                                    className='h-full rounded-full bg-akcent'
                                    style={{
                                      width: `${Math.max(
                                        0,
                                        Math.min(100, zlecenie.iloscPlan > 0 ? (zlecenie.iloscWykonana / zlecenie.iloscPlan) * 100 : 0)
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>

                <div className='flex items-center gap-5 pt-2 xl:pt-0'>
                  <button
                    type='button'
                    onClick={() => {
                      if (!kandydatPlanowaniaId) {
                        return;
                      }

                      ustawWybraneDoPlanowaniaIds((poprzednie) =>
                        poprzednie.includes(kandydatPlanowaniaId)
                          ? poprzednie
                          : [...poprzednie, kandydatPlanowaniaId]
                      );
                      ustawSzukajPlanowania('');
                      ustawKandydatPlanowaniaId(null);
                    }}
                    className='inline-flex h-10 items-center gap-2 rounded-full bg-akcent px-5 text-sm font-semibold text-white transition hover:bg-akcent-hover'
                  >
                    <Plus className='h-4 w-4' />
                    DODAJ DO LISTY
                  </button>

                  <button type='button' className='inline-flex items-center gap-2 text-sm font-semibold text-tekst-drugorzedny'>
                    <CircleDot className='h-4 w-4' />
                    ZAPLANUJ
                  </button>
                </div>
              </div>

              <div>
                <h3 className='mb-4 text-2xl font-semibold text-tekst-glowny'>Wybrane zamowienia:</h3>

                <div className='overflow-hidden rounded-xl border border-obramowanie'>
                  <table className='min-w-full text-sm'>
                    <thead className='bg-tlo-naglowek text-xs font-semibold uppercase tracking-wide text-tekst-drugorzedny'>
                      <tr>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-left'>Obraz</th>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-left'>Status</th>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-left'>ID Prodio</th>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-left'>Zew. nr zamowienia</th>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-left'>Produkt</th>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-left'>Produkty (got./wszyszt.)</th>
                        <th className='border-b border-obramowanie px-4 py-4 text-center'>Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wybraneDoPlanowania.length === 0 ? (
                        <tr>
                          <td colSpan={7} className='px-6 py-6 text-sm text-tekst-drugorzedny'>
                            Nie znaleziono danych
                          </td>
                        </tr>
                      ) : (
                        wybraneDoPlanowania.map((zlecenie) => (
                          <tr key={zlecenie.id} className='odd:bg-tlo-karta even:bg-tlo-glowne/40'>
                            <td className='border-b border-r border-obramowanie px-4 py-4'>
                              {zlecenie.produkt?.zdjecie ? (
                                <img src={zlecenie.produkt.zdjecie} alt={zlecenie.produkt.nazwa} className='h-12 w-12 object-contain' />
                              ) : (
                                <div className='flex h-12 w-12 items-center justify-center rounded-md bg-tlo-glowne text-tekst-drugorzedny'>
                                  <CircleDot className='h-5 w-5' />
                                </div>
                              )}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4'>
                              <StatusZleceniaPill status={zlecenie.status} />
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4'>{zlecenie.idProdio}</td>
                            <td className='border-b border-r border-obramowanie px-4 py-4'>{zlecenie.zewnetrznyNumer || '-'}</td>
                            <td className='border-b border-r border-obramowanie px-4 py-4'>{zlecenie.produkt?.nazwa || '-'}</td>
                            <td className='border-b border-r border-obramowanie px-4 py-4'>
                              {formatujLiczbe(zlecenie.iloscWykonana)}/{formatujLiczbe(zlecenie.iloscPlan)}
                            </td>
                            <td className='border-b border-obramowanie px-4 py-4 text-center'>
                              <button
                                type='button'
                                onClick={() =>
                                  ustawWybraneDoPlanowaniaIds((poprzednie) =>
                                    poprzednie.filter((id) => id !== zlecenie.id)
                                  )
                                }
                                className='text-red-500 transition hover:text-red-600'
                              >
                                <Trash2 className='mx-auto h-4 w-4' />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className='mt-12 flex justify-center'>
            <button
              type='button'
              onClick={() => {
                if (wybraneDoPlanowania.length === 0) {
                  window.alert('Najpierw dodaj przynajmniej jedno zamowienie do listy.');
                  return;
                }

                window.alert(`Dodano do planowania ${wybraneDoPlanowania.length} pozycji.`);
              }}
              className='rounded-full bg-emerald-400 px-8 py-4 text-sm font-semibold text-white transition hover:bg-emerald-300'
            >
              ZAPLANUJ WYBRANE ZAMOWIENIA
            </button>
          </div>
        </section>
      ) : null}

      <Modal
        czyOtwarty={czyModalEdycji}
        onZamknij={() => {
          if (zapisywanie) {
            return;
          }

          zamknijModalEdycji();
          ustawSzczegoly(null);
          ustawBladFormularza('');
          ustawFormularz(domyslnyFormularzEdycji());
        }}
        tytul={edytowaneId ? `Edytuj zlecenie ${edytowaneId}` : 'Edytuj zlecenie'}
        rozmiar='duzy'
        akcje={
          <>
            <Przycisk
              type='button'
              wariant='drugorzedny'
              onClick={zamknijModalEdycji}
              disabled={zapisywanie}
            >
              Zamknij
            </Przycisk>
            <Przycisk type='submit' form='formularz-edycji-zlecenia' czyLaduje={zapisywanie}>
              Zapisz zmiany
            </Przycisk>
          </>
        }
      >
        {ladowanieSzczegolow ? (
          <div className='py-12 text-center text-sm text-tekst-drugorzedny'>Ladowanie szczegolow...</div>
        ) : (
          <form id='formularz-edycji-zlecenia' onSubmit={zapiszZmiany} className='space-y-5'>
            <div className='grid gap-4 md:grid-cols-2'>
              <Rozwijane
                etykieta='Maszyna'
                opcje={opcjeMaszyn}
                wartosc={formularz.maszynaId}
                onZmiana={(wartosc) => ustawFormularz((poprzedni) => ({ ...poprzedni, maszynaId: String(wartosc) }))}
                placeholder='Wybierz maszyne'
              />
              <Rozwijane
                etykieta='Status'
                opcje={opcjeStatusow}
                wartosc={formularz.status}
                onZmiana={(wartosc) =>
                  ustawFormularz((poprzedni) => ({ ...poprzedni, status: wartosc as StatusZlecenia }))
                }
              />
              <Pole
                etykieta='Ilosc plan'
                type='number'
                min='0'
                value={formularz.iloscPlan}
                onChange={(event) => ustawFormularz((poprzedni) => ({ ...poprzedni, iloscPlan: event.target.value }))}
              />
              <Pole
                etykieta='Ilosc wykonana'
                type='number'
                min='0'
                value={formularz.iloscWykonana}
                onChange={(event) =>
                  ustawFormularz((poprzedni) => ({ ...poprzedni, iloscWykonana: event.target.value }))
                }
              />
              <Pole
                etykieta='Braki'
                type='number'
                min='0'
                value={formularz.iloscBrakow}
                onChange={(event) => ustawFormularz((poprzedni) => ({ ...poprzedni, iloscBrakow: event.target.value }))}
              />
              <Pole
                etykieta='Norma szt/godz'
                type='number'
                step='0.01'
                min='0'
                value={formularz.normaSztGodz}
                onChange={(event) =>
                  ustawFormularz((poprzedni) => ({ ...poprzedni, normaSztGodz: event.target.value }))
                }
              />
              <Rozwijane
                etykieta='Poprzednik operacji'
                opcje={(szczegoly?.kandydaciPoprzednika ?? []).map((pozycja) => ({
                  wartosc: String(pozycja.id),
                  etykieta: `${pozycja.numer} (${pozycja.iloscWykonana}/${pozycja.iloscPlan})`,
                }))}
                wartosc={formularz.poprzednikId}
                onZmiana={(wartosc) => ustawFormularz((poprzedni) => ({ ...poprzedni, poprzednikId: String(wartosc) }))}
                placeholder='Brak poprzednika'
              />
              <div className='grid grid-cols-2 gap-3'>
                <Przelacznik
                  wartosc={formularz.aktywne}
                  onZmiana={(wartosc) => ustawFormularz((poprzedni) => ({ ...poprzedni, aktywne: wartosc }))}
                  etykieta='Aktywne'
                />
                <Przelacznik
                  wartosc={formularz.maszynaKoncowa}
                  onZmiana={(wartosc) =>
                    ustawFormularz((poprzedni) => ({ ...poprzedni, maszynaKoncowa: wartosc }))
                  }
                  etykieta='Operacja koncowa'
                />
              </div>
              <PoleDatyZPotwierdzeniem
                etykieta='Planowany start'
                roboczaWartosc={roboczyPlanowanyStart}
                zatwierdzonaWartosc={formularz.planowanyStart}
                onZmianaRobocza={ustawRoboczyPlanowanyStart}
                onZatwierdz={() =>
                  ustawFormularz((poprzedni) => ({ ...poprzedni, planowanyStart: roboczyPlanowanyStart }))
                }
              />
              <PoleDatyZPotwierdzeniem
                etykieta='Planowany stop'
                roboczaWartosc={roboczyPlanowanyStop}
                zatwierdzonaWartosc={formularz.planowanyStop}
                onZmianaRobocza={ustawRoboczyPlanowanyStop}
                onZatwierdz={() =>
                  ustawFormularz((poprzedni) => ({ ...poprzedni, planowanyStop: roboczyPlanowanyStop }))
                }
              />
            </div>

            <Pole
              etykieta='Tagi'
              value={formularz.tagi}
              onChange={(event) => ustawFormularz((poprzedni) => ({ ...poprzedni, tagi: event.target.value }))}
              placeholder='Np. pilne, pakowanie, nocna-zmiana'
            />

            <div>
              <label className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Uwagi</label>
              <textarea
                value={formularz.uwagi}
                onChange={(event) => ustawFormularz((poprzedni) => ({ ...poprzedni, uwagi: event.target.value }))}
                rows={5}
                className='w-full rounded-lg border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent'
              />
            </div>

            {bladFormularza ? (
              <div className='rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
                {bladFormularza}
              </div>
            ) : null}
          </form>
        )}
      </Modal>
    </div>
  );
}
