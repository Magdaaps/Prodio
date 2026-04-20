import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowUp,
  ArrowDownToLine,
  CircleDot,
  Copy,
  ExternalLink,
  EyeOff,
  ListChecks,
  Pencil,
  Play,
  Plus,
  Power,
  Printer,
  Search,
  Settings2,
  Trash2,
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
};

type ZlecenieLista = {
  id: number;
  numer: string;
  status: StatusZlecenia;
  aktywne: boolean;
  iloscPlan: number;
  iloscWykonana: number;
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

function normalizuj(wartosc: string | null | undefined) {
  return String(wartosc ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function pobierzTekstStatusu(status: StatusZlecenia) {
  return STATUS_META[status]?.etykieta ?? status;
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

  useEffect(() => {
    if (!otwarte) {
      return;
    }

    const obsluzKlik = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', obsluzKlik);
    return () => document.removeEventListener('mousedown', obsluzKlik);
  }, [onClose, otwarte]);

  return (
    <div ref={ref} className='relative flex justify-center'>
      <button
        type='button'
        onClick={onToggle}
        className='inline-flex h-10 items-center justify-center px-2 text-lg font-bold tracking-[0.35em] text-akcent transition hover:text-akcent-hover'
        aria-label='Pokaz akcje'
      >
        <span aria-hidden='true'>...</span>
      </button>

      {otwarte ? (
        <div className='absolute right-0 top-11 z-30 w-[232px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl'>
          {elementy.map((element) => (
            <button
              key={element.etykieta}
              type='button'
              disabled={element.wylaczone}
              onClick={() => {
                element.akcja?.();
                onClose();
              }}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] transition ${
                element.wylaczone
                  ? 'cursor-not-allowed text-slate-400'
                  : element.niebezpieczna
                    ? 'text-red-500 hover:bg-red-50'
                    : 'text-slate-700 hover:bg-orange-50'
              }`}
            >
              <span className='shrink-0'>{element.ikona}</span>
              <span>{element.etykieta}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ZleceniaProdukcyjne() {
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
  const [czyModalEdycji, ustawCzyModalEdycji] = useState(false);
  const [edytowaneId, ustawEdytowaneId] = useState<number | null>(null);
  const [szczegoly, ustawSzczegoly] = useState<SzczegolyZlecenia | null>(null);
  const [formularz, ustawFormularz] = useState<FormularzEdycji>(domyslnyFormularzEdycji);
  const [bladFormularza, ustawBladFormularza] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [ladowanieSzczegolow, ustawLadowanieSzczegolow] = useState(false);
  const [operacjaId, ustawOperacjaId] = useState<number | null>(null);
  const [pokazPanelPlanowania, ustawPokazPanelPlanowania] = useState(false);
  const [szukajPlanowania, ustawSzukajPlanowania] = useState('');
  const [otwarteWynikiPlanowania, ustawOtwarteWynikiPlanowania] = useState(false);
  const [kandydatPlanowaniaId, ustawKandydatPlanowaniaId] = useState<number | null>(null);
  const [wybraneDoPlanowaniaIds, ustawWybraneDoPlanowaniaIds] = useState<number[]>([]);
  const refPlanowania = useRef<HTMLDivElement | null>(null);

  const opcjeStatusow = useMemo(
    () => STATUSY_ZLECEN.map((status) => ({ wartosc: status.wartosc, etykieta: status.etykieta })),
    []
  );

  const opcjeMaszyn = useMemo(
    () => maszynyOpcje.map((maszyna) => ({ wartosc: String(maszyna.id), etykieta: maszyna.nazwa })),
    [maszynyOpcje]
  );

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

  const pobierzSzczegolyJednorazowo = async (id: number) => {
    const odpowiedz = await klientApi.get<OdpowiedzApi<SzczegolyZlecenia>>(`/zlecenia-produkcyjne/${id}`);
    return odpowiedz.data.dane;
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
        przypisaniPracownicyIds: dane.przypisaniPracownicyIds ?? [],
        aktywne: dane.aktywne,
        maszynaKoncowa: dane.maszynaKoncowa,
        uwagi: dane.uwagi ?? '',
      });
    } catch {
      ustawBladFormularza('Nie udalo sie pobrac szczegolow zlecenia.');
      ustawSzczegoly(null);
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
        przypisaniPracownicyIds: formularz.przypisaniPracownicyIds,
        aktywne: formularz.aktywne,
        maszynaKoncowa: formularz.maszynaKoncowa,
        uwagi: formularz.uwagi,
      });

      ustawCzyModalEdycji(false);
      await pobierzListe();
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
        przypisaniPracownicyIds: dane.przypisaniPracownicyIds ?? [],
        aktywne: dane.aktywne,
        maszynaKoncowa: dane.maszynaKoncowa,
        uwagi: dane.uwagi ?? '',
        ...modyfikator(dane),
      });

      await pobierzListe();
    } catch {
      ustawBlad(bladOperacji);
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

      await pobierzListe();
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
      await pobierzListe();
    } catch {
      ustawBlad('Nie udalo sie usunac zlecenia produkcyjnego.');
    } finally {
      ustawOperacjaId(null);
    }
  };

  const przesunWiersz = (id: number, typ: 'gora' | 'koniec') => {
    ustawKolejnoscIds((poprzednie) => {
      const bezBiezacego = poprzednie.filter((elementId) => elementId !== id);
      if (typ === 'gora') {
        return [id, ...bezBiezacego];
      }
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
    void pobierzListe();
  }, [strona, iloscNaStrone, pokazNieaktywne, ukryjGotowe, kluczSortowania, kierunekSortowania]);

  useEffect(() => {
    void pobierzMaszyny();
  }, []);

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
      etykieta: 'Dezaktywuj',
      ikona: <EyeOff className='h-4 w-4 text-red-500' />,
      akcja: () =>
        void zaktualizujNaPodstawieSzczegolow(
          wiersz.id,
          () => ({ aktywne: false }),
          'Nie udalo sie dezaktywowac zlecenia produkcyjnego.'
        ),
      niebezpieczna: true,
      wylaczone: operacjaId === wiersz.id || !wiersz.aktywne,
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
      akcja: () =>
        window.open(
          `${window.location.origin}${window.location.pathname}?zlecenie=${wiersz.id}`,
          '_blank',
          'noopener,noreferrer'
        ),
    },
  ];

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
                        onClick={() => void otworzEdycje(wiersz.id)}
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
                      <span className='border-b border-dashed border-akcent'>{wiersz.idProdio}</span>
                    </td>
                    <td className='border-b border-r border-obramowanie px-4 py-4 align-middle text-akcent'>
                      <span className='border-b border-dashed border-akcent'>{wiersz.zewnetrznyNumer || '-'}</span>
                    </td>
                    <td className='border-b border-r border-obramowanie px-0 py-4 align-middle'>
                      <PasekPoprzednika poprzednik={wiersz.poprzednik} />
                    </td>
                    <td className='border-b border-r border-obramowanie px-4 py-4 align-middle text-akcent'>
                      <span className='border-b border-dashed border-akcent'>{wiersz.klient?.nazwa || '-'}</span>
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

          ustawCzyModalEdycji(false);
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
              onClick={() => ustawCzyModalEdycji(false)}
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
              <Pole
                etykieta='Planowany start'
                type='datetime-local'
                value={formularz.planowanyStart}
                onChange={(event) =>
                  ustawFormularz((poprzedni) => ({ ...poprzedni, planowanyStart: event.target.value }))
                }
              />
              <Pole
                etykieta='Planowany stop'
                type='datetime-local'
                value={formularz.planowanyStop}
                onChange={(event) =>
                  ustawFormularz((poprzedni) => ({ ...poprzedni, planowanyStop: event.target.value }))
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
