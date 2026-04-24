import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUp,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Eye,
  EyeOff,
  Factory,
  FileText,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  Info,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Power,
  Printer,
  RefreshCcw,
  SquarePen,
  Trash2,
  Truck,
  UserRound,
  X,
} from 'lucide-react';
import klientApi from '../api/klient';
import Modal from '../komponenty/ui/Modal';
import type { MagazynDto } from './magazyn/StanyMagazynowe';
import type { OdpowiedzApi, StatusZamowienia, StatusZlecenia } from '../typy/indeks';

type Klient = {
  id: number;
  nazwa: string;
};

type ProduktZamowienia = {
  id: number;
  idProdio: string;
  nazwa: string;
  ean?: string | null;
  dodatkoweOznaczenia: string | null;
  wymiar?: string | null;
  sposobPakowania?: string | null;
  cena: number | string | null;
  waluta?: string | null;
  stawkaVat: number | null;
  zdjecie: string | null;
};

type PozycjaZamowienia = {
  id: number;
  produktId: number;
  ilosc: number;
  cena: number | string | null;
  produkt: ProduktZamowienia | null;
};

type Maszyna = {
  id: number;
  nazwa: string;
  kosztRbh: number | string;
  kosztUstawiania: number | string;
};

type ZlecenieWZamowieniu = {
  id: number;
  numer: string;
  status: StatusZlecenia;
  iloscPlan: number;
  iloscWykonana: number;
  iloscBrakow: number;
  planowanyStop: string | null;
  normaSztGodz: number | string;
  maszynaKoncowa: boolean;
  maszyna: Maszyna;
};

type SzczegolyZamowienia = {
  id: number;
  idProdio: string;
  zewnetrznyNumer: string | null;
  grupaId?: number | null;
  status: StatusZamowienia;
  oczekiwanaData: string | null;
  uwagi: string | null;
  klient: Klient | null;
  pozycje: PozycjaZamowienia[];
  zlecenia: ZlecenieWZamowieniu[];
};

type TabelaKosztowWiersz = {
  klucz: string;
  etykieta: string;
  poziom: number;
  suma?: boolean;
  planowanyCzas: number;
  planowanyKoszt: number;
  zrealizowanyCzas: number;
  zrealizowanyKoszt: number;
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
  uwagi: string | null;
  maszynaKoncowa: boolean;
  zamowienieId: number;
  maszynaId: number;
  maszyna: Maszyna;
  koszty: {
    kpi: {
      czas: {
        planowanyGodziny: number;
        zrealizowanyGodziny: number;
        procent: number;
      };
    };
    tabelaKosztow: TabelaKosztowWiersz[];
  };
};

type SzczegolyProduktu = {
  id: number;
  nazwa?: string;
  ean?: string | null;
  dodatkoweOznaczenia?: string | null;
  wymiar?: string | null;
  sposobPakowania?: string | null;
  informacjeNiewidoczne?: string | null;
  informacjeWidoczne?: string | null;
  zdjecie?: string | null;
  grupa?: {
    id: number;
    nazwa: string;
  } | null;
  bomSurowcow: Array<{
    ilosc: number | string;
    surowiec: {
      id: number;
      nazwa: string;
      jednostka: string;
      cena: number | string | null;
    };
  }>;
};

type OdpowiedzListy<T> = {
  dane: T[];
  lacznie?: number;
};

type ElementMenuAkcji = {
  etykieta: string;
  ikona: ReactNode;
  akcja?: () => void;
  niebezpieczna?: boolean;
  wylaczone?: boolean;
};

type FormularzEdycjiZamowienia = {
  klientId: string;
  status: StatusZamowienia;
  zewnetrznyNumer: string;
  ilosc: string;
  jednostka: string;
  oczekiwanaData: string;
  terminPotwierdzony: string;
  dataWysylki: string;
  cena: string;
  stawkaVat: string;
  waluta: string;
  uwagiWidoczne: string;
  uwagiNiewidoczne: string;
};

type WidokSurowca = {
  id: number;
  nazwa: string;
  iloscNaProdukt: number;
  iloscNaZamowienie: number;
  iloscZuzyta: number;
  jednostka: string;
  cena: number;
  waluta: string;
  mozliwosciProdukcyjne: number;
};

type WierszHistoriiZamowienia = {
  id: number;
  numerZlecenia: string;
  maszynaOperacja: { id: number; nazwa: string };
  pracownik: { id: number; imie: string; nazwisko: string; aktywny: boolean } | null;
  iloscWykonana: number;
  czasSekundy: number;
  czasBezPauzSekundy: number;
  pauzaSekundy: number;
  wydajnoscProcent: number;
  wydajnoscTekst: string;
  start: string;
  stop: string | null;
  maBraki: boolean;
  braki: number;
  opisBrakow: string | null;
  operacjaKoncowa: boolean;
  powodyPrzerw: string[];
  tagi: string[];
  zlecenieId: number;
  zamowienieId: number;
  formatowanyCzas: string;
  formatowanyCzasBezPauz: string;
  formatowanaPauza: string;
};

type OdpowiedzHistoriiPracy = {
  dane: WierszHistoriiZamowienia[];
  total: number;
  strona: number;
  limit: number;
};

type WydanieMagazynowe = {
  id: number;
  numer: string | null;
  magazyn: MagazynDto;
  surowiec: {
    id: number;
    nazwa: string;
    jednostka: string;
    cena: number;
    waluta: string;
  };
  ilosc: number;
  zlecenieId: number | null;
  zlecenie: { id: number; numer: string } | null;
  uwagi: string | null;
  utworzonyW: string;
};

type FormularzPrzyjeciaZamowienia = {
  magazynId: string;
  data: string;
  typPrzyjecia: string;
  trybZamowienia: 'POJEDYNCZE' | 'ZGRUPOWANE';
  klient: string;
  identyfikacja: string;
  uwagi: string;
};

type PozycjaPrzyjeciaZamowienia = {
  id: number;
  nazwa: string;
  prodioId: string;
  iloscPrzyjmowana: string;
  iloscZamowiona: string;
  cena: string;
  stawkaVat: string;
  waluta: string;
};

type WidokPrzyjecia = {
  id: string;
  idProdio: string;
  magazyn: string;
  produktLubSurowiec: string;
  dostarczoneLubZamowione: string;
  iloscZamowiona: string;
  dostawcaLubKlient: string;
  identyfikacja: string;
  data: string;
  cena: string;
  uwagi: string;
};

type FormularzWydaniaZamowienia = {
  magazynId: string;
  data: string;
  rodzajWydania: string;
  trybZamowienia: 'POJEDYNCZE' | 'ZGRUPOWANE';
  klient: string;
  identyfikacja: string;
  uwagi: string;
};

type PozycjaWydaniaZamowienia = {
  id: number;
  nazwa: string;
  prodioId: string;
  ilosc: string;
  iloscZamowiona: string;
  cena: string;
  stawkaVat: string;
  waluta: string;
};

type WidokWydania = {
  id: string;
  idProdio: string;
  magazyn: string;
  produktLubSurowiec: string;
  ilosc: string;
  iloscZamowiona: string;
  dostawcaLubKlient: string;
  identyfikacja: string;
  data: string;
  cena: string;
  uwagi: string;
};

type PodsumowanieSurowca = {
  klucz: number;
  nazwa: string;
  jednostka: string;
  iloscNaZamowienie: number;
  iloscZuzyta: number;
  planowanyKoszt: number;
  zrealizowanyKoszt: number;
  mozliwosciProdukcyjne: number;
};

type PodsumowanieKosztow = {
  sumaOperacji: TabelaKosztowWiersz;
  sumaUstawiania: TabelaKosztowWiersz;
  sumaLaczna: TabelaKosztowWiersz;
  kosztJednostkowy: TabelaKosztowWiersz;
  surowce: TabelaKosztowWiersz;
  calkowity: TabelaKosztowWiersz;
};

type WpisAktywnosci = {
  id: string;
  autor: string;
  opis: string;
  data: string;
  wariant?: 'system' | 'uzytkownik';
};

const ZAKLADKI = [
  'Progres',
  'Podglad',
  'Edytuj',
  'Surowce',
  'Historia pracy',
  'Wydania',
  'Przyjecia',
  'Aktywnosc',
] as const;

type NazwaZakladki = (typeof ZAKLADKI)[number] | 'Podsumowanie zamowienia';

const ETYKIETY_STATUSU_ZAMOWIENIA: Record<StatusZamowienia, string> = {
  NOWE: 'NOWE',
  W_REALIZACJI: 'W TOKU',
  GOTOWE: 'GOTOWE',
  WYDANE: 'WYDANE',
  ZAMKNIETE: 'ZAMKNIETE',
  ANULOWANE: 'ANULOWANE',
  WSTRZYMANE: 'WSTRZYMANE',
  OCZEKUJE: 'ZAPLANOWANE',
  PRZETERMINOWANE: 'PRZETERMINOWANE',
};

const KLASY_STATUSU_ZAMOWIENIA: Record<StatusZamowienia, string> = {
  NOWE: 'bg-slate-500/20 text-slate-100 ring-1 ring-inset ring-slate-400/30',
  W_REALIZACJI: 'bg-akcent/20 text-orange-100 ring-1 ring-inset ring-akcent/40',
  GOTOWE: 'bg-emerald-500/20 text-emerald-100 ring-1 ring-inset ring-emerald-400/30',
  WYDANE: 'bg-cyan-500/20 text-cyan-100 ring-1 ring-inset ring-cyan-400/30',
  ZAMKNIETE: 'bg-slate-500/20 text-slate-100 ring-1 ring-inset ring-slate-400/30',
  ANULOWANE: 'bg-rose-500/20 text-rose-100 ring-1 ring-inset ring-rose-400/30',
  WSTRZYMANE: 'bg-amber-500/20 text-amber-100 ring-1 ring-inset ring-amber-400/30',
  OCZEKUJE: 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/30',
  PRZETERMINOWANE: 'bg-red-500/20 text-red-100 ring-1 ring-inset ring-red-400/30',
};

const META_STATUSU_ZLECENIA: Record<
  StatusZlecenia,
  { etykieta: string; klasy: string; znacznik: string }
> = {
  STOP: {
    etykieta: 'STOP',
    klasy: 'bg-slate-600/25 text-slate-100 ring-1 ring-inset ring-slate-400/30',
    znacznik: '■',
  },
  W_TOKU: {
    etykieta: 'W TOKU',
    klasy: 'bg-akcent/20 text-orange-100 ring-1 ring-inset ring-akcent/40',
    znacznik: '▶',
  },
  PAUZA: {
    etykieta: 'PAUZA',
    klasy: 'bg-amber-500/20 text-amber-100 ring-1 ring-inset ring-amber-400/30',
    znacznik: '▮▮',
  },
  GOTOWE: {
    etykieta: 'GOTOWE',
    klasy: 'bg-emerald-500/20 text-emerald-100 ring-1 ring-inset ring-emerald-400/30',
    znacznik: '✓',
  },
  ANULOWANE: {
    etykieta: 'ANULOWANE',
    klasy: 'bg-rose-500/20 text-rose-100 ring-1 ring-inset ring-rose-400/30',
    znacznik: '✕',
  },
};

function naLiczbe(wartosc: number | string | null | undefined) {
  const liczba = Number(wartosc ?? 0);
  return Number.isFinite(liczba) ? liczba : 0;
}

function formatujLiczbe(wartosc: number, miejsca = 2) {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: miejsca,
    maximumFractionDigits: miejsca,
  }).format(wartosc);
}

function formatujWalute(wartosc: number) {
  return `${formatujLiczbe(wartosc, 2)} PLN`;
}

function formatujDate(wartosc: string | null) {
  if (!wartosc) {
    return '-';
  }

  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toLocaleDateString('pl-PL');
}

function formatujDateGodzine(wartosc: string | null) {
  if (!wartosc) {
    return '-';
  }

  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return `${data.toLocaleDateString('pl-PL')} ${data.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function naDateInput(wartosc: string | null) {
  if (!wartosc) {
    return '';
  }

  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) {
    return '';
  }

  return data.toISOString().slice(0, 10);
}

function rozdzielUwagi(uwagi: string | null) {
  if (!uwagi) {
    return { widoczne: '', niewidoczne: '' };
  }

  const znacznik = '\n\n---\nUwagi niewidoczne dla produkcji:\n';

  if (!uwagi.includes(znacznik)) {
    return { widoczne: uwagi.replace(/^Uwagi dla wszystkich:\n/, ''), niewidoczne: '' };
  }

  const [widoczne, niewidoczne] = uwagi.split(znacznik);
  return {
    widoczne: widoczne.replace(/^Uwagi dla wszystkich:\n/, ''),
    niewidoczne: niewidoczne ?? '',
  };
}

function polaczUwagi(widoczne: string, niewidoczne: string) {
  const czysteWidoczne = widoczne.trim();
  const czysteNiewidoczne = niewidoczne.trim();

  if (!czysteWidoczne && !czysteNiewidoczne) {
    return undefined;
  }

  if (!czysteNiewidoczne) {
    return czysteWidoczne ? `Uwagi dla wszystkich:\n${czysteWidoczne}` : undefined;
  }

  return `Uwagi dla wszystkich:\n${czysteWidoczne}\n\n---\nUwagi niewidoczne dla produkcji:\n${czysteNiewidoczne}`;
}

function formatujDateGodzinePelna(wartosc: string | null) {
  if (!wartosc) {
    return '-';
  }

  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return `${data.toLocaleDateString('sv-SE')} ${data.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;
}

function formatujDateNaOsi(wartosc: string) {
  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatujSekundyCzasu(sekundy: number) {
  const bezpieczne = Math.max(0, Math.round(sekundy));
  const godziny = Math.floor(bezpieczne / 3600);
  const minuty = Math.floor((bezpieczne % 3600) / 60);
  const sek = bezpieczne % 60;
  return [godziny, minuty, sek].map((wartosc) => String(wartosc).padStart(2, '0')).join(':');
}

function pobierzNazwePracownika(pracownik: WierszHistoriiZamowienia['pracownik']) {
  if (!pracownik) {
    return '-';
  }

  return `${pracownik.imie} ${pracownik.nazwisko}`;
}

function formatujDateTimeDoInput() {
  const teraz = new Date();
  const przesuniecie = teraz.getTimezoneOffset() * 60000;
  return new Date(teraz.getTime() - przesuniecie).toISOString().slice(0, 16);
}

function formatujCzasZGodzin(godziny: number) {
  const sekundy = Math.max(0, Math.round(godziny * 3600));
  const godz = Math.floor(sekundy / 3600);
  const min = Math.floor((sekundy % 3600) / 60);
  const sek = sekundy % 60;
  return [godz, min, sek].map((wartosc) => String(wartosc).padStart(2, '0')).join(':');
}

function obliczProcent(aktualna: number, docelowa: number) {
  if (docelowa <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (aktualna / docelowa) * 100));
}

function StatusZamowieniaPill({ status }: { status: StatusZamowienia }) {
  return (
    <span className={`inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${KLASY_STATUSU_ZAMOWIENIA[status]}`}>
      {ETYKIETY_STATUSU_ZAMOWIENIA[status]}
    </span>
  );
}

function StatusZleceniaPill({ status }: { status: StatusZlecenia }) {
  const meta = META_STATUSU_ZLECENIA[status];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${meta.klasy}`}>
      <span className='text-[10px]'>{meta.znacznik}</span>
      <span>{meta.etykieta}</span>
    </span>
  );
}

function PasekPostepu({
  wartosc,
  limit,
  kolor = 'niebieski',
}: {
  wartosc: number;
  limit: number;
  kolor?: 'niebieski' | 'zielony' | 'czerwony' | 'pomaranczowy';
}) {
  const procent = obliczProcent(wartosc, limit);
  const klasy =
    kolor === 'zielony'
      ? 'from-emerald-400 via-emerald-500 to-emerald-400'
      : kolor === 'czerwony'
        ? 'from-rose-500 via-red-500 to-rose-500'
        : kolor === 'pomaranczowy'
          ? 'from-orange-400 via-akcent to-orange-400'
          : 'from-sky-400 via-blue-500 to-sky-400';

  return (
    <div className='mt-3 h-2 overflow-hidden rounded-full bg-slate-700/70'>
      <div
        className={`h-full rounded-full bg-gradient-to-r ${klasy}`}
        style={{ width: `${procent}%` }}
      />
    </div>
  );
}

function KartaKpi({
  ikona,
  etykieta,
  wartosc,
  pomocnicza,
  pasek,
  limit,
  kolorPaska,
}: {
  ikona: React.ReactNode;
  etykieta: string;
  wartosc: string;
  pomocnicza?: string;
  pasek: number;
  limit: number;
  kolorPaska?: 'niebieski' | 'zielony' | 'czerwony' | 'pomaranczowy';
}) {
  return (
    <article className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-5 shadow-xl shadow-black/10'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <div className='text-sm font-medium text-tekst-drugorzedny'>{etykieta}</div>
          <div className='mt-3 text-2xl font-semibold text-tekst-glowny'>{wartosc}</div>
          {pomocnicza ? <div className='mt-1 text-sm text-tekst-drugorzedny'>{pomocnicza}</div> : null}
        </div>
        <div className='flex h-12 w-12 items-center justify-center rounded-2xl border border-obramowanie bg-tlo-glowne text-akcent'>
          {ikona}
        </div>
      </div>
      <PasekPostepu wartosc={pasek} limit={limit} kolor={kolorPaska} />
    </article>
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
      const szerokoscMenu = 250;
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
        className='inline-flex h-10 w-10 items-center justify-center rounded-full border border-obramowanie bg-tlo-glowne text-akcent transition hover:border-akcent hover:bg-akcent/10'
        aria-label='Pokaz akcje'
      >
        <MoreHorizontal className='h-4 w-4' />
      </button>

      {otwarte && pozycjaMenu
        ? createPortal(
            <div
              ref={portalRef}
              className='fixed z-[9999] w-[250px] overflow-y-auto overflow-x-hidden rounded-xl border border-obramowanie bg-tlo-karta shadow-2xl'
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

function WierszPodgladu({
  etykieta,
  wartosc,
}: {
  etykieta: string;
  wartosc: React.ReactNode;
}) {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)_minmax(160px,220px)] items-start gap-6 border-b border-obramowanie/70 py-4 text-[15px]'>
      <div className='text-tekst-drugorzedny'>{etykieta}</div>
      <div className='text-right font-semibold text-tekst-glowny'>{wartosc}</div>
    </div>
  );
}

function PanelPlikow({
  tytul,
  pustyTekst,
  dzieci,
}: {
  tytul: string;
  pustyTekst?: string;
  dzieci?: React.ReactNode;
}) {
  return (
    <div className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-karta shadow-lg shadow-black/10'>
      <div className='bg-tlo-naglowek px-4 py-3 text-base font-semibold text-tekst-glowny'>{tytul}</div>
      <div className='min-h-[66px] bg-tlo-glowne/35 px-4 py-4 text-sm text-tekst-drugorzedny'>
        {dzieci ?? pustyTekst ?? '-'}
      </div>
    </div>
  );
}

function PoleEdycji({
  etykieta,
  wymagane,
  children,
  wysokie = false,
}: {
  etykieta: string;
  wymagane?: boolean;
  children: React.ReactNode;
  wysokie?: boolean;
}) {
  return (
    <label className={`block rounded-2xl border border-obramowanie bg-tlo-karta/75 p-4 shadow-sm shadow-black/10 ${wysokie ? 'h-full' : ''}`}>
      <div className='mb-3 text-sm text-tekst-drugorzedny'>
        {etykieta}
        {wymagane ? <span className='text-akcent'>*</span> : null}
      </div>
      {children}
    </label>
  );
}

function PanelEdycjiPlikow({ tytul }: { tytul: string }) {
  return (
    <div className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-karta shadow-lg shadow-black/10'>
      <div className='flex items-center justify-between bg-tlo-naglowek px-4 py-4 text-base font-semibold text-tekst-glowny'>
        <span>{tytul}</span>
        <button
          type='button'
          className='inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-akcent transition hover:bg-white/10'
          aria-label={`Dodaj do sekcji ${tytul}`}
        >
          <span className='text-xl leading-none'>+</span>
        </button>
      </div>
      <div className='min-h-[136px] bg-tlo-glowne/20 px-4 py-4 text-sm text-tekst-drugorzedny' />
    </div>
  );
}

function PustePoleDodatkowe({ tytul }: { tytul: string }) {
  return (
    <div className='rounded-2xl border border-dashed border-obramowanie bg-tlo-glowne/20 px-5 py-8 text-sm text-tekst-drugorzedny'>
      {tytul}
    </div>
  );
}

function PrzyciskAkcjiSurowce({
  etykieta,
  ikona,
  wariant = 'jasny',
  onClick,
}: {
  etykieta: string;
  ikona: React.ReactNode;
  wariant?: 'jasny' | 'akcent';
  onClick?: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`inline-flex items-center gap-3 rounded-full border px-5 py-3 text-sm font-semibold transition ${
        wariant === 'akcent'
          ? 'border-akcent bg-akcent text-white hover:bg-akcent-hover'
          : 'border-obramowanie bg-tlo-glowne text-tekst-glowny hover:border-akcent hover:text-akcent'
      }`}
    >
      {ikona}
      {etykieta}
    </button>
  );
}

function IkonyStatusuSurowca({ aktywny }: { aktywny: boolean }) {
  return (
    <div className='flex items-center gap-3'>
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${aktywny ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' : 'border-obramowanie bg-tlo-glowne text-tekst-drugorzedny'}`}>
        <Check className='h-4 w-4' />
      </span>
      <span className='inline-flex h-8 w-8 items-center justify-center rounded-full border border-obramowanie bg-tlo-glowne text-amber-300'>
        <AlertTriangle className='h-4 w-4' />
      </span>
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${aktywny ? 'border-obramowanie bg-tlo-glowne text-tekst-drugorzedny' : 'border-red-400/30 bg-red-500/15 text-red-300'}`}>
        <X className='h-4 w-4' />
      </span>
    </div>
  );
}

function SekcjaPodgladu({
  ikona,
  tytul,
  podtytul,
  lewa,
  srodek,
  prawa,
}: {
  ikona: React.ReactNode;
  tytul: string;
  podtytul?: React.ReactNode;
  lewa: React.ReactNode;
  srodek: React.ReactNode;
  prawa: React.ReactNode;
}) {
  return (
    <section className='border-t border-obramowanie/70 pt-6 first:border-t-0 first:pt-0'>
      <div className='grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)_minmax(360px,1fr)]'>
        <div>
          <div className='mb-4 flex items-center gap-3'>
            <div className='flex h-8 w-8 items-center justify-center rounded-full border border-akcent/40 bg-akcent/10 text-akcent'>
              {ikona}
            </div>
            <div className='text-[18px] font-semibold text-tekst-glowny'>{tytul}</div>
            {podtytul ? <div className='text-[18px] font-semibold text-tekst-glowny'>{podtytul}</div> : null}
          </div>
          {lewa}
        </div>
        <div>{srodek}</div>
        <div>{prawa}</div>
      </div>
    </section>
  );
}

export default function SzczegolyZamowienia() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aktywnaZakladka, ustawAktywnaZakladke] = useState<NazwaZakladki>('Progres');
  const [zamowienie, ustawZamowienie] = useState<SzczegolyZamowienia | null>(null);
  const [szczegolyZlecen, ustawSzczegolyZlecen] = useState<SzczegolyZlecenia[]>([]);
  const [historiaPracyWiersze, ustawHistoriePracyWiersze] = useState<WierszHistoriiZamowienia[]>([]);
  const [wydaniaMagazynowe, ustawWydaniaMagazynowe] = useState<WydanieMagazynowe[]>([]);
  const [wydaniaRobocze, ustawWydaniaRobocze] = useState<WidokWydania[]>([]);
  const [magazyny, ustawMagazyny] = useState<MagazynDto[]>([]);
  const [produkty, ustawProdukty] = useState<Record<number, SzczegolyProduktu>>({});
  const [klienci, ustawKlientow] = useState<Klient[]>([]);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [blad, ustawBlad] = useState('');
  const [bladZapisuEdycji, ustawBladZapisuEdycji] = useState('');
  const [sukcesZapisuEdycji, ustawSukcesZapisuEdycji] = useState('');
  const [zapisywanieEdycji, ustawZapisywanieEdycji] = useState(false);
  const [wiadomoscAktywnosci, ustawWiadomoscAktywnosci] = useState('');
  const [wpisyAktywnosciLokalne, ustawWpisyAktywnosciLokalne] = useState<WpisAktywnosci[]>([]);
  const [notatkiSurowcow, ustawNotatkiSurowcow] = useState<Record<number, string>>({});
  const [komunikatSurowcow, ustawKomunikatSurowcow] = useState('');
  const [otwarteMenuZleceniaId, ustawOtwarteMenuZleceniaId] = useState<number | null>(null);
  const [operacjaZleceniaId, ustawOperacjaZleceniaId] = useState<number | null>(null);
  const [przyjeciaRobocze, ustawPrzyjeciaRobocze] = useState<WidokPrzyjecia[]>([]);
  const [czyFormularzPrzyjeciaOtwarty, ustawCzyFormularzPrzyjeciaOtwarty] = useState(false);
  const [komunikatPrzyjecia, ustawKomunikatPrzyjecia] = useState('');
  const [formularzPrzyjecia, ustawFormularzPrzyjecia] = useState<FormularzPrzyjeciaZamowienia>({
    magazynId: '',
    data: '',
    typPrzyjecia: 'ZWROT_OD_KLIENTA',
    trybZamowienia: 'POJEDYNCZE',
    klient: '',
    identyfikacja: '',
    uwagi: '',
  });
  const [pozycjePrzyjecia, ustawPozycjePrzyjecia] = useState<PozycjaPrzyjeciaZamowienia[]>([]);
  const [czyFormularzWydaniaOtwarty, ustawCzyFormularzWydaniaOtwarty] = useState(false);
  const [komunikatWydania, ustawKomunikatWydania] = useState('');
  const [formularzWydania, ustawFormularzWydania] = useState<FormularzWydaniaZamowienia>({
    magazynId: '',
    data: '',
    rodzajWydania: 'DO_KLIENTA',
    trybZamowienia: 'POJEDYNCZE',
    klient: '',
    identyfikacja: '',
    uwagi: '',
  });
  const [pozycjeWydania, ustawPozycjeWydania] = useState<PozycjaWydaniaZamowienia[]>([]);
  const [formularzEdycji, ustawFormularzEdycji] = useState<FormularzEdycjiZamowienia>({
    klientId: '',
    status: 'NOWE',
    zewnetrznyNumer: '',
    ilosc: '',
    jednostka: 'szt',
    oczekiwanaData: '',
    terminPotwierdzony: '',
    dataWysylki: '',
    cena: '',
    stawkaVat: '23',
    waluta: 'PLN',
    uwagiWidoczne: '',
    uwagiNiewidoczne: '',
  });

  const pobierzDaneZamowienia = async (czyAnulowano?: () => boolean) => {
    if (!id) {
      ustawBlad('Brak identyfikatora zamowienia.');
      ustawLadowanie(false);
      return;
    }

    ustawLadowanie(true);
    ustawBlad('');

    try {
      const odpowiedz = await klientApi.get<OdpowiedzApi<SzczegolyZamowienia>>(`/zamowienia/${id}`);
      if (czyAnulowano?.()) {
        return;
      }

      const dane = odpowiedz.data.dane;
      ustawZamowienie(dane);

      const unikalneProdukty = [...new Set(dane.pozycje.map((pozycja) => pozycja.produktId))];
      const [zleceniaOdpowiedzi, produktyOdpowiedzi, klienciOdpowiedz, historiaPracyOdpowiedzi, magazynyOdpowiedz, wydaniaOdpowiedzi] = await Promise.all([
        Promise.all(
          dane.zlecenia.map((zlecenie) =>
            klientApi.get<OdpowiedzApi<SzczegolyZlecenia>>(`/zlecenia-produkcyjne/${zlecenie.id}`)
          )
        ),
        Promise.all(
          unikalneProdukty.map((produktId) =>
            klientApi.get<OdpowiedzApi<SzczegolyProduktu>>(`/produkty/${produktId}`)
          )
        ),
        klientApi.get<OdpowiedzListy<Klient>>('/klienci', {
          params: { strona: 1, iloscNaStrone: 200, sortPole: 'nazwa', sortKierunek: 'asc' },
        }),
        dane.zlecenia.length > 0
          ? Promise.all(
              dane.zlecenia.map((zlecenie) =>
                klientApi.get<OdpowiedzHistoriiPracy>('/historia-pracy', {
                  params: { page: 1, limit: 200, zlecenieId: zlecenie.id },
                })
              )
            )
          : Promise.resolve([]),
        klientApi.get<OdpowiedzApi<MagazynDto[]>>('/magazyn/magazyny'),
        dane.zlecenia.length > 0
          ? Promise.all(
              dane.zlecenia.map((zlecenie) =>
                klientApi.get<{ sukces: boolean; dane: WydanieMagazynowe[]; total: number; page: number; limit: number }>('/magazyn/wydania', {
                  params: { page: 1, limit: 100, zlecenieId: zlecenie.id },
                })
              )
            )
          : Promise.resolve([]),
      ]);

      if (czyAnulowano?.()) {
        return;
      }

      ustawSzczegolyZlecen(zleceniaOdpowiedzi.map((element) => element.data.dane));
      ustawProdukty(
        Object.fromEntries(
          produktyOdpowiedzi.map((element) => [element.data.dane.id, element.data.dane])
        )
      );
      ustawKlientow(klienciOdpowiedz.data.dane ?? []);
      ustawMagazyny(magazynyOdpowiedz.data.dane ?? []);
      ustawHistoriePracyWiersze(
        historiaPracyOdpowiedzi
          .flatMap((element) => element.data.dane ?? [])
          .filter((wiersz, indeks, tablica) => tablica.findIndex((element) => element.id === wiersz.id) === indeks)
          .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
      );
      ustawWydaniaMagazynowe(
        wydaniaOdpowiedzi
          .flatMap((element) => element.data.dane ?? [])
          .filter((wiersz, indeks, tablica) => tablica.findIndex((element) => element.id === wiersz.id) === indeks)
          .sort((a, b) => new Date(b.utworzonyW).getTime() - new Date(a.utworzonyW).getTime())
      );
    } catch {
      if (!czyAnulowano?.()) {
        ustawBlad('Nie udalo sie pobrac szczegolow zamowienia.');
        ustawZamowienie(null);
        ustawSzczegolyZlecen([]);
        ustawHistoriePracyWiersze([]);
        ustawWydaniaMagazynowe([]);
        ustawMagazyny([]);
        ustawProdukty({});
      }
    } finally {
      if (!czyAnulowano?.()) {
        ustawLadowanie(false);
      }
    }
  };

  useEffect(() => {
    let anulowano = false;
    void pobierzDaneZamowienia(() => anulowano);
    return () => {
      anulowano = true;
    };
  }, [id]);

  const pobierzSzczegolyZleceniaJednorazowo = async (zlecenieId: number) => {
    const odpowiedz = await klientApi.get<OdpowiedzApi<SzczegolyZlecenia>>(`/zlecenia-produkcyjne/${zlecenieId}`);
    return odpowiedz.data.dane;
  };

  const zaktualizujZlecenieNaPodstawieSzczegolow = async (
    zlecenieId: number,
    modyfikator: (dane: SzczegolyZlecenia) => Record<string, unknown>,
    komunikatBledu: string
  ) => {
    ustawOperacjaZleceniaId(zlecenieId);
    ustawBlad('');

    try {
      const dane = await pobierzSzczegolyZleceniaJednorazowo(zlecenieId);

      await klientApi.put(`/zlecenia-produkcyjne/${zlecenieId}`, {
        maszynaId: String(dane.maszynaId),
        iloscPlan: String(dane.iloscPlan),
        iloscWykonana: String(dane.iloscWykonana),
        iloscBrakow: String(dane.iloscBrakow),
        poprzednikId: dane.poprzednikId ? String(dane.poprzednikId) : null,
        planowanyStart: dane.planowanyStart,
        planowanyStop: dane.planowanyStop,
        normaSztGodz: String(dane.normaSztGodz ?? 0),
        status: dane.status,
        tagi: dane.tagi ?? [],
        przypisaniPracownicyIds: dane.przypisaniPracownicyIds ?? [],
        aktywne: dane.aktywne,
        maszynaKoncowa: dane.maszynaKoncowa,
        uwagi: dane.uwagi ?? '',
        ...modyfikator(dane),
      });

      await pobierzDaneZamowienia();
    } catch {
      ustawBlad(komunikatBledu);
    } finally {
      ustawOperacjaZleceniaId(null);
    }
  };

  const duplikujZlecenie = async (zlecenieId: number) => {
    ustawOperacjaZleceniaId(zlecenieId);
    ustawBlad('');

    try {
      const dane = await pobierzSzczegolyZleceniaJednorazowo(zlecenieId);

      await klientApi.post('/zlecenia-produkcyjne', {
        zamowienieId: String(dane.zamowienieId),
        maszynaId: String(dane.maszynaId),
        iloscPlan: String(dane.iloscPlan),
        normaSztGodz: String(dane.normaSztGodz ?? 0),
        status: dane.status,
      });

      await pobierzDaneZamowienia();
    } catch {
      ustawBlad('Nie udalo sie zduplikowac zlecenia produkcyjnego.');
    } finally {
      ustawOperacjaZleceniaId(null);
    }
  };

  const usunZlecenie = async (zlecenieId: number, numer: string) => {
    if (!window.confirm(`Czy na pewno chcesz usunac zlecenie ${numer}?`)) {
      return;
    }

    ustawOperacjaZleceniaId(zlecenieId);
    ustawBlad('');

    try {
      await klientApi.delete(`/zlecenia-produkcyjne/${zlecenieId}`);
      await pobierzDaneZamowienia();
    } catch {
      ustawBlad('Nie udalo sie usunac zlecenia produkcyjnego.');
    } finally {
      ustawOperacjaZleceniaId(null);
    }
  };

  const przesunZlecenieWZamowieniu = (zlecenieId: number, typ: 'gora' | 'koniec') => {
    ustawSzczegolyZlecen((poprzednie) => {
      const biezace = poprzednie.find((zlecenie) => zlecenie.id === zlecenieId);
      if (!biezace) {
        return poprzednie;
      }

      const bezBiezacego = poprzednie.filter((zlecenie) => zlecenie.id !== zlecenieId);
      return typ === 'gora' ? [biezace, ...bezBiezacego] : [...bezBiezacego, biezace];
    });
  };

  const elementyMenuZlecenia = (zlecenie: SzczegolyZlecenia): ElementMenuAkcji[] => [
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
      akcja: () => window.open(`${window.location.origin}/zlecenia-produkcyjne/${zlecenie.id}`, '_blank', 'noopener,noreferrer'),
    },
    {
      etykieta: 'Edytuj',
      ikona: <Pencil className='h-4 w-4 text-akcent' />,
      akcja: () => navigate(`/zlecenia-produkcyjne?zamowienieId=${zamowienie?.id}&zlecenie=${zlecenie.id}`),
    },
    {
      etykieta: 'Przesun na gore kolejki',
      ikona: <ArrowUp className='h-4 w-4 text-akcent' />,
      akcja: () => przesunZlecenieWZamowieniu(zlecenie.id, 'gora'),
    },
    {
      etykieta: 'Przesun na koniec kolejki',
      ikona: <ArrowDownToLine className='h-4 w-4 text-akcent' />,
      akcja: () => przesunZlecenieWZamowieniu(zlecenie.id, 'koniec'),
    },
    {
      etykieta: 'Duplikuj',
      ikona: <Copy className='h-4 w-4 text-akcent' />,
      akcja: () => void duplikujZlecenie(zlecenie.id),
      wylaczone: operacjaZleceniaId === zlecenie.id,
    },
    {
      etykieta: zlecenie.aktywne ? 'Dezaktywuj' : 'Aktywuj',
      ikona: zlecenie.aktywne ? <EyeOff className='h-4 w-4 text-red-500' /> : <Eye className='h-4 w-4 text-emerald-500' />,
      akcja: () =>
        void zaktualizujZlecenieNaPodstawieSzczegolow(
          zlecenie.id,
          () => ({ aktywne: !zlecenie.aktywne }),
          zlecenie.aktywne
            ? 'Nie udalo sie dezaktywowac zlecenia produkcyjnego.'
            : 'Nie udalo sie aktywowac zlecenia produkcyjnego.'
        ),
      niebezpieczna: zlecenie.aktywne,
      wylaczone: operacjaZleceniaId === zlecenie.id,
    },
    {
      etykieta: 'Zakoncz',
      ikona: <Power className='h-4 w-4 text-red-500' />,
      akcja: () =>
        void zaktualizujZlecenieNaPodstawieSzczegolow(
          zlecenie.id,
          () => ({ status: 'GOTOWE' }),
          'Nie udalo sie zakonczyc zlecenia produkcyjnego.'
        ),
      niebezpieczna: true,
      wylaczone: operacjaZleceniaId === zlecenie.id || zlecenie.status === 'GOTOWE',
    },
    {
      etykieta: 'Usun',
      ikona: <Trash2 className='h-4 w-4 text-red-500' />,
      akcja: () => void usunZlecenie(zlecenie.id, zlecenie.numer),
      niebezpieczna: true,
      wylaczone: operacjaZleceniaId === zlecenie.id,
    },
  ];

  const pozycjaGlowna = zamowienie?.pozycje[0] ?? null;
  const produktGlowny = pozycjaGlowna?.produkt ?? null;
  const szczegolyProduktuGlownego = produktGlowny ? produkty[produktGlowny.id] : undefined;
  const uwagiZamowienia = rozdzielUwagi(zamowienie?.uwagi ?? null);
  const czyDostepnePodsumowanieZgrupowane =
    (zamowienie?.grupaId ?? null) !== null || (zamowienie?.zewnetrznyNumer?.toUpperCase().startsWith('ZK/') ?? false);
  const przejdzDoZamowieniaZgrupowanego = () => {
    if (!zamowienie?.zewnetrznyNumer || !czyDostepnePodsumowanieZgrupowane) {
      return;
    }

    navigate(`/zamowienia/zgrupowane?numer=${encodeURIComponent(zamowienie.zewnetrznyNumer)}`);
  };

  useEffect(() => {
    if (aktywnaZakladka === 'Podsumowanie zamowienia' && !czyDostepnePodsumowanieZgrupowane) {
      ustawAktywnaZakladke('Progres');
    }
  }, [aktywnaZakladka, czyDostepnePodsumowanieZgrupowane]);

  const finalneZlecenia = useMemo(() => {
    if (szczegolyZlecen.length === 0) {
      return [];
    }

    const koncowe = szczegolyZlecen.filter((zlecenie) => zlecenie.maszynaKoncowa);
    return koncowe.length > 0 ? koncowe : [szczegolyZlecen[szczegolyZlecen.length - 1]];
  }, [szczegolyZlecen]);

  const podsumowanie = useMemo(() => {
    const iloscZlecen = szczegolyZlecen.length;
    const gotoweZlecenia = szczegolyZlecen.filter((zlecenie) => zlecenie.status === 'GOTOWE').length;
    const produktyPlan = zamowienie?.pozycje.reduce((suma, pozycja) => suma + naLiczbe(pozycja.ilosc), 0) ?? 0;
    const produktyGotowe = finalneZlecenia.reduce((suma, zlecenie) => suma + naLiczbe(zlecenie.iloscWykonana), 0);
    const produktyWydane =
      zamowienie?.status === 'WYDANE' || zamowienie?.status === 'ZAMKNIETE'
        ? produktyPlan
        : 0;

    const sumaOperacji = szczegolyZlecen.reduce(
      (akumulator, zlecenie) => {
        const operacje = zlecenie.koszty.tabelaKosztow.find((wiersz) => wiersz.klucz === 'suma-operacje');
        const ustawianie = zlecenie.koszty.tabelaKosztow.find((wiersz) => wiersz.klucz === 'ustawianie');
        const maszyny = zlecenie.koszty.tabelaKosztow.find((wiersz) => wiersz.klucz === 'maszyny');
        const pracownicy = zlecenie.koszty.tabelaKosztow.find((wiersz) => wiersz.klucz === 'pracownicy');

        return {
          planowanyCzas: akumulator.planowanyCzas + naLiczbe(operacje?.planowanyCzas),
          zrealizowanyCzas: akumulator.zrealizowanyCzas + naLiczbe(operacje?.zrealizowanyCzas),
          planowanyKosztOperacji:
            akumulator.planowanyKosztOperacji + naLiczbe(operacje?.planowanyKoszt),
          zrealizowanyKosztOperacji:
            akumulator.zrealizowanyKosztOperacji + naLiczbe(operacje?.zrealizowanyKoszt),
          planowanyKosztMaszyn:
            akumulator.planowanyKosztMaszyn + naLiczbe(maszyny?.planowanyKoszt),
          zrealizowanyKosztMaszyn:
            akumulator.zrealizowanyKosztMaszyn + naLiczbe(maszyny?.zrealizowanyKoszt),
          planowanyKosztPracownikow:
            akumulator.planowanyKosztPracownikow + naLiczbe(pracownicy?.planowanyKoszt),
          zrealizowanyKosztPracownikow:
            akumulator.zrealizowanyKosztPracownikow + naLiczbe(pracownicy?.zrealizowanyKoszt),
          planowanyKosztUstawiania:
            akumulator.planowanyKosztUstawiania + naLiczbe(ustawianie?.planowanyKoszt),
          zrealizowanyKosztUstawiania:
            akumulator.zrealizowanyKosztUstawiania + naLiczbe(ustawianie?.zrealizowanyKoszt),
        };
      },
      {
        planowanyCzas: 0,
        zrealizowanyCzas: 0,
        planowanyKosztOperacji: 0,
        zrealizowanyKosztOperacji: 0,
        planowanyKosztMaszyn: 0,
        zrealizowanyKosztMaszyn: 0,
        planowanyKosztPracownikow: 0,
        zrealizowanyKosztPracownikow: 0,
        planowanyKosztUstawiania: 0,
        zrealizowanyKosztUstawiania: 0,
      }
    );

    const iloscDobregoProduktu = Math.max(
      0,
      finalneZlecenia.reduce(
        (suma, zlecenie) => suma + naLiczbe(zlecenie.iloscWykonana) - naLiczbe(zlecenie.iloscBrakow),
        0
      )
    );

    const agregacjaSurowcow = new Map<number, PodsumowanieSurowca>();

    zamowienie?.pozycje.forEach((pozycja) => {
      const szczegolyProduktu = produkty[pozycja.produktId];
      const iloscNaZamowienie = naLiczbe(pozycja.ilosc);
      const wspolczynnikRealizacji =
        produktyPlan > 0 ? Math.min(1, produktyGotowe / produktyPlan) : 0;

      szczegolyProduktu?.bomSurowcow.forEach((bom) => {
        const iloscBom = naLiczbe(bom.ilosc);
        const planowanaIlosc = iloscBom * iloscNaZamowienie;
        const zrealizowanaIlosc = planowanaIlosc * wspolczynnikRealizacji;
        const cena = naLiczbe(bom.surowiec.cena);

        const istniejacy = agregacjaSurowcow.get(bom.surowiec.id) ?? {
          klucz: bom.surowiec.id,
          nazwa: bom.surowiec.nazwa,
          jednostka: bom.surowiec.jednostka,
          iloscNaZamowienie: 0,
          iloscZuzyta: 0,
          planowanyKoszt: 0,
          zrealizowanyKoszt: 0,
          mozliwosciProdukcyjne: 0,
        };

        istniejacy.iloscNaZamowienie += planowanaIlosc;
        istniejacy.iloscZuzyta += zrealizowanaIlosc;
        istniejacy.planowanyKoszt += planowanaIlosc * cena;
        istniejacy.zrealizowanyKoszt += zrealizowanaIlosc * cena;
        istniejacy.mozliwosciProdukcyjne = Math.max(
          istniejacy.mozliwosciProdukcyjne,
          planowanaIlosc > 0 ? Math.floor((zrealizowanaIlosc / planowanaIlosc) * iloscNaZamowienie) : 0
        );

        agregacjaSurowcow.set(bom.surowiec.id, istniejacy);
      });
    });

    const surowce = [...agregacjaSurowcow.values()];
    const planowanyKosztSurowcow = surowce.reduce((suma, wiersz) => suma + wiersz.planowanyKoszt, 0);
    const zrealizowanyKosztSurowcow = surowce.reduce((suma, wiersz) => suma + wiersz.zrealizowanyKoszt, 0);

    const podsumowanieKosztow: PodsumowanieKosztow = {
      sumaOperacji: {
        klucz: 'suma-operacje',
        etykieta: 'Suma z maszyn/operacji',
        poziom: 0,
        suma: true,
        planowanyCzas: sumaOperacji.planowanyCzas,
        planowanyKoszt: sumaOperacji.planowanyKosztOperacji,
        zrealizowanyCzas: sumaOperacji.zrealizowanyCzas,
        zrealizowanyKoszt: sumaOperacji.zrealizowanyKosztOperacji,
      },
      sumaUstawiania: {
        klucz: 'ustawianie',
        etykieta: 'Suma z ustawiania maszyn',
        poziom: 0,
        suma: true,
        planowanyCzas: 0,
        planowanyKoszt: sumaOperacji.planowanyKosztUstawiania,
        zrealizowanyCzas: 0,
        zrealizowanyKoszt: sumaOperacji.zrealizowanyKosztUstawiania,
      },
      sumaLaczna: {
        klucz: 'suma-laczna',
        etykieta: 'Suma z maszyn/operacji + suma z ustawiania maszyn',
        poziom: 0,
        suma: true,
        planowanyCzas: sumaOperacji.planowanyCzas,
        planowanyKoszt:
          sumaOperacji.planowanyKosztOperacji + sumaOperacji.planowanyKosztUstawiania,
        zrealizowanyCzas: sumaOperacji.zrealizowanyCzas,
        zrealizowanyKoszt:
          sumaOperacji.zrealizowanyKosztOperacji + sumaOperacji.zrealizowanyKosztUstawiania,
      },
      kosztJednostkowy: {
        klucz: 'dobry-produkt',
        etykieta: 'Dla gotowego produktu',
        poziom: 0,
        planowanyCzas: produktyPlan > 0 ? sumaOperacji.planowanyCzas / produktyPlan : 0,
        planowanyKoszt:
          iloscDobregoProduktu > 0
            ? (sumaOperacji.planowanyKosztOperacji + sumaOperacji.planowanyKosztUstawiania) /
              iloscDobregoProduktu
            : 0,
        zrealizowanyCzas:
          iloscDobregoProduktu > 0 ? sumaOperacji.zrealizowanyCzas / iloscDobregoProduktu : 0,
        zrealizowanyKoszt:
          iloscDobregoProduktu > 0
            ? (sumaOperacji.zrealizowanyKosztOperacji + sumaOperacji.zrealizowanyKosztUstawiania) /
              iloscDobregoProduktu
            : 0,
      },
      surowce: {
        klucz: 'surowce',
        etykieta: 'Surowce',
        poziom: 0,
        suma: true,
        planowanyCzas: 0,
        planowanyKoszt: planowanyKosztSurowcow,
        zrealizowanyCzas: 0,
        zrealizowanyKoszt: zrealizowanyKosztSurowcow,
      },
      calkowity: {
        klucz: 'calkowity',
        etykieta: 'Calkowity koszt zamowienia',
        poziom: 0,
        suma: true,
        planowanyCzas: sumaOperacji.planowanyCzas,
        planowanyKoszt:
          sumaOperacji.planowanyKosztOperacji +
          sumaOperacji.planowanyKosztUstawiania +
          planowanyKosztSurowcow,
        zrealizowanyCzas: sumaOperacji.zrealizowanyCzas,
        zrealizowanyKoszt:
          sumaOperacji.zrealizowanyKosztOperacji +
          sumaOperacji.zrealizowanyKosztUstawiania +
          zrealizowanyKosztSurowcow,
      },
    };

    return {
      iloscZlecen,
      gotoweZlecenia,
      produktyPlan,
      produktyGotowe,
      produktyWydane,
      czasPlanowany: sumaOperacji.planowanyCzas,
      czasZrealizowany: sumaOperacji.zrealizowanyCzas,
      kosztMaszynPlan: sumaOperacji.planowanyKosztMaszyn,
      kosztMaszynReal: sumaOperacji.zrealizowanyKosztMaszyn,
      kosztPracownikowPlan: sumaOperacji.planowanyKosztPracownikow,
      kosztPracownikowReal: sumaOperacji.zrealizowanyKosztPracownikow,
      surowce,
      koszty: podsumowanieKosztow,
    };
  }, [finalneZlecenia, produkty, szczegolyZlecen, zamowienie]);

  const cenaJednostkowa = pozycjaGlowna?.cena != null ? naLiczbe(pozycjaGlowna.cena) : naLiczbe(produktGlowny?.cena);
  const waluta = produktGlowny?.waluta || 'PLN';
  const stawkaVat = produktGlowny?.stawkaVat ?? 23;

  useEffect(() => {
    if (!zamowienie) {
      return;
    }

    ustawFormularzEdycji({
      klientId: zamowienie.klient?.id ? String(zamowienie.klient.id) : '',
      status: zamowienie.status,
      zewnetrznyNumer: zamowienie.zewnetrznyNumer ?? '',
      ilosc: pozycjaGlowna ? String(naLiczbe(pozycjaGlowna.ilosc)) : '',
      jednostka: 'szt',
      oczekiwanaData: naDateInput(zamowienie.oczekiwanaData),
      terminPotwierdzony: '',
      dataWysylki: '',
      cena: cenaJednostkowa > 0 ? String(cenaJednostkowa) : '',
      stawkaVat: String(stawkaVat),
      waluta,
      uwagiWidoczne: uwagiZamowienia.widoczne,
      uwagiNiewidoczne: uwagiZamowienia.niewidoczne,
    });
    ustawBladZapisuEdycji('');
    ustawSukcesZapisuEdycji('');
  }, [
    cenaJednostkowa,
    pozycjaGlowna,
    stawkaVat,
    uwagiZamowienia.niewidoczne,
    uwagiZamowienia.widoczne,
    waluta,
    zamowienie,
  ]);

  const widokSurowcow = useMemo(() => {
    const mapaPodsumowania = new Map(podsumowanie.surowce.map((surowiec) => [surowiec.klucz, surowiec]));
    const zBomu: WidokSurowca[] =
      szczegolyProduktuGlownego?.bomSurowcow.map((bom) => {
        const podsumowanieSurowca = mapaPodsumowania.get(bom.surowiec.id);
        return {
          id: bom.surowiec.id,
          nazwa: bom.surowiec.nazwa,
          iloscNaProdukt: naLiczbe(bom.ilosc),
          iloscNaZamowienie: podsumowanieSurowca?.iloscNaZamowienie ?? 0,
          iloscZuzyta: podsumowanieSurowca?.iloscZuzyta ?? 0,
          jednostka: bom.surowiec.jednostka,
          cena: naLiczbe(bom.surowiec.cena),
          waluta: 'PLN',
          mozliwosciProdukcyjne: podsumowanieSurowca?.mozliwosciProdukcyjne ?? 0,
        };
      }) ?? [];

    const brakujace = podsumowanie.surowce
      .filter((surowiec) => !zBomu.some((wiersz) => wiersz.id === surowiec.klucz))
      .map((surowiec) => ({
        id: surowiec.klucz,
        nazwa: surowiec.nazwa,
        iloscNaProdukt: 0,
        iloscNaZamowienie: surowiec.iloscNaZamowienie,
        iloscZuzyta: surowiec.iloscZuzyta,
        jednostka: surowiec.jednostka,
        cena: surowiec.iloscNaZamowienie > 0 ? surowiec.planowanyKoszt / surowiec.iloscNaZamowienie : 0,
        waluta: 'PLN',
        mozliwosciProdukcyjne: surowiec.mozliwosciProdukcyjne,
      }));

    return [...zBomu, ...brakujace];
  }, [podsumowanie.surowce, szczegolyProduktuGlownego?.bomSurowcow]);

  const minimalneMozliwosciProdukcyjne = useMemo(() => {
    if (widokSurowcow.length === 0) {
      return 0;
    }

    return widokSurowcow.reduce(
      (minimum, surowiec) => Math.min(minimum, surowiec.mozliwosciProdukcyjne),
      widokSurowcow[0].mozliwosciProdukcyjne
    );
  }, [widokSurowcow]);

  const podsumowanieHistoriiPracy = useMemo(() => {
    const ilosc = historiaPracyWiersze.reduce((suma, wiersz) => suma + naLiczbe(wiersz.iloscWykonana), 0);
    const czasSekundy = historiaPracyWiersze.reduce((suma, wiersz) => suma + naLiczbe(wiersz.czasSekundy), 0);
    const czasBezPauzSekundy = historiaPracyWiersze.reduce(
      (suma, wiersz) => suma + naLiczbe(wiersz.czasBezPauzSekundy),
      0
    );
    const pauzaSekundy = historiaPracyWiersze.reduce((suma, wiersz) => suma + naLiczbe(wiersz.pauzaSekundy), 0);
    const braki = historiaPracyWiersze.reduce((suma, wiersz) => suma + naLiczbe(wiersz.braki), 0);
    const sredniaWydajnosc =
      historiaPracyWiersze.length > 0
        ? historiaPracyWiersze.reduce((suma, wiersz) => suma + naLiczbe(wiersz.wydajnoscProcent), 0) /
          historiaPracyWiersze.length
        : 0;
    const procentPauz = czasSekundy > 0 ? (pauzaSekundy / czasSekundy) * 100 : 0;

    return {
      ilosc,
      czasSekundy,
      czasBezPauzSekundy,
      pauzaSekundy,
      braki,
      sredniaWydajnosc,
      procentPauz,
    };
  }, [historiaPracyWiersze]);

  const widokWydan = useMemo<WidokWydania[]>(() => {
    const zApi = wydaniaMagazynowe.map((wydanie) => ({
      id: `api-${wydanie.id}`,
      idProdio: wydanie.zlecenie?.numer || zamowienie?.idProdio || '-',
      magazyn: wydanie.magazyn.nazwa,
      produktLubSurowiec: wydanie.surowiec.nazwa,
      ilosc: `${formatujLiczbe(wydanie.ilosc, 2)} ${wydanie.surowiec.jednostka}`,
      iloscZamowiona: pozycjaGlowna ? formatujLiczbe(naLiczbe(pozycjaGlowna.ilosc), 2) : '-',
      dostawcaLubKlient: zamowienie?.klient?.nazwa || 'Produkcja na magazyn',
      identyfikacja: wydanie.numer || '-',
      data: formatujDateGodzinePelna(wydanie.utworzonyW),
      cena: `${formatujLiczbe(wydanie.surowiec.cena)} ${wydanie.surowiec.waluta}`,
      uwagi: wydanie.uwagi || '-',
    }));

    return [...wydaniaRobocze, ...zApi];
  }, [pozycjaGlowna, wydaniaMagazynowe, wydaniaRobocze, zamowienie?.idProdio, zamowienie?.klient?.nazwa]);

  const widokPrzyjec = useMemo<WidokPrzyjecia[]>(() => {
    return przyjeciaRobocze;
  }, [przyjeciaRobocze]);

  const wpisyAktywnosci = useMemo<WpisAktywnosci[]>(() => {
    if (!zamowienie) {
      return wpisyAktywnosciLokalne;
    }

    const wpisySystemowe: WpisAktywnosci[] = [
      {
        id: `aktywnosc-start-${zamowienie.id}`,
        autor: 'System Prodio',
        opis: 'Utworzono to zamowienie',
        data: zamowienie.oczekiwanaData || new Date().toISOString(),
        wariant: 'system',
      },
    ];

    if (zamowienie.status !== 'NOWE') {
      wpisySystemowe.push({
        id: `aktywnosc-status-${zamowienie.id}-${zamowienie.status}`,
        autor: 'System Prodio',
        opis: `Zmieniono status zamowienia na ${ETYKIETY_STATUSU_ZAMOWIENIA[zamowienie.status]}`,
        data: zamowienie.oczekiwanaData || new Date().toISOString(),
        wariant: 'system',
      });
    }

    if (widokWydan.length > 0) {
      wpisySystemowe.push({
        id: `aktywnosc-wydania-${zamowienie.id}`,
        autor: 'Magazyn',
        opis: `Dodano ${widokWydan.length} dokument${widokWydan.length === 1 ? '' : widokWydan.length < 5 ? 'y' : 'ow'} wydania`,
        data: new Date().toISOString(),
        wariant: 'system',
      });
    }

    if (widokPrzyjec.length > 0) {
      wpisySystemowe.push({
        id: `aktywnosc-przyjecia-${zamowienie.id}`,
        autor: 'Magazyn',
        opis: `Dodano ${widokPrzyjec.length} dokument${widokPrzyjec.length === 1 ? '' : widokPrzyjec.length < 5 ? 'y' : 'ow'} przyjecia`,
        data: new Date().toISOString(),
        wariant: 'system',
      });
    }

    return [...wpisyAktywnosciLokalne, ...wpisySystemowe].sort(
      (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
    );
  }, [wpisyAktywnosciLokalne, widokPrzyjec.length, widokWydan.length, zamowienie]);

  const sumaPrzyjecia = useMemo(() => {
    return pozycjePrzyjecia.reduce(
      (suma, pozycja) => {
        const ilosc = Number(pozycja.iloscPrzyjmowana) || 0;
        const cena = Number(pozycja.cena) || 0;
        const vat = Number(pozycja.stawkaVat) || 0;
        const netto = ilosc * cena;
        const wartoscVat = netto * (vat / 100);
        const brutto = netto + wartoscVat;

        return {
          netto: suma.netto + netto,
          vat: suma.vat + wartoscVat,
          brutto: suma.brutto + brutto,
        };
      },
      { netto: 0, vat: 0, brutto: 0 }
    );
  }, [pozycjePrzyjecia]);

  const sumaWydania = useMemo(() => {
    return pozycjeWydania.reduce(
      (suma, pozycja) => {
        const ilosc = Number(pozycja.ilosc) || 0;
        const cena = Number(pozycja.cena) || 0;
        const vat = Number(pozycja.stawkaVat) || 0;
        const netto = ilosc * cena;
        const wartoscVat = netto * (vat / 100);
        const brutto = netto + wartoscVat;

        return {
          netto: suma.netto + netto,
          vat: suma.vat + wartoscVat,
          brutto: suma.brutto + brutto,
        };
      },
      { netto: 0, vat: 0, brutto: 0 }
    );
  }, [pozycjeWydania]);

  useEffect(() => {
    if (!zamowienie) {
      return;
    }

    ustawFormularzPrzyjecia({
      magazynId: '',
      data: formatujDateTimeDoInput(),
      typPrzyjecia: 'ZWROT_OD_KLIENTA',
      trybZamowienia: 'POJEDYNCZE',
      klient: zamowienie.klient?.nazwa || 'Klient niezdefiniowany',
      identyfikacja: zamowienie.zewnetrznyNumer || zamowienie.idProdio,
      uwagi: '',
    });

    ustawPozycjePrzyjecia(
      (zamowienie.pozycje.length > 0 ? zamowienie.pozycje : [pozycjaGlowna].filter(Boolean as never)).map((pozycja, indeks) => ({
        id: indeks + 1,
        nazwa: pozycja?.produkt?.nazwa || 'Produkt',
        prodioId: zamowienie.idProdio,
        iloscPrzyjmowana: String(naLiczbe(pozycja?.ilosc)),
        iloscZamowiona: String(naLiczbe(pozycja?.ilosc)),
        cena: String(naLiczbe(pozycja?.cena ?? pozycja?.produkt?.cena)),
        stawkaVat: String(pozycja?.produkt?.stawkaVat ?? 23),
        waluta: pozycja?.produkt?.waluta || 'PLN',
      }))
    );

    ustawFormularzWydania({
      magazynId: '',
      data: formatujDateTimeDoInput(),
      rodzajWydania: 'DO_KLIENTA',
      trybZamowienia: 'POJEDYNCZE',
      klient: zamowienie.klient?.nazwa || 'Produkcja na magazyn',
      identyfikacja: zamowienie.zewnetrznyNumer || zamowienie.idProdio,
      uwagi: '',
    });

    ustawPozycjeWydania(
      (zamowienie.pozycje.length > 0 ? zamowienie.pozycje : [pozycjaGlowna].filter(Boolean as never)).map((pozycja, indeks) => ({
        id: indeks + 1,
        nazwa: pozycja?.produkt?.nazwa || 'Produkt',
        prodioId: zamowienie.idProdio,
        ilosc: String(naLiczbe(pozycja?.ilosc)),
        iloscZamowiona: String(naLiczbe(pozycja?.ilosc)),
        cena: String(naLiczbe(pozycja?.cena ?? pozycja?.produkt?.cena)),
        stawkaVat: String(pozycja?.produkt?.stawkaVat ?? 23),
        waluta: pozycja?.produkt?.waluta || 'PLN',
      }))
    );
  }, [pozycjaGlowna, zamowienie]);

  if (ladowanie) {
    return (
      <div className='space-y-6'>
        <div className='rounded-[28px] border border-obramowanie bg-tlo-karta p-8 shadow-xl shadow-black/10'>
          <div className='animate-pulse space-y-4'>
            <div className='h-8 w-72 rounded-full bg-slate-700/60' />
            <div className='h-5 w-96 rounded-full bg-slate-700/40' />
            <div className='grid gap-4 md:grid-cols-4'>
              <div className='h-36 rounded-[24px] bg-slate-800/50' />
              <div className='h-36 rounded-[24px] bg-slate-800/50' />
              <div className='h-36 rounded-[24px] bg-slate-800/50' />
              <div className='h-36 rounded-[24px] bg-slate-800/50' />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (blad || !zamowienie) {
    return (
      <div className='rounded-[28px] border border-red-500/30 bg-red-500/10 p-8 text-red-100 shadow-xl shadow-black/10'>
        <div className='text-lg font-semibold'>{blad || 'Nie znaleziono zamowienia.'}</div>
        <button
          type='button'
          onClick={() => navigate('/zamowienia')}
          className='mt-5 inline-flex items-center gap-2 rounded-full border border-red-400/40 px-5 py-3 text-sm font-semibold transition hover:bg-red-500/10'
        >
          <ArrowLeft className='h-4 w-4' />
          Wroc do zamowien
        </button>
      </div>
    );
  }

  const kosztCalkowityPlan = podsumowanie.koszty.calkowity.planowanyKoszt;
  const kosztCalkowityReal = podsumowanie.koszty.calkowity.zrealizowanyKoszt;
  const kosztNaProduktPlan =
    podsumowanie.produktyPlan > 0 ? kosztCalkowityPlan / podsumowanie.produktyPlan : 0;
  const kosztNaProduktReal =
    podsumowanie.produktyGotowe > 0 ? kosztCalkowityReal / podsumowanie.produktyGotowe : 0;
  const wartoscNetto = zamowienie.pozycje.reduce((suma, pozycja) => {
    const cena = pozycja.cena != null ? naLiczbe(pozycja.cena) : naLiczbe(pozycja.produkt?.cena);
    return suma + cena * naLiczbe(pozycja.ilosc);
  }, 0);
  const wartoscBrutto = zamowienie.pozycje.reduce((suma, pozycja) => {
    const cena = pozycja.cena != null ? naLiczbe(pozycja.cena) : naLiczbe(pozycja.produkt?.cena);
    const vat = naLiczbe(pozycja.produkt?.stawkaVat ?? 23) / 100;
    return suma + cena * naLiczbe(pozycja.ilosc) * (1 + vat);
  }, 0);
  const pozostaleDniDoTerminu =
    zamowienie.oczekiwanaData && !Number.isNaN(new Date(zamowienie.oczekiwanaData).getTime())
      ? Math.ceil(
          (new Date(zamowienie.oczekiwanaData).getTime() - new Date().setHours(0, 0, 0, 0)) /
            (1000 * 60 * 60 * 24)
        )
      : null;
  const polaProduktu = [
    { etykieta: 'Grupa produktow', wartosc: szczegolyProduktuGlownego?.grupa?.nazwa || '-' },
    {
      etykieta: 'Dodatkowe oznaczenia',
      wartosc: szczegolyProduktuGlownego?.dodatkoweOznaczenia || produktGlowny?.dodatkoweOznaczenia || '-',
    },
    { etykieta: 'Wymiar', wartosc: szczegolyProduktuGlownego?.wymiar || produktGlowny?.wymiar || '-' },
    {
      etykieta: 'Sposob pakowania',
      wartosc: szczegolyProduktuGlownego?.sposobPakowania || produktGlowny?.sposobPakowania || '-',
    },
  ];

  const ustawPoleEdycji = (pole: keyof FormularzEdycjiZamowienia, wartosc: string) => {
    ustawFormularzEdycji((poprzedni) => ({ ...poprzedni, [pole]: wartosc }));
  };

  const zapiszWidokSurowcow = () => {
    ustawKomunikatSurowcow('Notatki i uklad zakladki Surowce zostaly zapisane w tej sesji.');
  };

  const resetujWidokSurowcow = () => {
    ustawNotatkiSurowcow({});
    ustawKomunikatSurowcow('Zakladka Surowce zostala przywrocona do stanu poczatkowego.');
  };

  const dodajPozycjePrzyjecia = () => {
    ustawPozycjePrzyjecia((poprzednie) => [
      ...poprzednie,
      {
        id: Date.now(),
        nazwa: produktGlowny?.nazwa || 'Nowa pozycja',
        prodioId: zamowienie?.idProdio || '',
        iloscPrzyjmowana: '',
        iloscZamowiona: '',
        cena: '',
        stawkaVat: '23',
        waluta: waluta || 'PLN',
      },
    ]);
  };

  const ustawPolePozycjiPrzyjecia = <K extends keyof PozycjaPrzyjeciaZamowienia>(
    idPozycji: number,
    klucz: K,
    wartosc: PozycjaPrzyjeciaZamowienia[K]
  ) => {
    ustawPozycjePrzyjecia((poprzednie) =>
      poprzednie.map((pozycja) => (pozycja.id === idPozycji ? { ...pozycja, [klucz]: wartosc } : pozycja))
    );
  };

  const usunPozycjePrzyjecia = (idPozycji: number) => {
    ustawPozycjePrzyjecia((poprzednie) =>
      poprzednie.length > 1 ? poprzednie.filter((pozycja) => pozycja.id !== idPozycji) : poprzednie
    );
  };

  const zapiszWidokPrzyjecia = () => {
    const nazwaMagazynu =
      magazyny.find((magazyn) => String(magazyn.id) === formularzPrzyjecia.magazynId)?.nazwa || 'Nie wybrano';

    const noweWiersze: WidokPrzyjecia[] = pozycjePrzyjecia.map((pozycja, indeks) => ({
      id: `draft-przyjecie-${Date.now()}-${indeks}`,
      idProdio: pozycja.prodioId || zamowienie?.idProdio || '-',
      magazyn: nazwaMagazynu,
      produktLubSurowiec: pozycja.nazwa,
      dostarczoneLubZamowione: formatujLiczbe(Number(pozycja.iloscPrzyjmowana) || 0, 2),
      iloscZamowiona: formatujLiczbe(Number(pozycja.iloscZamowiona) || 0, 2),
      dostawcaLubKlient: formularzPrzyjecia.klient,
      identyfikacja: formularzPrzyjecia.identyfikacja || '-',
      data: formatujDateGodzinePelna(formularzPrzyjecia.data),
      cena: `${formatujLiczbe(Number(pozycja.cena) || 0)} ${pozycja.waluta}`,
      uwagi: formularzPrzyjecia.uwagi || '-',
    }));

    ustawPrzyjeciaRobocze((poprzednie) => [...noweWiersze, ...poprzednie]);
    ustawCzyFormularzPrzyjeciaOtwarty(false);
    ustawKomunikatPrzyjecia('Widok przyjecia zostal zapisany w tej sesji.');
  };

  const dodajPozycjeWydania = () => {
    ustawPozycjeWydania((poprzednie) => [
      ...poprzednie,
      {
        id: Date.now(),
        nazwa: produktGlowny?.nazwa || 'Nowa pozycja',
        prodioId: zamowienie?.idProdio || '',
        ilosc: '',
        iloscZamowiona: '',
        cena: '',
        stawkaVat: '23',
        waluta: waluta || 'PLN',
      },
    ]);
  };

  const ustawPolePozycjiWydania = <K extends keyof PozycjaWydaniaZamowienia>(
    idPozycji: number,
    klucz: K,
    wartosc: PozycjaWydaniaZamowienia[K]
  ) => {
    ustawPozycjeWydania((poprzednie) =>
      poprzednie.map((pozycja) => (pozycja.id === idPozycji ? { ...pozycja, [klucz]: wartosc } : pozycja))
    );
  };

  const usunPozycjeWydania = (idPozycji: number) => {
    ustawPozycjeWydania((poprzednie) => (poprzednie.length > 1 ? poprzednie.filter((pozycja) => pozycja.id !== idPozycji) : poprzednie));
  };

  const zapiszWidokWydania = () => {
    const nazwaMagazynu =
      magazyny.find((magazyn) => String(magazyn.id) === formularzWydania.magazynId)?.nazwa || 'Nie wybrano';

    const noweWiersze: WidokWydania[] = pozycjeWydania.map((pozycja, indeks) => ({
      id: `draft-${Date.now()}-${indeks}`,
      idProdio: pozycja.prodioId || zamowienie?.idProdio || '-',
      magazyn: nazwaMagazynu,
      produktLubSurowiec: pozycja.nazwa,
      ilosc: `${formatujLiczbe(Number(pozycja.ilosc) || 0, 2)}`,
      iloscZamowiona: formatujLiczbe(Number(pozycja.iloscZamowiona) || 0, 2),
      dostawcaLubKlient: formularzWydania.klient,
      identyfikacja: formularzWydania.identyfikacja || '-',
      data: formatujDateGodzinePelna(formularzWydania.data),
      cena: `${formatujLiczbe(Number(pozycja.cena) || 0)} ${pozycja.waluta}`,
      uwagi: formularzWydania.uwagi || '-',
    }));

    ustawWydaniaRobocze((poprzednie) => [...noweWiersze, ...poprzednie]);
    ustawCzyFormularzWydaniaOtwarty(false);
    ustawKomunikatWydania('Widok wydania zostal zapisany w tej sesji.');
  };

  const dodajWpisAktywnosci = () => {
    const tresc = wiadomoscAktywnosci.trim();
    if (!tresc) {
      return;
    }

    ustawWpisyAktywnosciLokalne((poprzednie) => [
      {
        id: `aktywnosc-lokalna-${Date.now()}`,
        autor: 'Ty',
        opis: tresc,
        data: new Date().toISOString(),
        wariant: 'uzytkownik',
      },
      ...poprzednie,
    ]);
    ustawWiadomoscAktywnosci('');
  };

  const zapiszZakladkeEdycji = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!zamowienie) {
      return;
    }

    ustawZapisywanieEdycji(true);
    ustawBladZapisuEdycji('');
    ustawSukcesZapisuEdycji('');

    try {
      await klientApi.put(`/zamowienia/${zamowienie.id}`, {
        zewnetrznyNumer: formularzEdycji.zewnetrznyNumer.trim() || undefined,
        klientId: formularzEdycji.klientId || undefined,
        status: formularzEdycji.status,
        oczekiwanaData: formularzEdycji.oczekiwanaData || undefined,
        uwagi: polaczUwagi(formularzEdycji.uwagiWidoczne, formularzEdycji.uwagiNiewidoczne),
      });

      ustawZamowienie((poprzednie) =>
        poprzednie
          ? {
              ...poprzednie,
              zewnetrznyNumer: formularzEdycji.zewnetrznyNumer.trim() || null,
              status: formularzEdycji.status,
              oczekiwanaData: formularzEdycji.oczekiwanaData || null,
              klient: klienci.find((klient) => String(klient.id) === formularzEdycji.klientId) ?? null,
              uwagi: polaczUwagi(formularzEdycji.uwagiWidoczne, formularzEdycji.uwagiNiewidoczne) ?? null,
            }
          : poprzednie
      );
      ustawSukcesZapisuEdycji('Zmiany w zamowieniu zostaly zapisane.');
    } catch {
      ustawBladZapisuEdycji('Nie udalo sie zapisac zmian w zakladce Edytuj.');
    } finally {
      ustawZapisywanieEdycji(false);
    }
  };

  return (
    <div className='space-y-6'>
      <section className='rounded-[32px] border border-obramowanie bg-gradient-to-br from-[#243447] via-[#223142] to-[#172231] p-6 shadow-2xl shadow-black/20'>
        <div className='flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between'>
          <div className='space-y-5'>
            <div className='flex flex-wrap items-center gap-3 text-sm text-tekst-drugorzedny'>
              <Link
                to='/zamowienia'
                className='inline-flex items-center gap-2 rounded-full border border-obramowanie bg-tlo-glowne/40 px-4 py-2 transition hover:border-akcent hover:text-akcent'
              >
                <ArrowLeft className='h-4 w-4' />
                Wroc do listy
              </Link>
              <span className='rounded-full border border-obramowanie bg-tlo-glowne/40 px-4 py-2'>
                ID Prodio: {zamowienie.idProdio}
              </span>
            </div>

            <div className='flex flex-wrap items-start gap-4'>
              <div>
                <h1 className='text-3xl font-semibold text-tekst-glowny sm:text-4xl'>
                  Zamowienie {zamowienie.zewnetrznyNumer || zamowienie.idProdio}
                </h1>
                <div className='mt-2 text-sm text-tekst-drugorzedny'>
                  Widok postepu realizacji zamowienia wraz z kosztami i surowcami.
                </div>
              </div>
              <button
                type='button'
                className='inline-flex h-11 w-11 items-center justify-center rounded-full border border-obramowanie bg-tlo-glowne/50 text-tekst-drugorzedny transition hover:border-akcent hover:text-akcent'
                aria-label='Pomoc'
              >
                <HelpCircle className='h-5 w-5' />
              </button>
            </div>

            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
              <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/45 px-4 py-3'>
                <div className='flex items-center gap-2 text-sm text-tekst-drugorzedny'>
                  <Package className='h-4 w-4 text-akcent' />
                  Produkt
                </div>
                <div className='mt-2 text-sm font-medium text-tekst-glowny'>
                  {produktGlowny?.nazwa || 'Brak produktu'}
                </div>
              </div>
              <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/45 px-4 py-3'>
                <div className='flex items-center gap-2 text-sm text-tekst-drugorzedny'>
                  <Factory className='h-4 w-4 text-akcent' />
                  Klient
                </div>
                <div className='mt-2 text-sm font-medium text-tekst-glowny'>
                  {zamowienie.klient?.nazwa || 'Produkcja na magazyn'}
                </div>
              </div>
              <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/45 px-4 py-3'>
                <div className='flex items-center gap-2 text-sm text-tekst-drugorzedny'>
                  <UserRound className='h-4 w-4 text-akcent' />
                  Numer zewnetrzny
                </div>
                <div className='mt-2 text-sm font-medium text-tekst-glowny'>
                  {czyDostepnePodsumowanieZgrupowane && zamowienie.zewnetrznyNumer ? (
                    <button
                      type='button'
                      onClick={przejdzDoZamowieniaZgrupowanego}
                      className='border-b border-dashed border-akcent text-akcent transition hover:text-akcent-hover'
                    >
                      {zamowienie.zewnetrznyNumer}
                    </button>
                  ) : (
                    zamowienie.zewnetrznyNumer || '-'
                  )}
                </div>
              </div>
              <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/45 px-4 py-3'>
                <div className='flex items-center gap-2 text-sm text-tekst-drugorzedny'>
                  <CalendarDays className='h-4 w-4 text-akcent' />
                  Termin
                </div>
                <div className='mt-2 text-sm font-medium text-tekst-glowny'>
                  {formatujDate(zamowienie.oczekiwanaData)}
                </div>
              </div>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-3 xl:justify-end'>
            <StatusZamowieniaPill status={zamowienie.status} />
            <button
              type='button'
              onClick={() => window.print()}
              className='inline-flex h-11 items-center gap-2 rounded-full border border-obramowanie bg-tlo-glowne/50 px-5 text-sm font-semibold text-tekst-glowny transition hover:border-akcent hover:text-akcent'
            >
              <Printer className='h-4 w-4' />
              Drukuj
            </button>
            <button
              type='button'
              onClick={() => navigate('/zamowienia')}
              className='inline-flex h-11 items-center gap-2 rounded-full border border-obramowanie bg-tlo-glowne/50 px-5 text-sm font-semibold text-tekst-glowny transition hover:border-akcent hover:text-akcent'
            >
              <SquarePen className='h-4 w-4' />
              Lista zamowien
            </button>
          </div>
        </div>

        <div className='mt-8 flex flex-wrap items-center gap-2 border-b border-obramowanie/80 pb-1'>
          {ZAKLADKI.map((zakladka) => {
            const aktywna = zakladka === aktywnaZakladka;
            return (
              <button
                key={zakladka}
                type='button'
                onClick={() => ustawAktywnaZakladke(zakladka)}
                className={`rounded-t-2xl px-4 py-3 text-sm font-semibold transition ${
                  aktywna
                    ? 'border-b-2 border-emerald-400 text-tekst-glowny'
                    : 'text-tekst-drugorzedny hover:text-tekst-glowny'
                }`}
              >
                {zakladka}
              </button>
            );
          })}
          <div className='ml-auto flex items-center gap-3 px-2 text-sm text-tekst-drugorzedny'>
            <span className='rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200'>
              New
            </span>
            {czyDostepnePodsumowanieZgrupowane ? (
              <button
                type='button'
                onClick={przejdzDoZamowieniaZgrupowanego}
                className='rounded-t-2xl border-b-2 border-transparent px-2 py-3 text-sm font-semibold text-tekst-drugorzedny transition hover:text-tekst-glowny'
              >
                Podsumowanie: {zamowienie.zewnetrznyNumer || `${zamowienie.idProdio}/${new Date().getFullYear()}`}
              </button>
            ) : (
              <span>
                Podsumowanie: {zamowienie.idProdio}/{new Date().getFullYear()}
              </span>
            )}
            <button type='button' className='text-tekst-drugorzedny transition hover:text-akcent'>
              <MoreHorizontal className='h-5 w-5' />
            </button>
          </div>
        </div>
      </section>

      {aktywnaZakladka === 'Podglad' ? (
        <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/75 p-7 shadow-xl shadow-black/10'>
          <div className='space-y-8'>
            <SekcjaPodgladu
              ikona={<Info className='h-4 w-4' />}
              tytul='Szczegoly zamowienia'
              podtytul={
                <span className='inline-flex items-center gap-2 text-[18px] font-semibold text-tekst-glowny'>
                  <ClipboardList className='h-4 w-4 text-akcent' />
                  {zamowienie.zewnetrznyNumer || zamowienie.idProdio}
                </span>
              }
              lewa={
                <div>
                  <WierszPodgladu etykieta='Ilosc:' wartosc={formatujLiczbe(podsumowanie.produktyPlan, 0)} />
                  <WierszPodgladu etykieta='Klient:' wartosc={zamowienie.klient?.nazwa || 'Produkcja na magazyn'} />
                  <WierszPodgladu etykieta='Zew. nr zamowienia:' wartosc={zamowienie.zewnetrznyNumer || '-'} />
                  <WierszPodgladu
                    etykieta='Cena / Waluta / Stawka VAT:'
                    wartosc={`${formatujLiczbe(cenaJednostkowa)} / ${waluta} / ${stawkaVat}%`}
                  />
                  <WierszPodgladu
                    etykieta='Wartosc netto/brutto:'
                    wartosc={`${formatujLiczbe(wartoscNetto)} / ${formatujLiczbe(wartoscBrutto)}`}
                  />
                  <WierszPodgladu etykieta='Produkcja na magazyn' wartosc={zamowienie.klient ? '-' : '✓'} />
                  <div className='grid gap-4 border-b border-obramowanie/70 py-5 md:grid-cols-3'>
                    <div className='flex items-start gap-3'>
                      <CalendarDays className='mt-0.5 h-5 w-5 text-akcent' />
                      <div>
                        <div className='text-[15px] text-tekst-drugorzedny'>Oczekiwany termin realizacji:</div>
                        <div className='mt-2 text-[15px] font-semibold text-tekst-glowny'>{formatujDate(zamowienie.oczekiwanaData)}</div>
                      </div>
                    </div>
                    <div>
                      <div className='text-[15px] text-tekst-drugorzedny'>Termin potwierdzony:</div>
                      <div className='mt-2 text-[15px] font-semibold text-tekst-glowny'>-</div>
                    </div>
                    <div>
                      <div className='text-[15px] text-tekst-drugorzedny'>Zaplanowana data wysylki:</div>
                      <div className='mt-2 text-[15px] font-semibold text-tekst-glowny'>-</div>
                    </div>
                  </div>
                </div>
              }
              srodek={
                <div>
                  <div className='border-b border-obramowanie/70 pb-6 text-[18px] font-semibold text-tekst-glowny'>
                    Dodatkowe pola zamowienia
                  </div>
                </div>
              }
              prawa={
                <div className='space-y-6'>
                  <PanelPlikow tytul='Pliki do zamowienia' pustyTekst='' />
                  <PanelPlikow tytul='Zdjecia do zamowienia' pustyTekst='' />
                  <div className='space-y-8 pt-2'>
                    <div>
                      <div className='flex items-center gap-3 text-[18px] font-semibold text-tekst-glowny'>
                        <FileText className='h-4 w-4 text-akcent' />
                        Uwagi dla wszystkich
                      </div>
                      <div className='mt-5 text-[15px] text-tekst-drugorzedny'>{uwagiZamowienia.widoczne || '-'}</div>
                    </div>
                    <div>
                      <div className='flex items-center gap-3 text-[18px] font-semibold text-tekst-glowny'>
                        <EyeOff className='h-4 w-4 text-akcent' />
                        Uwagi niewidoczne dla produkcji
                      </div>
                      <div className='mt-5 text-[15px] text-tekst-drugorzedny'>{uwagiZamowienia.niewidoczne || '-'}</div>
                    </div>
                  </div>
                </div>
              }
            />

            <SekcjaPodgladu
              ikona={<Info className='h-4 w-4' />}
              tytul='Szczegoly produktu'
              podtytul={
                <span className='inline-flex items-center gap-2 text-[18px] font-semibold text-tekst-glowny'>
                  <Package className='h-4 w-4 text-akcent' />
                  {produktGlowny?.nazwa || 'Brak produktu'}
                </span>
              }
              lewa={
                <div>
                  <WierszPodgladu
                    etykieta='Grupa produktow:'
                    wartosc={szczegolyProduktuGlownego?.grupa?.nazwa || '-'}
                  />
                  <WierszPodgladu
                    etykieta='Dodatkowe oznaczenia:'
                    wartosc={szczegolyProduktuGlownego?.dodatkoweOznaczenia || produktGlowny?.dodatkoweOznaczenia || '-'}
                  />
                  <WierszPodgladu
                    etykieta='Wymiar:'
                    wartosc={szczegolyProduktuGlownego?.wymiar || produktGlowny?.wymiar || '-'}
                  />
                  <WierszPodgladu
                    etykieta='EAN:'
                    wartosc={szczegolyProduktuGlownego?.ean || produktGlowny?.ean || '-'}
                  />
                  <WierszPodgladu
                    etykieta='Sposob pakowania:'
                    wartosc={szczegolyProduktuGlownego?.sposobPakowania || produktGlowny?.sposobPakowania || '-'}
                  />
                </div>
              }
              srodek={
                <div>
                  <div className='border-b border-obramowanie/70 pb-6 text-[18px] font-semibold text-tekst-glowny'>
                    Dodatkowe pola produktu
                  </div>
                </div>
              }
              prawa={
                <div className='space-y-6'>
                  <PanelPlikow tytul='Pliki do produktu' pustyTekst='' />
                  <PanelPlikow
                    tytul='Zdjecia do produktu'
                    pustyTekst=''
                    dzieci={
                      szczegolyProduktuGlownego?.zdjecie || produktGlowny?.zdjecie ? (
                        <div className='flex items-center justify-between gap-4'>
                          <div>
                            <div className='text-[15px] font-medium text-tekst-glowny'>
                              {produktGlowny?.idProdio || 'obraz_produktu.jpg'}
                            </div>
                            <div className='mt-1 text-sm text-tekst-drugorzedny'>Podglad zdjecia produktu</div>
                          </div>
                          <div className='flex items-center gap-4'>
                            <img
                              src={szczegolyProduktuGlownego?.zdjecie || produktGlowny?.zdjecie || ''}
                              alt={produktGlowny?.nazwa || 'Zdjecie produktu'}
                              className='h-14 w-24 rounded border border-obramowanie bg-tlo-glowne/50 object-contain'
                            />
                            <a
                              href={szczegolyProduktuGlownego?.zdjecie || produktGlowny?.zdjecie || '#'}
                              target='_blank'
                              rel='noreferrer'
                              className='text-akcent transition hover:text-akcent-hover'
                              aria-label='Otworz zdjecie produktu'
                            >
                              <ImageIcon className='h-5 w-5' />
                            </a>
                          </div>
                        </div>
                      ) : undefined
                    }
                  />
                  <div className='space-y-8 pt-2'>
                    <div>
                      <div className='flex items-center gap-3 text-[18px] font-semibold text-tekst-glowny'>
                        <FileText className='h-4 w-4 text-akcent' />
                        Uwagi dla wszystkich
                      </div>
                      <div className='mt-5 text-[15px] text-tekst-drugorzedny'>
                        {szczegolyProduktuGlownego?.informacjeWidoczne || '-'}
                      </div>
                    </div>
                    <div>
                      <div className='flex items-center gap-3 text-[18px] font-semibold text-tekst-glowny'>
                        <EyeOff className='h-4 w-4 text-akcent' />
                        Uwagi niewidoczne dla produkcji
                      </div>
                      <div className='mt-5 text-[15px] text-tekst-drugorzedny'>
                        {szczegolyProduktuGlownego?.informacjeNiewidoczne || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              }
            />
          </div>
        </section>
      ) : aktywnaZakladka === 'Edytuj' ? (
        <form onSubmit={zapiszZakladkeEdycji} className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
          <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]'>
            <div className='space-y-6'>
              <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,1.1fr)_200px_140px]'>
                <PoleEdycji etykieta='Klient'>
                  <div className='relative'>
                    <select
                      value={formularzEdycji.klientId}
                      onChange={(event) => ustawPoleEdycji('klientId', event.target.value)}
                      className='h-12 w-full appearance-none rounded-xl border border-obramowanie bg-tlo-glowne px-4 pr-10 text-sm font-medium text-tekst-glowny outline-none transition focus:border-akcent'
                    >
                      <option value=''>Produkcja na magazyn</option>
                      {klienci.map((klient) => (
                        <option key={klient.id} value={String(klient.id)}>
                          {klient.nazwa}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tekst-drugorzedny' />
                  </div>
                </PoleEdycji>

                <PoleEdycji etykieta='Zew. nr zamowienia'>
                  <input
                    value={formularzEdycji.zewnetrznyNumer}
                    onChange={(event) => ustawPoleEdycji('zewnetrznyNumer', event.target.value)}
                    className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-semibold text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>

                <PoleEdycji etykieta='Ilosc' wymagane>
                  <input
                    value={formularzEdycji.ilosc}
                    onChange={(event) => ustawPoleEdycji('ilosc', event.target.value)}
                    className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-semibold text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>

                <PoleEdycji etykieta='Jednostka'>
                  <div className='relative'>
                    <input
                      value={formularzEdycji.jednostka}
                      onChange={(event) => ustawPoleEdycji('jednostka', event.target.value)}
                      className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 pr-10 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                    />
                    <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tekst-drugorzedny' />
                  </div>
                </PoleEdycji>
              </div>

              <div className='grid gap-4 md:grid-cols-3'>
                <PoleEdycji etykieta='Oczekiwany termin realizacji' wymagane>
                  <input
                    type='date'
                    value={formularzEdycji.oczekiwanaData}
                    onChange={(event) => ustawPoleEdycji('oczekiwanaData', event.target.value)}
                    className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-semibold text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>

                <PoleEdycji etykieta='Termin potwierdzony'>
                  <input
                    type='date'
                    value={formularzEdycji.terminPotwierdzony}
                    onChange={(event) => ustawPoleEdycji('terminPotwierdzony', event.target.value)}
                    className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>

                <PoleEdycji etykieta='Zaplanowana data wysylki'>
                  <input
                    type='date'
                    value={formularzEdycji.dataWysylki}
                    onChange={(event) => ustawPoleEdycji('dataWysylki', event.target.value)}
                    className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>
              </div>

              <div className='grid gap-4 md:grid-cols-3'>
                <PoleEdycji etykieta='Cena'>
                  <input
                    value={formularzEdycji.cena}
                    onChange={(event) => ustawPoleEdycji('cena', event.target.value)}
                    className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-semibold text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>

                <PoleEdycji etykieta='Stawka VAT'>
                  <div className='relative'>
                    <input
                      value={formularzEdycji.stawkaVat}
                      onChange={(event) => ustawPoleEdycji('stawkaVat', event.target.value)}
                      className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 pr-10 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                    />
                    <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tekst-drugorzedny' />
                  </div>
                </PoleEdycji>

                <PoleEdycji etykieta='Waluta'>
                  <div className='relative'>
                    <input
                      value={formularzEdycji.waluta}
                      onChange={(event) => ustawPoleEdycji('waluta', event.target.value)}
                      className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 pr-10 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                    />
                    <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tekst-drugorzedny' />
                  </div>
                </PoleEdycji>
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                <PoleEdycji etykieta='Uwagi dla wszystkich' wysokie>
                  <textarea
                    rows={6}
                    value={formularzEdycji.uwagiWidoczne}
                    onChange={(event) => ustawPoleEdycji('uwagiWidoczne', event.target.value)}
                    className='min-h-[180px] w-full resize-y rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>
                <PoleEdycji etykieta='Uwagi niewidoczne dla produkcji' wysokie>
                  <textarea
                    rows={6}
                    value={formularzEdycji.uwagiNiewidoczne}
                    onChange={(event) => ustawPoleEdycji('uwagiNiewidoczne', event.target.value)}
                    className='min-h-[180px] w-full resize-y rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>
              </div>
            </div>

            <div className='space-y-6'>
              <PanelEdycjiPlikow tytul='Pliki do zamowienia' />
              <PanelEdycjiPlikow tytul='Zdjecia do zamowienia' />
            </div>
          </div>

          <div className='mt-6 border-t border-obramowanie pt-6'>
            <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]'>
              <section>
                <div className='mb-5 flex items-center justify-between gap-3'>
                  <h2 className='text-[28px] font-semibold text-tekst-glowny'>Produkt</h2>
                </div>
                <div className='max-h-[430px] space-y-4 overflow-y-auto pr-2'>
                  {polaProduktu.map((pole) => (
                    <PoleEdycji key={pole.etykieta} etykieta={pole.etykieta}>
                      <input
                        value={pole.wartosc}
                        readOnly
                        className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-semibold text-tekst-glowny outline-none'
                      />
                    </PoleEdycji>
                  ))}
                </div>
              </section>

              <section>
                <div className='mb-5 flex items-center justify-between gap-3'>
                  <h2 className='text-[28px] font-semibold text-tekst-glowny'>Dodatkowe pola produktu</h2>
                  <button type='button' className='text-akcent transition hover:text-akcent-hover' aria-label='Edytuj dodatkowe pola produktu'>
                    <SquarePen className='h-4 w-4' />
                  </button>
                </div>
                <PustePoleDodatkowe tytul='Brak zdefiniowanych dodatkowych pol produktu.' />
              </section>

              <section>
                <div className='mb-5 flex items-center justify-between gap-3'>
                  <h2 className='text-[28px] font-semibold text-tekst-glowny'>Dodatkowe pola zamowienia</h2>
                  <button type='button' className='text-akcent transition hover:text-akcent-hover' aria-label='Edytuj dodatkowe pola zamowienia'>
                    <SquarePen className='h-4 w-4' />
                  </button>
                </div>
                <div className='space-y-4'>
                  <PoleEdycji etykieta='Status zamowienia'>
                    <div className='relative'>
                      <select
                        value={formularzEdycji.status}
                        onChange={(event) => ustawFormularzEdycji((poprzedni) => ({ ...poprzedni, status: event.target.value as StatusZamowienia }))}
                        className='h-12 w-full appearance-none rounded-xl border border-obramowanie bg-tlo-glowne px-4 pr-10 text-sm font-semibold text-tekst-glowny outline-none transition focus:border-akcent'
                      >
                        {Object.entries(ETYKIETY_STATUSU_ZAMOWIENIA).map(([wartosc, etykieta]) => (
                          <option key={wartosc} value={wartosc}>
                            {etykieta}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tekst-drugorzedny' />
                    </div>
                  </PoleEdycji>
                  <PustePoleDodatkowe tytul='Miejsce przygotowane pod dodatkowe pola zamowienia.' />
                </div>
              </section>
            </div>
          </div>

          {bladZapisuEdycji ? (
            <div className='mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
              {bladZapisuEdycji}
            </div>
          ) : null}
          {sukcesZapisuEdycji ? (
            <div className='mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200'>
              {sukcesZapisuEdycji}
            </div>
          ) : null}

          <div className='mt-8 flex justify-center'>
            <button
              type='submit'
              disabled={zapisywanieEdycji}
              className='inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full bg-emerald-500 px-8 py-4 text-base font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {zapisywanieEdycji ? (
                <>
                  <div className='h-4 w-4 animate-spin rounded-full border-b-2 border-white' />
                  Zapisywanie...
                </>
              ) : (
                <>
                  <Check className='h-5 w-5' />
                  Zapisz
                </>
              )}
            </button>
          </div>
        </form>
      ) : aktywnaZakladka === 'Historia pracy' ? (
        <section className='space-y-6'>
          <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
            <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <h2 className='text-2xl font-semibold text-tekst-glowny'>Historia pracy</h2>
                <div className='mt-1 text-sm text-tekst-drugorzedny'>
                  Rejestr wpisow pracy dla zlecen przypisanych do tego zamowienia.
                </div>
              </div>
              <div className='rounded-full border border-obramowanie bg-tlo-glowne px-4 py-2 text-sm text-tekst-drugorzedny'>
                Wpisy: <span className='font-semibold text-tekst-glowny'>{historiaPracyWiersze.length}</span>
              </div>
            </div>

            <div className='overflow-hidden rounded-[24px] border border-obramowanie'>
              <div className='overflow-x-auto'>
                <table className='min-w-[1540px] w-full text-sm'>
                  <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                    <tr>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Nr zlecenia</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Maszyna / Operacja</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Pracownik</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-right font-semibold'>Ilosc</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Czas</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Start</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Stop</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Pauza</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Wydajnosc</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-right font-semibold'>Braki</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Opis brakow</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-center font-semibold'>Operacja koncowa</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Uwagi</th>
                      <th className='border-b border-obramowanie px-4 py-4 text-center font-semibold'>Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historiaPracyWiersze.length === 0 ? (
                      <tr>
                        <td colSpan={14} className='px-6 py-12 text-center text-tekst-drugorzedny'>
                          Brak wpisow historii pracy dla tego zamowienia.
                        </td>
                      </tr>
                    ) : (
                      historiaPracyWiersze.map((wiersz) => {
                        const ostrzezenieWydajnosci = wiersz.wydajnoscProcent < 100;
                        const uwagi = [...wiersz.powodyPrzerw, ...wiersz.tagi].filter(Boolean).join(', ');

                        return (
                          <tr key={wiersz.id} className='odd:bg-tlo-glowne/25 even:bg-tlo-karta/20'>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <span className='border-b border-dashed border-akcent text-akcent'>{wiersz.numerZlecenia}</span>
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                              {wiersz.maszynaOperacja.nazwa}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <span className='border-b border-dashed border-akcent text-akcent'>{pobierzNazwePracownika(wiersz.pracownik)}</span>
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-right text-tekst-glowny'>
                              {formatujLiczbe(wiersz.iloscWykonana, 0)}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <div className='flex items-center gap-2 text-tekst-glowny'>
                                <span>{wiersz.formatowanyCzas || formatujSekundyCzasu(wiersz.czasSekundy)}</span>
                                {ostrzezenieWydajnosci ? <span className='font-bold text-red-300'>!</span> : null}
                              </div>
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                              {formatujDateGodzinePelna(wiersz.start)}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                              {formatujDateGodzinePelna(wiersz.stop)}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                              {wiersz.formatowanaPauza || formatujSekundyCzasu(wiersz.pauzaSekundy)}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <span className={wiersz.wydajnoscProcent >= 100 ? 'text-emerald-300' : 'text-red-300'}>
                                {wiersz.wydajnoscTekst || `${formatujLiczbe(wiersz.wydajnoscProcent)}%`}
                              </span>
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-right text-tekst-glowny'>
                              {formatujLiczbe(wiersz.braki, 0)}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-drugorzedny'>
                              {wiersz.opisBrakow || '-'}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-center'>
                              <span className={wiersz.operacjaKoncowa ? 'text-emerald-300' : 'text-red-300'}>
                                {wiersz.operacjaKoncowa ? '✓' : '✕'}
                              </span>
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-drugorzedny'>
                              {uwagi || '-'}
                            </td>
                            <td className='border-b border-obramowanie px-4 py-4 align-top text-center'>
                              <div className='flex items-center justify-center gap-3 text-akcent'>
                                <button
                                  type='button'
                                  className='transition hover:text-akcent-hover'
                                  aria-label={`Drukuj wpis ${wiersz.id}`}
                                >
                                  <Printer className='h-4 w-4' />
                                </button>
                                <button
                                  type='button'
                                  className='transition hover:text-akcent-hover'
                                  aria-label={`Edytuj wpis ${wiersz.id}`}
                                >
                                  <SquarePen className='h-4 w-4' />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {historiaPracyWiersze.length > 0 ? (
                      <tr className='bg-akcent text-white'>
                        <td className='border-r border-white/20 px-4 py-4 font-semibold'>Podsumowanie strony:</td>
                        <td className='border-r border-white/20 px-4 py-4' />
                        <td className='border-r border-white/20 px-4 py-4' />
                        <td className='border-r border-white/20 px-4 py-4 text-right font-semibold'>
                          {formatujLiczbe(podsumowanieHistoriiPracy.ilosc, 0)}
                        </td>
                        <td className='border-r border-white/20 px-4 py-4 font-semibold'>
                          <div>{formatujSekundyCzasu(podsumowanieHistoriiPracy.czasSekundy)}</div>
                          <div className='mt-1 text-xs text-orange-100'>
                            Czas bez pauz: {formatujSekundyCzasu(podsumowanieHistoriiPracy.czasBezPauzSekundy)}
                          </div>
                        </td>
                        <td className='border-r border-white/20 px-4 py-4' />
                        <td className='border-r border-white/20 px-4 py-4' />
                        <td className='border-r border-white/20 px-4 py-4 font-semibold'>
                          <div>{formatujSekundyCzasu(podsumowanieHistoriiPracy.pauzaSekundy)}</div>
                          <div className='mt-1 text-xs text-orange-100'>
                            Procent czasu pracy: {formatujLiczbe(podsumowanieHistoriiPracy.procentPauz)}%
                          </div>
                        </td>
                        <td className='border-r border-white/20 px-4 py-4 font-semibold'>
                          {formatujLiczbe(podsumowanieHistoriiPracy.sredniaWydajnosc)}
                        </td>
                        <td className='border-r border-white/20 px-4 py-4 text-right font-semibold'>
                          {formatujLiczbe(podsumowanieHistoriiPracy.braki, 0)}
                        </td>
                        <td className='border-r border-white/20 px-4 py-4' />
                        <td className='border-r border-white/20 px-4 py-4' />
                        <td className='border-r border-white/20 px-4 py-4' />
                        <td className='px-4 py-4' />
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </section>
      ) : aktywnaZakladka === 'Wydania' ? (
        <section className='space-y-6'>
          <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
            <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <h2 className='text-2xl font-semibold text-tekst-glowny'>Wydania magazynowe</h2>
                <div className='mt-1 text-sm text-tekst-drugorzedny'>
                  Zestawienie wydań dla tego zamówienia oraz szybki formularz dodawania dokumentu.
                </div>
              </div>
              <button
                type='button'
                onClick={() => {
                  ustawCzyFormularzWydaniaOtwarty(true);
                  ustawKomunikatWydania('');
                }}
                className='inline-flex items-center gap-2 rounded-full bg-akcent px-6 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover'
              >
                <Plus className='h-4 w-4' />
                Dodaj
              </button>
            </div>

            <div className='overflow-hidden rounded-[24px] border border-obramowanie'>
              <div className='overflow-x-auto'>
                <table className='min-w-[1320px] w-full text-sm'>
                  <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                    <tr>
                      {['ID Prodio', 'Magazyn', 'Produkt/surowiec', 'Ilość', 'Ilość zamówiona', 'Dostawca/Klient', 'Identyfikacja', 'Data', 'Cena', 'Uwagi'].map((etykieta) => (
                        <th key={etykieta} className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold last:border-r-0'>
                          {etykieta}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {widokWydan.length === 0 ? (
                      <tr>
                        <td colSpan={10} className='px-4 py-10 text-sm text-tekst-drugorzedny'>
                          <div className='flex items-center gap-3'>
                            <AlertTriangle className='h-5 w-5 text-akcent' />
                            Nie znaleziono danych
                          </div>
                        </td>
                      </tr>
                    ) : (
                      widokWydan.map((wiersz) => (
                        <tr key={wiersz.id} className='odd:bg-tlo-glowne/25 even:bg-tlo-karta/20'>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.idProdio}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.magazyn}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.produktLubSurowiec}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.ilosc}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.iloscZamowiona}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.dostawcaLubKlient}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.identyfikacja}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.data}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.cena}</td>
                          <td className='border-b border-obramowanie px-4 py-4 text-tekst-drugorzedny'>{wiersz.uwagi}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <Modal
            czyOtwarty={czyFormularzWydaniaOtwarty}
            onZamknij={() => ustawCzyFormularzWydaniaOtwarty(false)}
            tytul='Dodaj wydanie magazynowe'
            rozmiar='bardzoDuzy'
          >
            <div className='space-y-6'>
              <div className='grid gap-4 xl:grid-cols-4'>
                <PoleEdycji etykieta='Magazyn' wymagane>
                  <div className='relative'>
                    <select
                      value={formularzWydania.magazynId}
                      onChange={(event) => ustawFormularzWydania((poprzednie) => ({ ...poprzednie, magazynId: event.target.value }))}
                      className='h-12 w-full appearance-none rounded-xl border border-obramowanie bg-tlo-glowne px-4 pr-10 text-sm font-medium text-tekst-glowny outline-none transition focus:border-akcent'
                    >
                      <option value=''>Wybierz magazyn</option>
                      {magazyny.map((magazyn) => (
                        <option key={magazyn.id} value={String(magazyn.id)}>
                          {magazyn.nazwa}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tekst-drugorzedny' />
                  </div>
                </PoleEdycji>

                <PoleEdycji etykieta='Data' wymagane>
                  <input
                    type='datetime-local'
                    value={formularzWydania.data}
                    onChange={(event) => ustawFormularzWydania((poprzednie) => ({ ...poprzednie, data: event.target.value }))}
                    className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-semibold text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>

                <PoleEdycji etykieta='Rodzaj wydania' wymagane>
                  <div className='relative'>
                    <select
                      value={formularzWydania.rodzajWydania}
                      onChange={(event) => ustawFormularzWydania((poprzednie) => ({ ...poprzednie, rodzajWydania: event.target.value }))}
                      className='h-12 w-full appearance-none rounded-xl border border-obramowanie bg-tlo-glowne px-4 pr-10 text-sm font-medium text-tekst-glowny outline-none transition focus:border-akcent'
                    >
                      <option value='DO_KLIENTA'>Do klienta</option>
                      <option value='NA_PRODUKCJE'>Na produkcje</option>
                      <option value='ZWROT'>Zwrot</option>
                      <option value='INNE'>Inne</option>
                    </select>
                    <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tekst-drugorzedny' />
                  </div>
                </PoleEdycji>

                <PoleEdycji etykieta='Zamówienie'>
                  <div className='flex h-12 items-center gap-5 rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm text-tekst-glowny'>
                    <label className='inline-flex items-center gap-2'>
                      <input
                        type='radio'
                        checked={formularzWydania.trybZamowienia === 'POJEDYNCZE'}
                        onChange={() => ustawFormularzWydania((poprzednie) => ({ ...poprzednie, trybZamowienia: 'POJEDYNCZE' }))}
                        className='h-4 w-4 border-obramowanie bg-tlo-glowne text-akcent'
                      />
                      <span>Pojedyncze</span>
                    </label>
                    <label className='inline-flex items-center gap-2'>
                      <input
                        type='radio'
                        checked={formularzWydania.trybZamowienia === 'ZGRUPOWANE'}
                        onChange={() => ustawFormularzWydania((poprzednie) => ({ ...poprzednie, trybZamowienia: 'ZGRUPOWANE' }))}
                        className='h-4 w-4 border-obramowanie bg-tlo-glowne text-akcent'
                      />
                      <span>Zgrupowane</span>
                    </label>
                  </div>
                </PoleEdycji>

                <PoleEdycji etykieta='Zamówienie'>
                  <div className='flex h-12 items-center gap-3 rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm text-tekst-glowny'>
                    <span className='rounded-full bg-akcent/20 px-3 py-1 text-xs font-semibold text-akcent'>
                      {ETYKIETY_STATUSU_ZAMOWIENIA[zamowienie.status]}
                    </span>
                    <span>ID Prodio: {zamowienie.idProdio}</span>
                  </div>
                </PoleEdycji>

                <PoleEdycji etykieta='Klient'>
                  <input
                    value={formularzWydania.klient}
                    onChange={(event) => ustawFormularzWydania((poprzednie) => ({ ...poprzednie, klient: event.target.value }))}
                    className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-medium text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>

                <PoleEdycji etykieta='Identyfikacja'>
                  <input
                    value={formularzWydania.identyfikacja}
                    onChange={(event) => ustawFormularzWydania((poprzednie) => ({ ...poprzednie, identyfikacja: event.target.value }))}
                    className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-medium text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>
              </div>

              <div className='mt-6 overflow-hidden rounded-[24px] border border-obramowanie'>
                <div className='overflow-x-auto'>
                  <table className='min-w-[1180px] w-full text-sm'>
                    <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                      <tr>
                        {['Produkt/surowiec', 'Prodio ID zamówienia', 'Ilość', 'Ilość zamówiona', 'Cena', 'Stawka VAT', 'Waluta', 'Netto', 'Brutto', 'VAT', 'Akcje'].map((etykieta) => (
                          <th key={etykieta} className='border-b border-r border-obramowanie px-3 py-3 text-left font-semibold last:border-r-0'>
                            {etykieta}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pozycjeWydania.map((pozycja) => {
                        const ilosc = Number(pozycja.ilosc) || 0;
                        const cena = Number(pozycja.cena) || 0;
                        const vat = Number(pozycja.stawkaVat) || 0;
                        const netto = ilosc * cena;
                        const wartoscVat = netto * (vat / 100);
                        const brutto = netto + wartoscVat;

                        return (
                          <tr key={pozycja.id} className='border-b border-obramowanie/60 align-top last:border-b-0 odd:bg-tlo-glowne/25 even:bg-tlo-karta/20'>
                            <td className='px-3 py-3 min-w-[280px]'>
                              <input
                                value={pozycja.nazwa}
                                onChange={(event) => ustawPolePozycjiWydania(pozycja.id, 'nazwa', event.target.value)}
                                className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                              />
                            </td>
                            <td className='px-3 py-3 min-w-[180px]'>
                              <input
                                value={pozycja.prodioId}
                                onChange={(event) => ustawPolePozycjiWydania(pozycja.id, 'prodioId', event.target.value)}
                                className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                              />
                            </td>
                            <td className='px-3 py-3 min-w-[100px]'>
                              <input
                                value={pozycja.ilosc}
                                onChange={(event) => ustawPolePozycjiWydania(pozycja.id, 'ilosc', event.target.value)}
                                className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                              />
                            </td>
                            <td className='px-3 py-3 min-w-[120px]'>
                              <input
                                value={pozycja.iloscZamowiona}
                                onChange={(event) => ustawPolePozycjiWydania(pozycja.id, 'iloscZamowiona', event.target.value)}
                                className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                              />
                            </td>
                            <td className='px-3 py-3 min-w-[110px]'>
                              <input
                                value={pozycja.cena}
                                onChange={(event) => ustawPolePozycjiWydania(pozycja.id, 'cena', event.target.value)}
                                className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                              />
                            </td>
                            <td className='px-3 py-3 min-w-[110px]'>
                              <input
                                value={pozycja.stawkaVat}
                                onChange={(event) => ustawPolePozycjiWydania(pozycja.id, 'stawkaVat', event.target.value)}
                                className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                              />
                            </td>
                            <td className='px-3 py-3 text-tekst-glowny'>{pozycja.waluta}</td>
                            <td className='px-3 py-3 text-tekst-glowny'>{formatujLiczbe(netto)}</td>
                            <td className='px-3 py-3 text-tekst-glowny'>{formatujLiczbe(brutto)}</td>
                            <td className='px-3 py-3 text-tekst-glowny'>{formatujLiczbe(wartoscVat)}</td>
                            <td className='px-3 py-3'>
                              <div className='flex gap-2 text-akcent'>
                                <button type='button' className='transition hover:text-akcent-hover' aria-label='Edytuj pozycję'>
                                  <SquarePen className='h-4 w-4' />
                                </button>
                                <button
                                  type='button'
                                  onClick={() => usunPozycjeWydania(pozycja.id)}
                                  className='transition hover:text-red-300'
                                  aria-label='Usuń pozycję'
                                >
                                  <X className='h-4 w-4' />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className='mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]'>
                <div className='space-y-5'>
                  <div className='grid gap-4 md:grid-cols-2'>
                    <PanelEdycjiPlikow tytul='Pliki' />
                    <PanelEdycjiPlikow tytul='Obrazy' />
                  </div>
                  <PoleEdycji etykieta='Uwagi' wysokie>
                    <textarea
                      rows={5}
                      value={formularzWydania.uwagi}
                      onChange={(event) => ustawFormularzWydania((poprzednie) => ({ ...poprzednie, uwagi: event.target.value }))}
                      className='min-h-[150px] w-full resize-y rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                    />
                  </PoleEdycji>
                </div>

                <div className='space-y-4'>
                  <button
                    type='button'
                    onClick={dodajPozycjeWydania}
                    className='inline-flex items-center gap-2 rounded-full bg-akcent px-5 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover'
                  >
                    <Plus className='h-4 w-4' />
                    Dodaj pozycję
                  </button>

                  <div className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne'>
                    <table className='w-full text-sm'>
                      <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                        <tr>
                          <th className='border-b border-r border-obramowanie px-4 py-3 text-left font-semibold'>Waluta</th>
                          <th className='border-b border-r border-obramowanie px-4 py-3 text-right font-semibold'>Netto</th>
                          <th className='border-b border-r border-obramowanie px-4 py-3 text-right font-semibold'>Brutto</th>
                          <th className='border-b border-obramowanie px-4 py-3 text-right font-semibold'>VAT</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className='px-4 py-4 text-tekst-glowny'>{waluta}</td>
                          <td className='px-4 py-4 text-right text-tekst-glowny'>{formatujLiczbe(sumaWydania.netto)}</td>
                          <td className='px-4 py-4 text-right text-tekst-glowny'>{formatujLiczbe(sumaWydania.brutto)}</td>
                          <td className='px-4 py-4 text-right text-tekst-glowny'>{formatujLiczbe(sumaWydania.vat)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {komunikatWydania ? (
                <div className='rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200'>
                  {komunikatWydania}
                </div>
              ) : null}

              <div className='flex justify-center'>
                <button
                  type='button'
                  onClick={zapiszWidokWydania}
                  className='inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full bg-emerald-500 px-8 py-4 text-base font-semibold text-white transition hover:bg-emerald-400'
                >
                  <Check className='h-5 w-5' />
                  Zapisz
                </button>
              </div>
            </div>
          </Modal>
        </section>
      ) : aktywnaZakladka === 'Przyjecia' ? (
        <section className='space-y-6'>
          <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
            <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <h2 className='text-2xl font-semibold text-tekst-glowny'>Przyjecia magazynowe</h2>
                <div className='mt-1 text-sm text-tekst-drugorzedny'>
                  Zestawienie przyjec dla tego zamowienia oraz formularz dodawania dokumentu w osobnym oknie.
                </div>
              </div>
              <button
                type='button'
                onClick={() => {
                  ustawCzyFormularzPrzyjeciaOtwarty(true);
                  ustawKomunikatPrzyjecia('');
                }}
                className='inline-flex items-center gap-2 rounded-full bg-akcent px-6 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover'
              >
                <Plus className='h-4 w-4' />
                Dodaj
              </button>
            </div>

            <div className='overflow-hidden rounded-[24px] border border-obramowanie'>
              <div className='overflow-x-auto'>
                <table className='min-w-[1400px] w-full text-sm'>
                  <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                    <tr>
                      {['ID Prodio', 'Magazyn', 'Produkt/surowiec', 'Dostarczone/Zamowione', 'Ilosc zamowiona', 'Dostawca/Klient', 'Identyfikacja', 'Data', 'Cena', 'Uwagi'].map((etykieta) => (
                        <th key={etykieta} className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold last:border-r-0'>
                          {etykieta}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {widokPrzyjec.length === 0 ? (
                      <tr>
                        <td colSpan={10} className='px-4 py-10 text-sm text-tekst-drugorzedny'>
                          <div className='flex items-center gap-3'>
                            <AlertTriangle className='h-5 w-5 text-akcent' />
                            Nie znaleziono danych
                          </div>
                        </td>
                      </tr>
                    ) : (
                      widokPrzyjec.map((wiersz) => (
                        <tr key={wiersz.id} className='odd:bg-tlo-glowne/25 even:bg-tlo-karta/20'>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.idProdio}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.magazyn}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.produktLubSurowiec}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.dostarczoneLubZamowione}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.iloscZamowiona}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.dostawcaLubKlient}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.identyfikacja}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.data}</td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{wiersz.cena}</td>
                          <td className='border-b border-obramowanie px-4 py-4 text-tekst-drugorzedny'>{wiersz.uwagi}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {komunikatPrzyjecia ? (
              <div className='mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200'>
                {komunikatPrzyjecia}
              </div>
            ) : null}
          </section>

          <Modal
            czyOtwarty={czyFormularzPrzyjeciaOtwarty}
            onZamknij={() => ustawCzyFormularzPrzyjeciaOtwarty(false)}
            tytul='Dodaj przyjecie magazynowe'
            rozmiar='bardzoDuzy'
          >
            <div className='space-y-6'>
              <div className='grid gap-4 xl:grid-cols-4'>
                <PoleEdycji etykieta='Magazyn' wymagane>
                  <div className='relative'>
                    <select
                      value={formularzPrzyjecia.magazynId}
                      onChange={(event) => ustawFormularzPrzyjecia((poprzednie) => ({ ...poprzednie, magazynId: event.target.value }))}
                      className='h-12 w-full appearance-none rounded-xl border border-obramowanie bg-tlo-glowne px-4 pr-10 text-sm font-medium text-tekst-glowny outline-none transition focus:border-akcent'
                    >
                      <option value=''>Wybierz magazyn</option>
                      {magazyny.map((magazyn) => (
                        <option key={magazyn.id} value={String(magazyn.id)}>
                          {magazyn.nazwa}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tekst-drugorzedny' />
                  </div>
                </PoleEdycji>

                <PoleEdycji etykieta='Data' wymagane>
                  <input
                    type='datetime-local'
                    value={formularzPrzyjecia.data}
                    onChange={(event) => ustawFormularzPrzyjecia((poprzednie) => ({ ...poprzednie, data: event.target.value }))}
                    className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-semibold text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>

                <PoleEdycji etykieta='Typ przyjecia' wymagane>
                  <div className='relative'>
                    <select
                      value={formularzPrzyjecia.typPrzyjecia}
                      onChange={(event) => ustawFormularzPrzyjecia((poprzednie) => ({ ...poprzednie, typPrzyjecia: event.target.value }))}
                      className='h-12 w-full appearance-none rounded-xl border border-obramowanie bg-tlo-glowne px-4 pr-10 text-sm font-medium text-tekst-glowny outline-none transition focus:border-akcent'
                    >
                      <option value='ZWROT_OD_KLIENTA'>Zwrot od klienta</option>
                      <option value='OD_DOSTAWCY'>Od dostawcy</option>
                      <option value='Z_PRODUKCJI'>Z produkcji</option>
                      <option value='INNE'>Inne</option>
                    </select>
                    <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tekst-drugorzedny' />
                  </div>
                </PoleEdycji>

                <PoleEdycji etykieta='Zamowienie'>
                  <div className='flex h-12 items-center gap-5 rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm text-tekst-glowny'>
                    <label className='inline-flex items-center gap-2'>
                      <input
                        type='radio'
                        checked={formularzPrzyjecia.trybZamowienia === 'POJEDYNCZE'}
                        onChange={() => ustawFormularzPrzyjecia((poprzednie) => ({ ...poprzednie, trybZamowienia: 'POJEDYNCZE' }))}
                        className='h-4 w-4 border-obramowanie bg-tlo-glowne text-akcent'
                      />
                      <span>Pojedyncze</span>
                    </label>
                    <label className='inline-flex items-center gap-2'>
                      <input
                        type='radio'
                        checked={formularzPrzyjecia.trybZamowienia === 'ZGRUPOWANE'}
                        onChange={() => ustawFormularzPrzyjecia((poprzednie) => ({ ...poprzednie, trybZamowienia: 'ZGRUPOWANE' }))}
                        className='h-4 w-4 border-obramowanie bg-tlo-glowne text-akcent'
                      />
                      <span>Zgrupowane</span>
                    </label>
                  </div>
                </PoleEdycji>

                <PoleEdycji etykieta='Zamowienie'>
                  <div className='flex h-12 items-center gap-3 rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm text-tekst-glowny'>
                    <span className='rounded-full bg-akcent/20 px-3 py-1 text-xs font-semibold text-akcent'>
                      {ETYKIETY_STATUSU_ZAMOWIENIA[zamowienie.status]}
                    </span>
                    <span>ID Prodio: {zamowienie.idProdio}</span>
                  </div>
                </PoleEdycji>

                <PoleEdycji etykieta='Klient'>
                  <input
                    value={formularzPrzyjecia.klient}
                    onChange={(event) => ustawFormularzPrzyjecia((poprzednie) => ({ ...poprzednie, klient: event.target.value }))}
                    className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-medium text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>

                <PoleEdycji etykieta='Identyfikacja'>
                  <input
                    value={formularzPrzyjecia.identyfikacja}
                    onChange={(event) => ustawFormularzPrzyjecia((poprzednie) => ({ ...poprzednie, identyfikacja: event.target.value }))}
                    className='h-12 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-medium text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                </PoleEdycji>
              </div>

              <div className='overflow-hidden rounded-[24px] border border-obramowanie'>
                <div className='overflow-x-auto'>
                  <table className='min-w-[1260px] w-full text-sm'>
                    <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                      <tr>
                        {['Produkt/surowiec', 'Prodio ID zamowienia', 'Ilosc przyjmowana', 'Ilosc zamowiona', 'Cena', 'Stawka VAT', 'Waluta', 'Netto', 'Brutto', 'VAT', 'Akcje'].map((etykieta) => (
                          <th key={etykieta} className='border-b border-r border-obramowanie px-3 py-3 text-left font-semibold last:border-r-0'>
                            {etykieta}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pozycjePrzyjecia.map((pozycja) => {
                        const ilosc = Number(pozycja.iloscPrzyjmowana) || 0;
                        const cena = Number(pozycja.cena) || 0;
                        const vat = Number(pozycja.stawkaVat) || 0;
                        const netto = ilosc * cena;
                        const wartoscVat = netto * (vat / 100);
                        const brutto = netto + wartoscVat;

                        return (
                          <tr key={pozycja.id} className='border-b border-obramowanie/60 align-top last:border-b-0 odd:bg-tlo-glowne/25 even:bg-tlo-karta/20'>
                            <td className='min-w-[280px] px-3 py-3'>
                              <input
                                value={pozycja.nazwa}
                                onChange={(event) => ustawPolePozycjiPrzyjecia(pozycja.id, 'nazwa', event.target.value)}
                                className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                              />
                            </td>
                            <td className='min-w-[180px] px-3 py-3'>
                              <input
                                value={pozycja.prodioId}
                                onChange={(event) => ustawPolePozycjiPrzyjecia(pozycja.id, 'prodioId', event.target.value)}
                                className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                              />
                            </td>
                            <td className='min-w-[120px] px-3 py-3'>
                              <input
                                value={pozycja.iloscPrzyjmowana}
                                onChange={(event) => ustawPolePozycjiPrzyjecia(pozycja.id, 'iloscPrzyjmowana', event.target.value)}
                                className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                              />
                            </td>
                            <td className='min-w-[120px] px-3 py-3'>
                              <input
                                value={pozycja.iloscZamowiona}
                                onChange={(event) => ustawPolePozycjiPrzyjecia(pozycja.id, 'iloscZamowiona', event.target.value)}
                                className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                              />
                            </td>
                            <td className='min-w-[110px] px-3 py-3'>
                              <input
                                value={pozycja.cena}
                                onChange={(event) => ustawPolePozycjiPrzyjecia(pozycja.id, 'cena', event.target.value)}
                                className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                              />
                            </td>
                            <td className='min-w-[110px] px-3 py-3'>
                              <input
                                value={pozycja.stawkaVat}
                                onChange={(event) => ustawPolePozycjiPrzyjecia(pozycja.id, 'stawkaVat', event.target.value)}
                                className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                              />
                            </td>
                            <td className='px-3 py-3 text-tekst-glowny'>{pozycja.waluta}</td>
                            <td className='px-3 py-3 text-tekst-glowny'>{formatujLiczbe(netto)}</td>
                            <td className='px-3 py-3 text-tekst-glowny'>{formatujLiczbe(brutto)}</td>
                            <td className='px-3 py-3 text-tekst-glowny'>{formatujLiczbe(wartoscVat)}</td>
                            <td className='px-3 py-3'>
                              <div className='flex gap-2 text-akcent'>
                                <button type='button' className='transition hover:text-akcent-hover' aria-label='Edytuj pozycje przyjecia'>
                                  <SquarePen className='h-4 w-4' />
                                </button>
                                <button
                                  type='button'
                                  onClick={() => usunPozycjePrzyjecia(pozycja.id)}
                                  className='transition hover:text-red-300'
                                  aria-label='Usun pozycje przyjecia'
                                >
                                  <X className='h-4 w-4' />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]'>
                <div className='space-y-5'>
                  <div className='grid gap-4 md:grid-cols-2'>
                    <PanelEdycjiPlikow tytul='Pliki' />
                    <PanelEdycjiPlikow tytul='Obrazy' />
                  </div>
                  <PoleEdycji etykieta='Uwagi' wysokie>
                    <textarea
                      rows={5}
                      value={formularzPrzyjecia.uwagi}
                      onChange={(event) => ustawFormularzPrzyjecia((poprzednie) => ({ ...poprzednie, uwagi: event.target.value }))}
                      className='min-h-[150px] w-full resize-y rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                    />
                  </PoleEdycji>
                </div>

                <div className='space-y-4'>
                  <button
                    type='button'
                    onClick={dodajPozycjePrzyjecia}
                    className='inline-flex items-center gap-2 rounded-full bg-akcent px-5 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover'
                  >
                    <Plus className='h-4 w-4' />
                    Dodaj pozycje
                  </button>

                  <div className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne'>
                    <table className='w-full text-sm'>
                      <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                        <tr>
                          <th className='border-b border-r border-obramowanie px-4 py-3 text-left font-semibold'>Waluta</th>
                          <th className='border-b border-r border-obramowanie px-4 py-3 text-right font-semibold'>Netto</th>
                          <th className='border-b border-r border-obramowanie px-4 py-3 text-right font-semibold'>Brutto</th>
                          <th className='border-b border-obramowanie px-4 py-3 text-right font-semibold'>VAT</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className='px-4 py-4 text-tekst-glowny'>{waluta}</td>
                          <td className='px-4 py-4 text-right text-tekst-glowny'>{formatujLiczbe(sumaPrzyjecia.netto)}</td>
                          <td className='px-4 py-4 text-right text-tekst-glowny'>{formatujLiczbe(sumaPrzyjecia.brutto)}</td>
                          <td className='px-4 py-4 text-right text-tekst-glowny'>{formatujLiczbe(sumaPrzyjecia.vat)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className='flex justify-center'>
                <button
                  type='button'
                  onClick={zapiszWidokPrzyjecia}
                  className='inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full bg-emerald-500 px-8 py-4 text-base font-semibold text-white transition hover:bg-emerald-400'
                >
                  <Check className='h-5 w-5' />
                  Zapisz
                </button>
              </div>
            </div>
          </Modal>
        </section>
      ) : aktywnaZakladka === 'Aktywnosc' ? (
        <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/40 shadow-xl shadow-black/10'>
          <div className='grid min-h-[760px] xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.9fr)]'>
            <div className='flex min-h-[760px] flex-col justify-end border-b border-obramowanie/70 p-6 xl:border-b-0 xl:border-r'>
              <div className='mb-4 text-sm text-tekst-drugorzedny'>
                Wyslij wiadomosc do historii zmian tego zamowienia.
              </div>
              <div className='flex items-end gap-3'>
                <div className='flex-1 rounded-2xl border border-obramowanie bg-tlo-glowne/70 px-4 py-3 shadow-inner shadow-black/10'>
                  <label className='mb-2 block text-sm font-medium text-tekst-drugorzedny'>Wiadomosc</label>
                  <textarea
                    rows={2}
                    value={wiadomoscAktywnosci}
                    onChange={(event) => ustawWiadomoscAktywnosci(event.target.value)}
                    placeholder='Dodaj komentarz do zamowienia'
                    className='w-full resize-none bg-transparent text-sm text-tekst-glowny outline-none placeholder:text-tekst-drugorzedny/70'
                  />
                </div>
                <button
                  type='button'
                  onClick={dodajWpisAktywnosci}
                  className='inline-flex h-12 w-12 items-center justify-center rounded-full bg-akcent text-white transition hover:bg-akcent-hover'
                  aria-label='Wyslij wiadomosc'
                >
                  <span className='text-lg font-semibold'>{'>'}</span>
                </button>
              </div>
            </div>

            <aside className='border-obramowanie/70 bg-tlo-karta/75 p-6'>
              <div className='border-b border-obramowanie pb-4'>
                <h2 className='text-sm font-semibold uppercase tracking-[0.18em] text-tekst-glowny'>Historia zmian</h2>
              </div>

              <div className='mt-6 space-y-6'>
                {wpisyAktywnosci.length === 0 ? (
                  <div className='rounded-2xl border border-dashed border-obramowanie bg-tlo-glowne/30 p-6 text-sm text-tekst-drugorzedny'>
                    Brak wpisow aktywnosci dla tego zamowienia.
                  </div>
                ) : (
                  wpisyAktywnosci.map((wpis, indeks) => {
                    const poprzedni = wpisyAktywnosci[indeks - 1];
                    const pokazNaglowekDnia =
                      !poprzedni || formatujDateNaOsi(poprzedni.data) !== formatujDateNaOsi(wpis.data);

                    return (
                      <div key={wpis.id}>
                        {pokazNaglowekDnia ? (
                          <div className='mb-4 text-center text-sm text-tekst-drugorzedny'>{formatujDateNaOsi(wpis.data)}</div>
                        ) : null}

                        <div className='grid grid-cols-[26px_minmax(0,1fr)] gap-4'>
                          <div className='flex flex-col items-center'>
                            <span className='mt-1 h-4 w-4 rounded-full border border-obramowanie bg-tlo-glowne' />
                            {indeks !== wpisyAktywnosci.length - 1 ? (
                              <span className='mt-2 h-full min-h-[72px] w-px border-l border-dashed border-obramowanie/70' />
                            ) : null}
                          </div>

                          <article className='rounded-2xl border border-obramowanie bg-tlo-glowne/70 p-5 shadow-lg shadow-black/10'>
                            <div className='flex flex-wrap items-center gap-x-4 gap-y-2 text-sm'>
                              <span className='inline-flex items-center gap-2 font-semibold text-tekst-glowny'>
                                <UserRound className='h-4 w-4 text-akcent' />
                                {wpis.autor}
                              </span>
                              <span className='inline-flex items-center gap-2 font-medium text-akcent'>
                                <Activity className='h-4 w-4' />
                                {new Date(wpis.data).toLocaleTimeString('pl-PL', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                              <span className='inline-flex items-center gap-2 font-medium text-tekst-glowny'>
                                <CalendarDays className='h-4 w-4 text-akcent' />
                                {new Date(wpis.data).toLocaleDateString('sv-SE')}
                              </span>
                            </div>
                            <div className={`mt-4 text-[15px] ${wpis.wariant === 'uzytkownik' ? 'text-tekst-glowny' : 'text-tekst-drugorzedny'}`}>
                              {wpis.opis}
                            </div>
                          </article>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          </div>
        </section>
      ) : aktywnaZakladka === 'Surowce' ? (
        <section className='space-y-6'>
          <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
            <div className='flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between'>
              <div>
                <h2 className='text-2xl font-semibold text-tekst-glowny'>Surowce dla zamowienia</h2>
                <div className='mt-1 text-sm text-tekst-drugorzedny'>
                  Widok bazuje na BOM-ie produktu, kalkulacji zuzycia i aktualnym podsumowaniu produkcji.
                </div>
              </div>
              <div className='flex flex-wrap gap-3'>
                <PrzyciskAkcjiSurowce etykieta='Przypisz surowiec' ikona={<Boxes className='h-4 w-4' />} wariant='akcent' />
                <PrzyciskAkcjiSurowce etykieta='Nowy surowiec' ikona={<Plus className='h-4 w-4' />} />
                <PrzyciskAkcjiSurowce etykieta='Zaktualizuj produkt' ikona={<RefreshCcw className='h-4 w-4' />} />
                <PrzyciskAkcjiSurowce etykieta='Resetuj' ikona={<RefreshCcw className='h-4 w-4' />} onClick={resetujWidokSurowcow} />
              </div>
            </div>

            <div className='mt-6 overflow-hidden rounded-[24px] border border-obramowanie'>
              <div className='overflow-x-auto'>
                <table className='min-w-[1480px] w-full text-sm'>
                  <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                    <tr>
                      <th className='w-16 border-b border-r border-obramowanie px-4 py-4 text-center font-semibold'> </th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Surowiec</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Ilosc na produkt</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Cena</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Zamowiono</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Dostepny</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Stany surowca</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Notatki</th>
                      <th className='border-b border-obramowanie px-4 py-4 text-center font-semibold'>Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {widokSurowcow.length === 0 ? (
                      <tr>
                        <td colSpan={9} className='px-6 py-12 text-center text-tekst-drugorzedny'>
                          Brak surowcow powiazanych z produktem lub brak danych BOM.
                        </td>
                      </tr>
                    ) : (
                      widokSurowcow.map((surowiec) => {
                        const jestDostepny = surowiec.mozliwosciProdukcyjne > 0;
                        const procentZuzycia =
                          surowiec.iloscNaZamowienie > 0
                            ? Math.min(100, (surowiec.iloscZuzyta / surowiec.iloscNaZamowienie) * 100)
                            : 0;

                        return (
                          <tr key={surowiec.id} className='odd:bg-tlo-glowne/25 even:bg-tlo-karta/20'>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-center text-akcent'>
                              <GripVertical className='mx-auto h-5 w-5' />
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/60 px-4 py-4'>
                                <div className='flex items-center justify-between gap-3'>
                                  <div className='font-semibold text-tekst-glowny'>{surowiec.nazwa}</div>
                                  <div className='flex items-center gap-3 text-tekst-drugorzedny'>
                                    <X className='h-4 w-4' />
                                    <HelpCircle className='h-4 w-4 text-akcent' />
                                    <ChevronDown className='h-4 w-4' />
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/60 px-4 py-4'>
                                <div className='flex items-center justify-between gap-3 text-tekst-glowny'>
                                  <span className='text-xl font-semibold'>{formatujLiczbe(surowiec.iloscNaProdukt, surowiec.iloscNaProdukt < 1 ? 3 : 2)}</span>
                                  <span className='text-base'>{surowiec.jednostka}</span>
                                </div>
                              </div>
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/60 px-4 py-4'>
                                <div className='flex items-center justify-between gap-3 text-tekst-glowny'>
                                  <span className='text-xl font-semibold'>{formatujLiczbe(surowiec.cena)}</span>
                                  <span className='text-base'>{surowiec.waluta}</span>
                                </div>
                              </div>
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <IkonyStatusuSurowca aktywny={surowiec.iloscNaZamowienie > 0} />
                              <div className='mt-3 text-xs text-tekst-drugorzedny'>
                                Na zamowienie: <span className='font-semibold text-tekst-glowny'>{formatujLiczbe(surowiec.iloscNaZamowienie)}</span>
                              </div>
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <IkonyStatusuSurowca aktywny={jestDostepny} />
                              <div className='mt-3 text-xs text-tekst-drugorzedny'>
                                Mozliwosci: <span className={`font-semibold ${jestDostepny ? 'text-emerald-300' : 'text-red-300'}`}>{formatujLiczbe(surowiec.mozliwosciProdukcyjne, 0)}</span>
                              </div>
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <div className='space-y-2 text-[15px]'>
                                <div className='text-tekst-drugorzedny'>
                                  Na zamowienie:{' '}
                                  <span className='font-semibold text-tekst-glowny'>{formatujLiczbe(surowiec.iloscNaZamowienie)}</span>
                                </div>
                                <div className='text-tekst-drugorzedny'>
                                  Zuzyte:{' '}
                                  <span className='font-semibold text-akcent'>{formatujLiczbe(surowiec.iloscZuzyta)}</span>
                                </div>
                                <div className='text-tekst-drugorzedny'>
                                  Zuzycie: <span className='font-semibold text-tekst-glowny'>{formatujLiczbe(procentZuzycia, 0)}%</span>
                                </div>
                              </div>
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <textarea
                                rows={3}
                                value={notatkiSurowcow[surowiec.id] ?? ''}
                                onChange={(event) =>
                                  ustawNotatkiSurowcow((poprzednie) => ({
                                    ...poprzednie,
                                    [surowiec.id]: event.target.value,
                                  }))
                                }
                                className='min-h-[96px] w-full resize-y rounded-2xl border border-obramowanie bg-tlo-glowne/60 px-4 py-3 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                                placeholder='Notatki do surowca'
                              />
                            </td>
                            <td className='border-b border-obramowanie px-4 py-4 align-top text-center'>
                              <button
                                type='button'
                                className='inline-flex h-10 w-10 items-center justify-center rounded-full border border-obramowanie bg-tlo-glowne text-akcent transition hover:border-akcent hover:bg-akcent/10'
                                aria-label={`Akcje dla surowca ${surowiec.nazwa}`}
                              >
                                <MoreHorizontal className='h-4 w-4' />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
            <div className='mb-5'>
              <h2 className='text-2xl font-semibold text-tekst-glowny'>Podsumowanie surowcow</h2>
              <div className='mt-2 text-sm'>
                <span className={`${minimalneMozliwosciProdukcyjne > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  Mozliwosci produkcyjne {formatujLiczbe(minimalneMozliwosciProdukcyjne, 0)}
                </span>
              </div>
            </div>

            <div className='overflow-hidden rounded-[24px] border border-obramowanie'>
              <div className='overflow-x-auto'>
                <table className='min-w-[1320px] w-full text-sm'>
                  <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                    <tr>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Nazwa</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-right font-semibold'>Ilosc na zamowienie</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-right font-semibold'>Ilosc zuzyta</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Ilosc zuzyta / ilosc na zamowienie</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Jednostka</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Aktualny / planowany koszt zuzycia</th>
                      <th className='border-b border-obramowanie px-4 py-4 text-right font-semibold'>Mozliwosci produkcyjne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {podsumowanie.surowce.map((surowiec) => (
                      <tr key={surowiec.klucz} className='odd:bg-tlo-glowne/25 even:bg-tlo-karta/20'>
                        <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                          <span className='border-b border-dashed border-akcent text-akcent'>{surowiec.nazwa}</span>
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 text-right text-tekst-glowny'>
                          {formatujLiczbe(surowiec.iloscNaZamowienie)}
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 text-right'>
                          <span className='font-medium text-akcent'>{formatujLiczbe(surowiec.iloscZuzyta)}</span>
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4'>
                          <div className='text-tekst-glowny'>
                            {formatujLiczbe(surowiec.iloscZuzyta)} / {formatujLiczbe(surowiec.iloscNaZamowienie)}
                          </div>
                          <PasekPostepu wartosc={surowiec.iloscZuzyta} limit={Math.max(1, surowiec.iloscNaZamowienie)} kolor='zielony' />
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 text-tekst-glowny'>{surowiec.jednostka}</td>
                        <td className='border-b border-r border-obramowanie px-4 py-4'>
                          <div className='text-tekst-glowny'>
                            {formatujWalute(surowiec.zrealizowanyKoszt)} / {formatujWalute(surowiec.planowanyKoszt)}
                          </div>
                          <PasekPostepu wartosc={surowiec.zrealizowanyKoszt} limit={Math.max(1, surowiec.planowanyKoszt)} kolor='zielony' />
                        </td>
                        <td className='border-b border-obramowanie px-4 py-4 text-right'>
                          <span className={surowiec.mozliwosciProdukcyjne > 0 ? 'text-emerald-300' : 'text-red-300'}>
                            {formatujLiczbe(surowiec.mozliwosciProdukcyjne, 0)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {komunikatSurowcow ? (
              <div className='mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200'>
                {komunikatSurowcow}
              </div>
            ) : null}

            <div className='mt-8 flex justify-center'>
              <button
                type='button'
                onClick={zapiszWidokSurowcow}
                className='inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full bg-emerald-500 px-8 py-4 text-base font-semibold text-white transition hover:bg-emerald-400'
              >
                <Check className='h-5 w-5' />
                Zapisz
              </button>
            </div>
          </section>
        </section>
      ) : aktywnaZakladka === 'Progres' || aktywnaZakladka === 'Podsumowanie zamowienia' ? (
        <>
          <section className='grid gap-4 xl:grid-cols-4'>
            <KartaKpi
              ikona={<ClipboardList className='h-5 w-5' />}
              etykieta='Zlecenia (got./wszyst.)'
              wartosc={`${podsumowanie.gotoweZlecenia} / ${podsumowanie.iloscZlecen}`}
              pomocnicza='Zakonczone operacje w ramach zamowienia'
              pasek={podsumowanie.gotoweZlecenia}
              limit={Math.max(1, podsumowanie.iloscZlecen)}
            />
            <KartaKpi
              ikona={<Boxes className='h-5 w-5' />}
              etykieta='Produkty (got./wszyst.)'
              wartosc={`${formatujLiczbe(podsumowanie.produktyGotowe)} / ${formatujLiczbe(
                podsumowanie.produktyPlan
              )}`}
              pomocnicza='Postep na operacji koncowej'
              pasek={podsumowanie.produktyGotowe}
              limit={Math.max(1, podsumowanie.produktyPlan)}
            />
            <KartaKpi
              ikona={<Truck className='h-5 w-5' />}
              etykieta='Produkty (wyd./wszyst.)'
              wartosc={`${formatujLiczbe(podsumowanie.produktyWydane)} / ${formatujLiczbe(
                podsumowanie.produktyPlan
              )}`}
              pomocnicza='Wydania sa mapowane na status zamowienia'
              pasek={podsumowanie.produktyWydane}
              limit={Math.max(1, podsumowanie.produktyPlan)}
              kolorPaska='zielony'
            />
            <KartaKpi
              ikona={<Activity className='h-5 w-5' />}
              etykieta='Czas (pracy/norm.)'
              wartosc={`${formatujCzasZGodzin(podsumowanie.czasZrealizowany)} / ${formatujCzasZGodzin(
                podsumowanie.czasPlanowany
              )}`}
              pomocnicza='Rzeczywisty czas vs czas normatywny'
              pasek={podsumowanie.czasZrealizowany}
              limit={Math.max(0.0001, podsumowanie.czasPlanowany)}
              kolorPaska={podsumowanie.czasZrealizowany > podsumowanie.czasPlanowany ? 'czerwony' : 'pomaranczowy'}
            />
          </section>

          {aktywnaZakladka === 'Podsumowanie zamowienia' ? (
            <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
              <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <h2 className='text-2xl font-semibold text-tekst-glowny'>Zamowione produkty</h2>
                  <div className='mt-1 text-sm text-tekst-drugorzedny'>
                    Zbiorcze podsumowanie pozycji, postepu realizacji i wartosci zamowienia.
                  </div>
                </div>
              </div>

              <div className='overflow-hidden rounded-3xl border border-obramowanie'>
                <div className='overflow-x-auto'>
                  <table className='min-w-[1320px] w-full text-sm'>
                    <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                      <tr>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-center font-semibold'>Status</th>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>ID Prodio</th>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-center font-semibold'>Pozostalo dni</th>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Produkt</th>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Produkty (got./wsz.)</th>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Zlecenia (got./wsz.)</th>
                        <th className='border-b border-r border-obramowanie px-4 py-4 text-right font-semibold'>Suma netto</th>
                        <th className='border-b border-obramowanie px-4 py-4 text-left font-semibold'>Uwagi dla wszystkich</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zamowienie.pozycje.length === 0 ? (
                        <tr>
                          <td colSpan={8} className='px-6 py-10 text-center text-sm text-tekst-drugorzedny'>
                            Brak pozycji przypisanych do tego zamowienia.
                          </td>
                        </tr>
                      ) : (
                        zamowienie.pozycje.map((pozycja) => {
                          const cenaPozycji =
                            pozycja.cena != null ? naLiczbe(pozycja.cena) : naLiczbe(pozycja.produkt?.cena);
                          const sumaNettoPozycji = cenaPozycji * naLiczbe(pozycja.ilosc);

                          return (
                            <tr key={pozycja.id} className='odd:bg-tlo-glowne/35 even:bg-tlo-karta/20'>
                              <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-center'>
                                <StatusZamowieniaPill status={zamowienie.status} />
                              </td>
                              <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                                <span className='border-b border-dashed border-akcent text-akcent'>{zamowienie.idProdio}</span>
                              </td>
                              <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-center'>
                                <span
                                  className={
                                    pozostaleDniDoTerminu == null
                                      ? 'text-tekst-drugorzedny'
                                      : pozostaleDniDoTerminu < 0
                                        ? 'font-semibold text-red-300'
                                        : 'font-semibold text-emerald-300'
                                  }
                                >
                                  {pozostaleDniDoTerminu ?? '-'}
                                </span>
                              </td>
                              <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                                {pozycja.produkt?.nazwa || 'Produkt'}
                              </td>
                              <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                                <div className='text-tekst-glowny'>
                                  {formatujLiczbe(podsumowanie.produktyGotowe)} / {formatujLiczbe(podsumowanie.produktyPlan)}
                                </div>
                                <PasekPostepu
                                  wartosc={podsumowanie.produktyGotowe}
                                  limit={Math.max(1, podsumowanie.produktyPlan)}
                                  kolor='zielony'
                                />
                              </td>
                              <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                                <div className='text-tekst-glowny'>
                                  {podsumowanie.gotoweZlecenia} / {podsumowanie.iloscZlecen}
                                </div>
                                <PasekPostepu
                                  wartosc={podsumowanie.gotoweZlecenia}
                                  limit={Math.max(1, podsumowanie.iloscZlecen)}
                                  kolor='niebieski'
                                />
                              </td>
                              <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-right text-tekst-glowny'>
                                {formatujWalute(sumaNettoPozycji)}
                              </td>
                              <td className='border-b border-obramowanie px-4 py-4 align-top text-tekst-drugorzedny'>
                                {uwagiZamowienia.widoczne || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
            <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
              <div>
                <div className='flex flex-wrap items-center gap-4'>
                  <h2 className='text-2xl font-semibold text-tekst-glowny'>Zlecenia produkcyjne</h2>
                  {zamowienie ? (
                    <button
                      type='button'
                      onClick={() => navigate(`/zlecenia-produkcyjne?zamowienieId=${zamowienie.id}`)}
                      className='inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-akcent transition hover:text-akcent-hover'
                    >
                      <Pencil className='h-4 w-4' />
                      Edytuj
                    </button>
                  ) : null}
                </div>
                <div className='mt-1 text-sm text-tekst-drugorzedny'>
                  Szczegoly postepu dla operacji przypisanych do tego zamowienia.
                </div>
              </div>
              <button
                type='button'
                onClick={() => navigate('/zlecenia-produkcyjne')}
                className='inline-flex items-center gap-2 rounded-full border border-obramowanie bg-tlo-glowne px-5 py-3 text-sm font-semibold text-tekst-glowny transition hover:border-akcent hover:text-akcent'
              >
                <SquarePen className='h-4 w-4' />
                Otworz modul zlecen
              </button>
            </div>

            <div className='overflow-hidden rounded-3xl border border-obramowanie'>
              <div className='overflow-x-auto'>
                <table className='min-w-[1280px] w-full text-sm'>
                  <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                    <tr>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Status</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Maszyna/Operacja</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Nr zlecenia</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Planowany stop</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Produkty (got./wsz.)</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Brakowosc</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Czas pracy</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Normatywny czas</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Koszt maszyny/operacji</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Koszt pracownikow</th>
                      <th className='border-b border-obramowanie px-4 py-4 text-center font-semibold'>Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {szczegolyZlecen.length === 0 ? (
                      <tr>
                        <td colSpan={11} className='px-6 py-10 text-center text-sm text-tekst-drugorzedny'>
                          To zamowienie nie ma jeszcze przypisanych zlecen produkcyjnych.
                        </td>
                      </tr>
                    ) : (
                      szczegolyZlecen.map((zlecenie) => {
                        const kosztMaszyny = zlecenie.koszty.tabelaKosztow.find((wiersz) => wiersz.klucz === 'maszyny');
                        const kosztPracownikow = zlecenie.koszty.tabelaKosztow.find((wiersz) => wiersz.klucz === 'pracownicy');

                        return (
                          <tr key={zlecenie.id} className='odd:bg-tlo-glowne/35 even:bg-tlo-karta/20'>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <StatusZleceniaPill status={zlecenie.status} />
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                              {zlecenie.maszyna.nazwa}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <button
                                type='button'
                                onClick={() => navigate(`/zlecenia-produkcyjne/${zlecenie.id}`)}
                                className='border-b border-dashed border-akcent text-akcent transition hover:text-akcent-hover'
                              >
                                {zlecenie.numer}
                              </button>
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                              {formatujDateGodzine(zlecenie.planowanyStop)}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                              <div className='text-tekst-glowny'>
                                {formatujLiczbe(naLiczbe(zlecenie.iloscWykonana))} / {formatujLiczbe(naLiczbe(zlecenie.iloscPlan))}
                              </div>
                              <PasekPostepu wartosc={naLiczbe(zlecenie.iloscWykonana)} limit={Math.max(1, naLiczbe(zlecenie.iloscPlan))} kolor='zielony' />
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                              {formatujLiczbe(naLiczbe(zlecenie.iloscBrakow), 0)}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                              {formatujCzasZGodzin(zlecenie.koszty.kpi.czas.zrealizowanyGodziny)}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                              {formatujCzasZGodzin(zlecenie.koszty.kpi.czas.planowanyGodziny)}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                              {formatujWalute(naLiczbe(kosztMaszyny?.zrealizowanyKoszt))}
                            </td>
                            <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                              {formatujWalute(naLiczbe(kosztPracownikow?.zrealizowanyKoszt))}
                            </td>
                            <td className='border-b border-obramowanie px-4 py-4 align-top text-center'>
                              <MenuAkcji
                                elementy={elementyMenuZlecenia(zlecenie)}
                                otwarte={otwarteMenuZleceniaId === zlecenie.id}
                                onToggle={() => ustawOtwarteMenuZleceniaId((poprzednie) => (poprzednie === zlecenie.id ? null : zlecenie.id))}
                                onClose={() => ustawOtwarteMenuZleceniaId(null)}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
            <div className='mb-5'>
              <h2 className='text-2xl font-semibold text-tekst-glowny'>Podsumowanie surowcow</h2>
              <div className='mt-1 text-sm text-tekst-drugorzedny'>
                Kalkulacja na podstawie BOM-u produktu i aktualnego postepu operacji koncowej.
              </div>
            </div>

            <div className='overflow-hidden rounded-3xl border border-obramowanie'>
              <div className='overflow-x-auto'>
                <table className='min-w-[1280px] w-full text-sm'>
                  <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                    <tr>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Nazwa</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-right font-semibold'>Ilosc na zamowienie</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-right font-semibold'>Ilosc zuzyta</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-right font-semibold'>Ilosc zuzyta/ilosc na zamowienie</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Jednostka</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-right font-semibold'>Aktualny/Planowany koszt zuzycia</th>
                      <th className='border-b border-obramowanie px-4 py-4 text-right font-semibold'>Mozliwosci produkcyjne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {podsumowanie.surowce.length === 0 ? (
                      <tr>
                        <td colSpan={7} className='px-6 py-10 text-center text-sm text-tekst-drugorzedny'>
                          Brak BOM-u lub danych surowcowych dla pozycji tego zamowienia.
                        </td>
                      </tr>
                    ) : (
                      podsumowanie.surowce.map((surowiec) => (
                        <tr key={surowiec.klucz} className='odd:bg-tlo-glowne/35 even:bg-tlo-karta/20'>
                          <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                            <span className='border-b border-dashed border-akcent text-akcent'>{surowiec.nazwa}</span>
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-right align-top text-tekst-glowny'>
                            {formatujLiczbe(surowiec.iloscNaZamowienie)}
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-right align-top text-tekst-glowny'>
                            {formatujLiczbe(surowiec.iloscZuzyta)}
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                            <div className='text-right text-tekst-glowny'>
                              {formatujLiczbe(surowiec.iloscZuzyta)} / {formatujLiczbe(surowiec.iloscNaZamowienie)}
                            </div>
                            <PasekPostepu wartosc={surowiec.iloscZuzyta} limit={Math.max(1, surowiec.iloscNaZamowienie)} kolor='zielony' />
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                            {surowiec.jednostka}
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-right align-top'>
                            <div className='text-tekst-glowny'>
                              {formatujWalute(surowiec.zrealizowanyKoszt)} / {formatujWalute(surowiec.planowanyKoszt)}
                            </div>
                            <PasekPostepu wartosc={surowiec.zrealizowanyKoszt} limit={Math.max(1, surowiec.planowanyKoszt)} kolor='zielony' />
                          </td>
                          <td className='border-b border-obramowanie px-4 py-4 text-right align-top text-tekst-glowny'>
                            {formatujLiczbe(surowiec.mozliwosciProdukcyjne, 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className='grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]'>
            <article className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
              <h2 className='text-2xl font-semibold text-tekst-glowny'>Podsumowanie calosci</h2>

              <div className='mt-5 overflow-hidden rounded-3xl border border-obramowanie'>
                <table className='min-w-full text-sm'>
                  <thead className='bg-tlo-naglowek text-tekst-glowny'>
                    <tr>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Pozycja</th>
                      <th className='border-b border-r border-obramowanie px-4 py-4 text-center font-semibold' colSpan={2}>
                        Planowany
                      </th>
                      <th className='border-b border-obramowanie px-4 py-4 text-center font-semibold' colSpan={2}>
                        Zrealizowany
                      </th>
                    </tr>
                    <tr className='text-tekst-drugorzedny'>
                      <th className='border-b border-r border-obramowanie px-4 py-3' />
                      <th className='border-b border-r border-obramowanie px-4 py-3 text-center font-medium'>Czas</th>
                      <th className='border-b border-r border-obramowanie px-4 py-3 text-center font-medium'>Koszt</th>
                      <th className='border-b border-r border-obramowanie px-4 py-3 text-center font-medium'>Czas</th>
                      <th className='border-b border-obramowanie px-4 py-3 text-center font-medium'>Koszt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      podsumowanie.koszty.sumaOperacji,
                      {
                        klucz: 'maszyny-skladnik',
                        etykieta: '- W tym maszyny/operacje',
                        planowanyCzas: 0,
                        planowanyKoszt: podsumowanie.kosztMaszynPlan,
                        zrealizowanyCzas: 0,
                        zrealizowanyKoszt: podsumowanie.kosztMaszynReal,
                      },
                      {
                        klucz: 'pracownicy-skladnik',
                        etykieta: '- W tym pracownicy',
                        planowanyCzas: 0,
                        planowanyKoszt: podsumowanie.kosztPracownikowPlan,
                        zrealizowanyCzas: 0,
                        zrealizowanyKoszt: podsumowanie.kosztPracownikowReal,
                      },
                      podsumowanie.koszty.sumaUstawiania,
                      podsumowanie.koszty.sumaLaczna,
                      podsumowanie.koszty.kosztJednostkowy,
                      podsumowanie.koszty.surowce,
                      podsumowanie.koszty.calkowity,
                    ].map((wiersz) => {
                      const podswietlony = wiersz.klucz === 'calkowity';
                      return (
                        <tr key={wiersz.klucz} className={podswietlony ? 'bg-akcent text-white' : 'odd:bg-tlo-glowne/30'}>
                          <td className='border-b border-r border-obramowanie px-4 py-4 font-semibold'>
                            {wiersz.etykieta}
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-center'>
                            {wiersz.planowanyCzas > 0 ? formatujCzasZGodzin(wiersz.planowanyCzas) : '-'}
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-center'>
                            {formatujWalute(wiersz.planowanyKoszt)}
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 text-center'>
                            {wiersz.zrealizowanyCzas > 0 ? formatujCzasZGodzin(wiersz.zrealizowanyCzas) : '-'}
                          </td>
                          <td className='border-b border-obramowanie px-4 py-4 text-center font-semibold'>
                            {formatujWalute(wiersz.zrealizowanyKoszt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className='space-y-6'>
              <article className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
                <h2 className='text-2xl font-semibold text-tekst-glowny'>Dodatkowe koszty</h2>
                <div className='mt-4 rounded-3xl border border-dashed border-obramowanie bg-tlo-glowne/30 p-5 text-sm leading-6 text-tekst-drugorzedny'>
                  Sekcja jest przygotowana pod kolejne rozszerzenie. W tej wersji pokazujemy pelne podsumowanie produkcji i surowcow bez zapisu kosztow dodatkowych.
                </div>
                <div className='mt-5 flex flex-wrap gap-3'>
                  <button
                    type='button'
                    className='rounded-full bg-akcent/30 px-6 py-3 text-sm font-semibold text-orange-100 ring-1 ring-inset ring-akcent/40 transition hover:bg-akcent/40'
                  >
                    Zapisz
                  </button>
                  <button
                    type='button'
                    className='rounded-full bg-akcent px-6 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover'
                  >
                    Dodaj
                  </button>
                </div>
              </article>

              <article className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
                <h2 className='text-2xl font-semibold text-tekst-glowny'>Szybki podglad</h2>
                <div className='mt-4 space-y-4'>
                  <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/35 p-4'>
                    <div className='text-sm text-tekst-drugorzedny'>Koszt calkowity zamowienia</div>
                    <div className='mt-2 text-2xl font-semibold text-tekst-glowny'>
                      {formatujWalute(kosztCalkowityReal)}
                    </div>
                  </div>
                  <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/35 p-4'>
                    <div className='text-sm text-tekst-drugorzedny'>Koszt gotowego produktu</div>
                    <div className='mt-2 text-2xl font-semibold text-tekst-glowny'>
                      {formatujWalute(kosztNaProduktReal)}
                    </div>
                    <div className='mt-1 text-sm text-tekst-drugorzedny'>
                      Plan: {formatujWalute(kosztNaProduktPlan)}
                    </div>
                  </div>
                  <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/35 p-4 text-sm text-tekst-drugorzedny'>
                    <div className='flex items-center gap-2 text-tekst-glowny'>
                      <Package className='h-4 w-4 text-akcent' />
                      Pozycji w zamowieniu: {zamowienie.pozycje.length}
                    </div>
                    <div className='mt-2'>Uwagi: {zamowienie.uwagi?.trim() || 'Brak dodatkowych uwag.'}</div>
                  </div>
                </div>
              </article>
            </aside>
          </section>
        </>
      ) : null}
    </div>
  );
}
