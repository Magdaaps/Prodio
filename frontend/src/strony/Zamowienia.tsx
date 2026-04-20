import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  Ban,
  CalendarDays,
  Copy,
  Download,
  ExternalLink,
  Eye,
  HelpCircle,
  MoreHorizontal,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import klientApi from '../api/klient';
import { useTabelaDanych } from '../hooki/useTabelaDanych';
import ImporterCsv from '../komponenty/ImporterCsv';
import type { OdpowiedzApi, StatusZamowienia } from '../typy/indeks';

type Klient = {
  id: number;
  nazwa: string;
};

type Produkt = {
  id: number;
  idProdio: string;
  nazwa: string;
  dodatkoweOznaczenia: string | null;
  cena: number | string | null;
  stawkaVat: number | null;
  zdjecie: string | null;
};

type PozycjaZamowienia = {
  id?: number;
  produktId: number;
  ilosc: number;
  cena: number | null;
  produkt: Produkt | null;
};

type Zamowienie = {
  id: number;
  idProdio: string;
  zewnetrznyNumer: string | null;
  status: StatusZamowienia;
  oczekiwanaData: string | null;
  uwagi: string | null;
  klientId: number | null;
  klient: Klient | null;
  pozycje: PozycjaZamowienia[];
};

type OdpowiedzListy<T> = OdpowiedzApi<T[]> & {
  lacznie: number;
  strona: number;
  iloscNaStrone: number;
};

type PozycjaFormularza = {
  id: string;
  produktId: string;
  ilosc: string;
  cena: string;
};

type FormularzZamowienia = {
  idProdio: string;
  zewnetrznyNumer: string;
  klientId: string;
  status: StatusZamowienia;
  oczekiwanaData: string;
  produkcjaNaMagazyn: boolean;
  uwagiDlaWszystkich: string;
  uwagiNiewidoczne: string;
  pozycje: PozycjaFormularza[];
};

type ElementMenuAkcji = {
  etykieta: string;
  ikona: ReactNode;
  akcja?: () => void;
  niebezpieczna?: boolean;
  wylaczone?: boolean;
};

const STATUSY_ZAMOWIEN: StatusZamowienia[] = [
  'NOWE',
  'W_REALIZACJI',
  'GOTOWE',
  'WYDANE',
  'ZAMKNIETE',
  'ANULOWANE',
  'WSTRZYMANE',
  'OCZEKUJE',
  'PRZETERMINOWANE',
];

const ETYKIETY_STATUSOW: Record<StatusZamowienia, string> = {
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

const KLASY_STATUSOW: Record<StatusZamowienia, string> = {
  NOWE: 'bg-slate-600 text-white',
  W_REALIZACJI: 'bg-akcent text-white',
  GOTOWE: 'bg-emerald-600 text-white',
  WYDANE: 'bg-teal-600 text-white',
  ZAMKNIETE: 'bg-slate-500 text-white',
  ANULOWANE: 'bg-rose-500 text-white',
  WSTRZYMANE: 'bg-amber-500 text-slate-950',
  OCZEKUJE: 'bg-akcent/80 text-white',
  PRZETERMINOWANE: 'bg-red-500 text-white',
};

const domyslnaPozycja = (): PozycjaFormularza => ({
  id: crypto.randomUUID(),
  produktId: '',
  ilosc: '1',
  cena: '',
});

const domyslnyFormularz = (): FormularzZamowienia => ({
  idProdio: '',
  zewnetrznyNumer: '',
  klientId: '',
  status: 'NOWE',
  oczekiwanaData: '',
  produkcjaNaMagazyn: false,
  uwagiDlaWszystkich: '',
  uwagiNiewidoczne: '',
  pozycje: [domyslnaPozycja()],
});

const KOLUMNY_IMPORTU = [
  { klucz: 'idProdio', etykieta: 'ID Prodio', wymagany: true },
  { klucz: 'zewnetrznyNumer', etykieta: 'Zewnetrzny numer', wymagany: false },
  { klucz: 'status', etykieta: 'Status', wymagany: false },
  { klucz: 'oczekiwanaData', etykieta: 'Oczekiwana data', wymagany: false },
  { klucz: 'uwagi', etykieta: 'Uwagi', wymagany: false },
];

const formatujDate = (wartosc: string | null) => {
  if (!wartosc) {
    return '-';
  }

  const data = new Date(wartosc);

  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toISOString().slice(0, 10);
};

const naDateInput = (wartosc: string | null) => {
  if (!wartosc) {
    return '';
  }

  const data = new Date(wartosc);

  if (Number.isNaN(data.getTime())) {
    return '';
  }

  return data.toISOString().slice(0, 10);
};

const pobierzDatePliku = () => {
  const data = new Date();
  const rok = data.getFullYear();
  const miesiac = String(data.getMonth() + 1).padStart(2, '0');
  const dzien = String(data.getDate()).padStart(2, '0');

  return `${rok}-${miesiac}-${dzien}`;
};

const naLiczbe = (wartosc: number | string | null | undefined) => {
  const liczba = Number(wartosc ?? 0);
  return Number.isFinite(liczba) ? liczba : 0;
};

const formatujWalute = (wartosc: number) =>
  new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(wartosc);

const obliczDniPozostale = (wartosc: string | null) => {
  if (!wartosc) {
    return null;
  }

  const data = new Date(wartosc);
  const dzisiaj = new Date();
  dzisiaj.setHours(0, 0, 0, 0);
  data.setHours(0, 0, 0, 0);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  return Math.round((data.getTime() - dzisiaj.getTime()) / 86400000);
};

const wyciagnijUwagi = (uwagi: string | null) => {
  if (!uwagi) {
    return { widoczne: '', niewidoczne: '' };
  }

  const znacznik = '\n\n---\nUwagi niewidoczne dla produkcji:\n';

  if (!uwagi.includes(znacznik)) {
    return { widoczne: uwagi, niewidoczne: '' };
  }

  const [widoczne, niewidoczne] = uwagi.split(znacznik);

  return {
    widoczne: widoczne.replace(/^Uwagi dla wszystkich:\n/, ''),
    niewidoczne: niewidoczne ?? '',
  };
};

const polaczUwagi = (widoczne: string, niewidoczne: string) => {
  const sekcje = [];

  if (widoczne.trim()) {
    sekcje.push(`Uwagi dla wszystkich:\n${widoczne.trim()}`);
  }

  if (niewidoczne.trim()) {
    sekcje.push(`Uwagi niewidoczne dla produkcji:\n${niewidoczne.trim()}`);
  }

  return sekcje.join('\n\n---\n') || undefined;
};

function Przelacznik({
  aktywny,
  onZmiana,
}: {
  aktywny: boolean;
  onZmiana: (wartosc: boolean) => void;
}) {
  return (
    <button
      type='button'
      onClick={() => onZmiana(!aktywny)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        aktywny ? 'bg-akcent' : 'bg-obramowanie'
      }`}
      aria-pressed={aktywny}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          aktywny ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function PoleFormularza({
  etykieta,
  children,
}: {
  etykieta: string;
  children: ReactNode;
}) {
  return (
    <label className='block'>
      <span className='mb-2 block text-sm font-medium text-tekst-drugorzedny'>{etykieta}</span>
      {children}
    </label>
  );
}

function PanelUpload({ tytul }: { tytul: string }) {
  return (
    <div className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne shadow-sm'>
      <div className='flex items-center justify-between bg-tlo-naglowek px-4 py-3 text-sm font-semibold text-tekst-glowny'>
        <span>{tytul}</span>
        <Plus className='h-4 w-4 text-akcent' />
      </div>
      <div className='h-28 bg-tlo-glowne' />
    </div>
  );
}

const klasyPolaModala =
  'h-12 w-full rounded-2xl border border-obramowanie bg-tlo-glowne px-4 text-sm text-tekst-glowny transition-colors focus:border-akcent focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed';

const klasyPolaWTabeli =
  'h-12 w-full rounded-2xl border border-obramowanie bg-tlo-karta px-4 text-sm text-tekst-glowny transition-colors focus:border-akcent focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed';

const klasyTextareaModala =
  'w-full rounded-2xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny transition-colors focus:border-akcent focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed';

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

    return () => {
      document.removeEventListener('mousedown', obsluzKlik);
    };
  }, [otwarte, onClose]);

  return (
    <div ref={ref} className='relative flex justify-center'>
      <button
        type='button'
        onClick={onToggle}
        className='flex h-10 w-10 items-center justify-center rounded-full border border-obramowanie bg-tlo-glowne text-akcent transition hover:border-akcent hover:bg-akcent/10'
      >
        <MoreHorizontal className='h-5 w-5' />
      </button>

      {otwarte ? (
        <div className='absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-lg border border-obramowanie bg-tlo-karta shadow-xl'>
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
        </div>
      ) : null}
    </div>
  );
}

export default function Zamowienia() {
  const {
    strona,
    iloscNaStrone,
    kluczSortowania,
    kierunekSortowania,
    onZmianaStrony,
    onSortowanie,
    resetujStrone,
  } = useTabelaDanych(20);

  const [zamowienia, ustawZamowienia] = useState<Zamowienie[]>([]);
  const [klienci, ustawKlientow] = useState<Klient[]>([]);
  const [produkty, ustawProdukty] = useState<Produkt[]>([]);
  const [lacznie, ustawLacznie] = useState(0);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [ladowanieSlownikow, ustawLadowanieSlownikow] = useState(true);
  const [szukaj, ustawSzukaj] = useState('');
  const [statusFiltra, ustawStatusFiltra] = useState('');
  const [blad, ustawBlad] = useState('');
  const [czyModalOtwarty, ustawCzyModalOtwarty] = useState(false);
  const [trybModalu, ustawTrybModalu] = useState<'dodawanie' | 'edycja' | 'podglad'>('dodawanie');
  const [edytowaneId, ustawEdytowaneId] = useState<number | null>(null);
  const [formularz, ustawFormularz] = useState<FormularzZamowienia>(domyslnyFormularz);
  const [bladFormularza, ustawBladFormularza] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [usuwaneId, ustawUsuwaneId] = useState<number | null>(null);
  const [pokazImporter, ustawPokazImporter] = useState(false);
  const [otwarteMenuId, ustawOtwarteMenuId] = useState<number | null>(null);

  const liczbaStron = Math.max(1, Math.ceil(lacznie / iloscNaStrone));
  const produktyMap = useMemo(
    () => new Map(produkty.map((produkt) => [produkt.id, produkt])),
    [produkty]
  );

  const opcjeStatusow = useMemo(
    () =>
      STATUSY_ZAMOWIEN.map((status) => ({
        wartosc: status,
        etykieta: ETYKIETY_STATUSOW[status],
      })),
    []
  );

  const pobierzZamowienia = async () => {
    ustawLadowanie(true);
    ustawBlad('');

    try {
      const odpowiedz = await klientApi.get<OdpowiedzListy<Zamowienie>>('/zamowienia', {
        params: {
          strona,
          iloscNaStrone,
          szukaj: szukaj.trim(),
          status: statusFiltra || undefined,
          sortPole: kluczSortowania,
          sortKierunek: kierunekSortowania,
        },
      });

      ustawZamowienia(odpowiedz.data.dane);
      ustawLacznie(odpowiedz.data.lacznie);
    } catch {
      ustawBlad('Nie udalo sie pobrac zamowien.');
      ustawZamowienia([]);
      ustawLacznie(0);
    } finally {
      ustawLadowanie(false);
    }
  };

  useEffect(() => {
    void pobierzZamowienia();
  }, [strona, iloscNaStrone, szukaj, statusFiltra, kluczSortowania, kierunekSortowania]);

  useEffect(() => {
    const pobierzSlowniki = async () => {
      ustawLadowanieSlownikow(true);

      try {
        const [odpowiedzKlientow, odpowiedzProduktow] = await Promise.all([
          klientApi.get<OdpowiedzListy<Klient>>('/klienci', {
            params: {
              strona: 1,
              iloscNaStrone: 200,
              sortPole: 'nazwa',
              sortKierunek: 'asc',
            },
          }),
          klientApi.get<OdpowiedzListy<Produkt>>('/produkty', {
            params: {
              strona: 1,
              iloscNaStrone: 200,
              sortPole: 'nazwa',
              sortKierunek: 'asc',
            },
          }),
        ]);

        ustawKlientow(odpowiedzKlientow.data.dane);
        ustawProdukty(odpowiedzProduktow.data.dane);
      } catch {
        ustawKlientow([]);
        ustawProdukty([]);
      } finally {
        ustawLadowanieSlownikow(false);
      }
    };

    void pobierzSlowniki();
  }, []);

  useEffect(() => {
    if (!czyModalOtwarty) {
      return;
    }

    document.body.classList.add('overflow-hidden');

    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [czyModalOtwarty]);

  const otworzDodawanie = () => {
    ustawTrybModalu('dodawanie');
    ustawEdytowaneId(null);
    ustawFormularz(domyslnyFormularz());
    ustawBladFormularza('');
    ustawCzyModalOtwarty(true);
  };

  const otworzPodgladLubEdycje = (
    zamowienie: Zamowienie,
    tryb: 'edycja' | 'podglad' = 'edycja'
  ) => {
    const uwagi = wyciagnijUwagi(zamowienie.uwagi);

    ustawTrybModalu(tryb);
    ustawEdytowaneId(zamowienie.id);
    ustawFormularz({
      idProdio: zamowienie.idProdio,
      zewnetrznyNumer: zamowienie.zewnetrznyNumer ?? '',
      klientId: zamowienie.klientId ? String(zamowienie.klientId) : '',
      status: zamowienie.status,
      oczekiwanaData: naDateInput(zamowienie.oczekiwanaData),
      produkcjaNaMagazyn: !zamowienie.klientId,
      uwagiDlaWszystkich: uwagi.widoczne,
      uwagiNiewidoczne: uwagi.niewidoczne,
      pozycje:
        zamowienie.pozycje.length > 0
          ? zamowienie.pozycje.map((pozycja) => ({
              id: crypto.randomUUID(),
              produktId: String(pozycja.produktId),
              ilosc: String(pozycja.ilosc),
              cena: pozycja.cena != null ? String(naLiczbe(pozycja.cena)) : '',
            }))
          : [domyslnaPozycja()],
    });
    ustawBladFormularza('');
    ustawCzyModalOtwarty(true);
  };

  const duplikujZamowienie = (zamowienie: Zamowienie) => {
    const uwagi = wyciagnijUwagi(zamowienie.uwagi);

    ustawTrybModalu('dodawanie');
    ustawEdytowaneId(null);
    ustawFormularz({
      idProdio: '',
      zewnetrznyNumer: zamowienie.zewnetrznyNumer ?? '',
      klientId: zamowienie.klientId ? String(zamowienie.klientId) : '',
      status: zamowienie.status,
      oczekiwanaData: naDateInput(zamowienie.oczekiwanaData),
      produkcjaNaMagazyn: !zamowienie.klientId,
      uwagiDlaWszystkich: uwagi.widoczne,
      uwagiNiewidoczne: uwagi.niewidoczne,
      pozycje:
        zamowienie.pozycje.length > 0
          ? zamowienie.pozycje.map((pozycja) => ({
              id: crypto.randomUUID(),
              produktId: String(pozycja.produktId),
              ilosc: String(pozycja.ilosc),
              cena: pozycja.cena != null ? String(naLiczbe(pozycja.cena)) : '',
            }))
          : [domyslnaPozycja()],
    });
    ustawBladFormularza('');
    ustawCzyModalOtwarty(true);
  };

  const zamknijModal = () => {
    if (zapisywanie) {
      return;
    }

    ustawCzyModalOtwarty(false);
    ustawBladFormularza('');
  };

  const ustawPoleFormularza = <K extends keyof FormularzZamowienia>(
    pole: K,
    wartosc: FormularzZamowienia[K]
  ) => {
    ustawFormularz((poprzedni) => ({
      ...poprzedni,
      [pole]: wartosc,
    }));
  };

  const ustawPolePozycji = (
    pozycjaId: string,
    pole: keyof PozycjaFormularza,
    wartosc: string
  ) => {
    ustawFormularz((poprzedni) => ({
      ...poprzedni,
      pozycje: poprzedni.pozycje.map((pozycja) => {
        if (pozycja.id !== pozycjaId) {
          return pozycja;
        }

        if (pole === 'produktId') {
          const produkt = produktyMap.get(Number(wartosc));

          return {
            ...pozycja,
            produktId: wartosc,
            cena:
              produkt?.cena != null && pozycja.cena.trim() === ''
                ? String(naLiczbe(produkt.cena))
                : pozycja.cena,
          };
        }

        return {
          ...pozycja,
          [pole]: wartosc,
        };
      }),
    }));
  };

  const dodajPozycje = () => {
    ustawFormularz((poprzedni) => ({
      ...poprzedni,
      pozycje: [...poprzedni.pozycje, domyslnaPozycja()],
    }));
  };

  const usunPozycje = (pozycjaId: string) => {
    ustawFormularz((poprzedni) => ({
      ...poprzedni,
      pozycje:
        poprzedni.pozycje.length > 1
          ? poprzedni.pozycje.filter((pozycja) => pozycja.id !== pozycjaId)
          : poprzedni.pozycje,
    }));
  };

  const zaktualizujStatus = async (zamowienie: Zamowienie, status: StatusZamowienia) => {
    try {
      await klientApi.put(`/zamowienia/${zamowienie.id}`, {
        zewnetrznyNumer: zamowienie.zewnetrznyNumer ?? undefined,
        klientId: zamowienie.klientId ? String(zamowienie.klientId) : undefined,
        status,
        oczekiwanaData: naDateInput(zamowienie.oczekiwanaData),
        uwagi: zamowienie.uwagi ?? undefined,
      });

      await pobierzZamowienia();
    } catch {
      ustawBlad('Nie udalo sie zaktualizowac statusu zamowienia.');
    }
  };

  const zapiszZamowienie = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const zostanWOknie = submitter?.value === 'zostan';

    if (trybModalu === 'podglad') {
      zamknijModal();
      return;
    }

    if (!formularz.idProdio.trim()) {
      ustawBladFormularza('Pole ID Prodio jest wymagane.');
      return;
    }

    const pozycjePayload = formularz.pozycje
      .filter((pozycja) => pozycja.produktId)
      .map((pozycja) => ({
        produktId: Number(pozycja.produktId),
        ilosc: Math.max(1, Number(pozycja.ilosc || '1')),
        cena: pozycja.cena.trim() ? Number(pozycja.cena) : undefined,
      }));

    if (trybModalu === 'dodawanie' && pozycjePayload.length === 0) {
      ustawBladFormularza('Dodaj przynajmniej jedna pozycje z wybranym produktem.');
      return;
    }

    ustawZapisywanie(true);
    ustawBladFormularza('');

    const payload = {
      idProdio: formularz.idProdio.trim(),
      zewnetrznyNumer: formularz.zewnetrznyNumer.trim() || undefined,
      klientId: formularz.produkcjaNaMagazyn ? undefined : formularz.klientId || undefined,
      status: formularz.status,
      oczekiwanaData: formularz.oczekiwanaData || undefined,
      uwagi: polaczUwagi(formularz.uwagiDlaWszystkich, formularz.uwagiNiewidoczne),
      pozycje: pozycjePayload,
    };

    try {
      if (trybModalu === 'dodawanie') {
        await klientApi.post('/zamowienia', payload);
      } else if (edytowaneId) {
        await klientApi.put(`/zamowienia/${edytowaneId}`, {
          zewnetrznyNumer: payload.zewnetrznyNumer,
          klientId: payload.klientId,
          status: payload.status,
          oczekiwanaData: payload.oczekiwanaData,
          uwagi: payload.uwagi,
        });
      }

      if (zostanWOknie) {
        if (trybModalu === 'dodawanie') {
          ustawFormularz(domyslnyFormularz());
        }
      } else {
        ustawCzyModalOtwarty(false);
      }

      await pobierzZamowienia();
    } catch {
      ustawBladFormularza('Nie udalo sie zapisac zamowienia.');
    } finally {
      ustawZapisywanie(false);
    }
  };

  const usunZamowienie = async (zamowienie: Zamowienie) => {
    const potwierdzone = window.confirm(
      `Czy na pewno chcesz usunac zamowienie ${zamowienie.idProdio}?`
    );

    if (!potwierdzone) {
      return;
    }

    ustawUsuwaneId(zamowienie.id);

    try {
      await klientApi.delete(`/zamowienia/${zamowienie.id}`);

      if (zamowienia.length === 1 && strona > 1) {
        onZmianaStrony(strona - 1);
      } else {
        await pobierzZamowienia();
      }
    } catch {
      ustawBlad('Nie udalo sie usunac zamowienia.');
    } finally {
      ustawUsuwaneId(null);
    }
  };

  const eksportujZamowienia = () => {
    const dane = zamowienia.map((zamowienie) => {
      const pierwszaPozycja = zamowienie.pozycje[0];
      const dniPozostale = obliczDniPozostale(zamowienie.oczekiwanaData);

      return {
        'ID Prodio': zamowienie.idProdio,
        'Zewnetrzny numer': zamowienie.zewnetrznyNumer || '-',
        Produkt: pierwszaPozycja?.produkt?.nazwa || '-',
        Klient: zamowienie.klient?.nazwa || '-',
        Status: ETYKIETY_STATUSOW[zamowienie.status],
        'Pozostalo dni': dniPozostale ?? '-',
        'Oczekiwana data': formatujDate(zamowienie.oczekiwanaData),
      };
    });

    const skoroszyt = XLSX.utils.book_new();
    const arkusz = XLSX.utils.json_to_sheet(dane);

    XLSX.utils.book_append_sheet(skoroszyt, arkusz, 'Zamowienia');
    XLSX.writeFile(skoroszyt, `zamowienia_${pobierzDatePliku()}.xlsx`);
  };

  const obsluzImport = async (wiersze: Record<string, unknown>[]) => {
    let dodano = 0;
    let bledow = 0;

    for (const wiersz of wiersze) {
      try {
        await klientApi.post('/zamowienia', wiersz);
        dodano += 1;
      } catch {
        bledow += 1;
      }
    }

    ustawPokazImporter(false);

    if (bledow > 0) {
      ustawBlad(`Import: ${dodano} dodano, ${bledow} bledow.`);
    }

    await pobierzZamowienia();
  };

  const sumaFormularza = useMemo(() => {
    return formularz.pozycje.reduce(
      (acc, pozycja) => {
        const produkt = produktyMap.get(Number(pozycja.produktId));
        const ilosc = Math.max(0, Number(pozycja.ilosc || '0'));
        const cena = pozycja.cena.trim()
          ? Number(pozycja.cena)
          : produkt?.cena != null
            ? naLiczbe(produkt.cena)
            : 0;
        const vat = produkt?.stawkaVat ?? 23;
        const netto = ilosc * cena;
        const vatKwota = netto * (vat / 100);

        acc.netto += netto;
        acc.vat += vatKwota;
        acc.brutto += netto + vatKwota;

        return acc;
      },
      { netto: 0, vat: 0, brutto: 0 }
    );
  }, [formularz.pozycje, produktyMap]);

  const pierwszaKolumnaWiersza = (zamowienie: Zamowienie) => {
    const pozycja = zamowienie.pozycje[0];
    return pozycja?.produkt ?? null;
  };

  return (
    <div className='space-y-6'>
      <section className='rounded-[30px] border border-obramowanie bg-tlo-karta px-6 py-7 shadow-xl shadow-black/10'>
        <div className='flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
          <div className='space-y-2'>
            <p className='text-sm uppercase tracking-[0.32em] text-tekst-drugorzedny'>MES</p>
            <div>
              <h1 className='text-4xl font-semibold text-tekst-glowny'>Zamowienia</h1>
              <p className='mt-2 text-sm text-tekst-drugorzedny'>
                Widok listy i formularza zamowien odwzorowany na referencyjnych ekranach.
              </p>
            </div>
          </div>

          <button
            type='button'
            onClick={otworzDodawanie}
            className='inline-flex items-center gap-2 self-start rounded-xl bg-akcent px-5 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover lg:self-auto'
          >
            <Plus className='h-4 w-4' />
            Dodaj zamowienie
          </button>
        </div>
      </section>

      <section className='rounded-[30px] border border-obramowanie bg-tlo-karta p-6 shadow-xl shadow-black/10'>
        <div className='mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between'>
          <div className='grid gap-4 md:grid-cols-2 xl:min-w-[640px]'>
            <label className='block'>
              <span className='mb-2 block text-sm font-medium text-tekst-drugorzedny'>Wyszukiwarka</span>
              <div className='relative'>
                <Search className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-tekst-drugorzedny' />
                <input
                  value={szukaj}
                  onChange={(event) => {
                    ustawSzukaj(event.target.value);
                    resetujStrone();
                  }}
                  placeholder='Szukaj po ID Prodio lub numerze zewn.'
                  className='h-11 w-full rounded-xl border border-obramowanie bg-tlo-glowne pl-11 pr-4 text-sm text-tekst-glowny outline-none transition placeholder:text-tekst-drugorzedny focus:border-akcent'
                />
              </div>
            </label>

            <label className='block'>
              <span className='mb-2 block text-sm font-medium text-tekst-drugorzedny'>Status</span>
              <select
                value={statusFiltra}
                onChange={(event) => {
                  ustawStatusFiltra(event.target.value);
                  resetujStrone();
                }}
                className='h-11 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
              >
                <option value=''>Wszystkie statusy</option>
                {opcjeStatusow.map((opcja) => (
                  <option key={opcja.wartosc} value={opcja.wartosc}>
                    {opcja.etykieta}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <button
              type='button'
              onClick={() => ustawPokazImporter(true)}
              className='inline-flex h-10 items-center gap-2 rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-semibold text-tekst-glowny transition hover:border-akcent hover:text-akcent'
            >
              <Upload className='h-4 w-4' />
              IMPORTER
            </button>

            <button
              type='button'
              onClick={eksportujZamowienia}
              className='inline-flex h-10 items-center gap-2 rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm font-semibold text-tekst-glowny transition hover:border-akcent hover:text-akcent'
            >
              <Download className='h-4 w-4' />
              EKSPORT
            </button>

            <div className='inline-flex h-10 items-center rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-sm text-tekst-drugorzedny'>
              Lacznie: <span className='ml-1 font-semibold text-tekst-glowny'>{lacznie}</span>
            </div>
          </div>
        </div>

        {blad ? (
          <div className='mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
            {blad}
          </div>
        ) : null}

        <div className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne shadow-inner'>
          <div className='overflow-x-auto'>
            <table className='min-w-[1280px] w-full border-collapse text-sm text-tekst-glowny'>
              <thead>
                <tr className='bg-tlo-naglowek text-tekst-drugorzedny'>
                  <th className='w-12 border border-obramowanie px-3 py-4 text-center'>
                    <input type='checkbox' className='h-5 w-5 rounded border-obramowanie bg-tlo-glowne' />
                  </th>
                  <th className='border border-obramowanie px-4 py-4 text-left font-semibold'>Status</th>
                  <th
                    className='border border-obramowanie px-4 py-4 text-left font-semibold cursor-pointer hover:text-akcent'
                    onClick={() => onSortowanie('idProdio', kluczSortowania === 'idProdio' && kierunekSortowania === 'asc' ? 'desc' : 'asc')}
                  >
                    ID Prodio
                  </th>
                  <th className='border border-obramowanie px-4 py-4 text-left font-semibold'>Obraz</th>
                  <th className='border border-obramowanie px-4 py-4 text-left font-semibold'>Produkt</th>
                  <th
                    className='border border-obramowanie px-4 py-4 text-left font-semibold cursor-pointer hover:text-akcent'
                    onClick={() => onSortowanie('zewnetrznyNumer', kluczSortowania === 'zewnetrznyNumer' && kierunekSortowania === 'asc' ? 'desc' : 'asc')}
                  >
                    Zew. nr zamowienia
                  </th>
                  <th className='border border-obramowanie px-4 py-4 text-center font-semibold'>Pozostalo dni</th>
                  <th
                    className='border border-obramowanie px-4 py-4 text-left font-semibold cursor-pointer hover:text-akcent'
                    onClick={() => onSortowanie('oczekiwanaData', kluczSortowania === 'oczekiwanaData' && kierunekSortowania === 'asc' ? 'desc' : 'asc')}
                  >
                    Oczekiwany termin realizacji
                  </th>
                  <th className='border border-obramowanie px-4 py-4 text-left font-semibold'>Klient</th>
                  <th className='border border-obramowanie px-4 py-4 text-center font-semibold'>Akcje</th>
                </tr>
                <tr className='bg-tlo-karta'>
                  <th className='border border-obramowanie px-3 py-2.5' />
                  <th className='border border-obramowanie px-3 py-2.5'>
                    <select
                      value={statusFiltra}
                      onChange={(event) => {
                        ustawStatusFiltra(event.target.value);
                        resetujStrone();
                      }}
                      className='h-9 w-full rounded-md border border-obramowanie bg-tlo-glowne px-3 text-sm text-tekst-glowny'
                    >
                      <option value=''>Wybierz</option>
                      {opcjeStatusow.map((opcja) => (
                        <option key={opcja.wartosc} value={opcja.wartosc}>
                          {opcja.etykieta}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className='border border-obramowanie px-3 py-2.5'>
                    <input
                      value={szukaj}
                      onChange={(event) => {
                        ustawSzukaj(event.target.value);
                        resetujStrone();
                      }}
                      placeholder='Szukaj'
                      className='h-9 w-full rounded-md border border-obramowanie bg-tlo-glowne px-3 text-sm text-tekst-glowny'
                    />
                  </th>
                  <th className='border border-obramowanie px-3 py-2.5' />
                  <th className='border border-obramowanie px-3 py-2.5'>
                    <input
                      placeholder='Produkt'
                      className='h-9 w-full rounded-md border border-obramowanie bg-tlo-glowne px-3 text-sm text-tekst-glowny'
                      disabled
                    />
                  </th>
                  <th className='border border-obramowanie px-3 py-2.5'>
                    <input
                      value={szukaj}
                      onChange={(event) => {
                        ustawSzukaj(event.target.value);
                        resetujStrone();
                      }}
                      placeholder='Szukaj'
                      className='h-9 w-full rounded-md border border-obramowanie bg-tlo-glowne px-3 text-sm text-tekst-glowny'
                    />
                  </th>
                  <th className='border border-obramowanie px-3 py-2.5' />
                  <th className='border border-obramowanie px-3 py-2.5'>
                    <input
                      type='date'
                      className='h-9 w-full rounded-md border border-obramowanie bg-tlo-glowne px-3 text-sm text-tekst-glowny'
                      disabled
                    />
                  </th>
                  <th className='border border-obramowanie px-3 py-2.5'>
                    <select
                      className='h-9 w-full rounded-md border border-obramowanie bg-tlo-glowne px-3 text-sm text-tekst-glowny'
                      disabled
                    >
                      <option>Wybierz</option>
                    </select>
                  </th>
                  <th className='border border-obramowanie px-3 py-2.5' />
                </tr>
              </thead>

              <tbody>
                {ladowanie ? (
                  Array.from({ length: 6 }, (_, indeks) => (
                    <tr key={`skeleton-${indeks}`} className='odd:bg-tlo-glowne even:bg-tlo-karta/40'>
                      {Array.from({ length: 10 }, (__, kolumna) => (
                        <td key={kolumna} className='border border-obramowanie px-4 py-4'>
                          <div className='h-4 animate-pulse rounded bg-obramowanie' />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : zamowienia.length === 0 ? (
                  <tr>
                    <td colSpan={10} className='border border-obramowanie px-6 py-16 text-center text-tekst-drugorzedny'>
                      Brak danych
                    </td>
                  </tr>
                ) : (
                  zamowienia.map((zamowienie) => {
                    const produkt = pierwszaKolumnaWiersza(zamowienie);
                    const dniPozostale = obliczDniPozostale(zamowienie.oczekiwanaData);
                    const menuAkcji: ElementMenuAkcji[] = [
                      {
                        etykieta: 'Zobacz',
                        ikona: <Eye className='h-4 w-4 text-akcent' />,
                        akcja: () => otworzPodgladLubEdycje(zamowienie, 'podglad'),
                      },
                      {
                        etykieta: 'Edytuj',
                        ikona: <Pencil className='h-4 w-4 text-akcent' />,
                        akcja: () => otworzPodgladLubEdycje(zamowienie, 'edycja'),
                      },
                      {
                        etykieta: 'Zamknij',
                        ikona: <X className='h-4 w-4 text-red-400' />,
                        akcja: () => void zaktualizujStatus(zamowienie, 'ZAMKNIETE'),
                      },
                      {
                        etykieta: 'Anuluj',
                        ikona: <Ban className='h-4 w-4 text-red-400' />,
                        akcja: () => void zaktualizujStatus(zamowienie, 'ANULOWANE'),
                      },
                      {
                        etykieta: 'Usun',
                        ikona: <Trash2 className='h-4 w-4 text-red-400' />,
                        akcja: () => void usunZamowienie(zamowienie),
                        niebezpieczna: true,
                      },
                      {
                        etykieta: 'Duplikuj',
                        ikona: <Copy className='h-4 w-4 text-akcent' />,
                        akcja: () => duplikujZamowienie(zamowienie),
                      },
                      {
                        etykieta: 'Zaplanuj',
                        ikona: <CalendarDays className='h-4 w-4 text-akcent' />,
                        akcja: () => void zaktualizujStatus(zamowienie, 'OCZEKUJE'),
                      },
                      {
                        etykieta: 'Drukuj',
                        ikona: <Printer className='h-4 w-4 text-akcent' />,
                        akcja: () => window.print(),
                      },
                      {
                        etykieta: 'Otworz w nowej karcie',
                        ikona: <ExternalLink className='h-4 w-4 text-akcent' />,
                        akcja: () => window.open(window.location.href, '_blank', 'noopener,noreferrer'),
                      },
                    ];

                    return (
                      <tr key={zamowienie.id} className='odd:bg-tlo-glowne even:bg-tlo-karta/30'>
                        <td className='border border-obramowanie px-3 py-3 text-center align-middle'>
                          <input type='checkbox' className='h-5 w-5 rounded border-obramowanie bg-tlo-glowne' />
                        </td>
                        <td className='border border-obramowanie px-4 py-3 align-middle'>
                          <span
                            className={`inline-flex rounded px-3 py-2 text-xs font-semibold ${KLASY_STATUSOW[zamowienie.status]}`}
                          >
                            {ETYKIETY_STATUSOW[zamowienie.status]}
                          </span>
                        </td>
                        <td className='border border-obramowanie px-4 py-3 align-middle text-akcent'>
                          <button
                            type='button'
                            onClick={() => otworzPodgladLubEdycje(zamowienie, 'podglad')}
                            className='border-b border-dashed border-akcent transition hover:text-akcent-hover'
                          >
                            {zamowienie.idProdio}
                          </button>
                        </td>
                        <td className='border border-obramowanie px-4 py-3 align-middle'>
                          {produkt?.zdjecie ? (
                            <img
                              src={produkt.zdjecie}
                              alt={produkt.nazwa}
                              className='h-12 w-12 object-contain'
                            />
                          ) : (
                            <div className='flex h-12 w-12 items-center justify-center rounded bg-tlo-karta text-tekst-drugorzedny'>
                              <PackagePlus className='h-5 w-5' />
                            </div>
                          )}
                        </td>
                        <td className='border border-obramowanie px-4 py-3 align-middle'>
                          <div className='max-w-[440px] text-sm'>{produkt?.nazwa || '-'}</div>
                        </td>
                        <td className='border border-obramowanie px-4 py-3 align-middle text-akcent'>
                          <span className='border-b border-dashed border-akcent'>
                            {zamowienie.zewnetrznyNumer || '-'}
                          </span>
                        </td>
                        <td
                          className={`border border-obramowanie px-4 py-3 text-center align-middle text-lg font-semibold ${
                            dniPozostale != null && dniPozostale < 0
                              ? 'text-red-500'
                              : 'text-emerald-400'
                          }`}
                        >
                          {dniPozostale ?? '-'}
                        </td>
                        <td className='border border-obramowanie px-4 py-3 align-middle'>
                          {formatujDate(zamowienie.oczekiwanaData)}
                        </td>
                        <td className='border border-obramowanie px-4 py-3 align-middle text-akcent'>
                          <span className='border-b border-dashed border-akcent'>
                            {zamowienie.klient?.nazwa || '-'}
                          </span>
                        </td>
                        <td className='border border-obramowanie px-4 py-3 align-middle'>
                          <MenuAkcji
                            elementy={menuAkcji.map((element) => ({
                              ...element,
                              wylaczone:
                                usuwaneId === zamowienie.id && element.etykieta === 'Usun',
                            }))}
                            otwarte={otwarteMenuId === zamowienie.id}
                            onToggle={() =>
                              ustawOtwarteMenuId((poprzedni) =>
                                poprzedni === zamowienie.id ? null : zamowienie.id
                              )
                            }
                            onClose={() => ustawOtwarteMenuId(null)}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className='flex items-center justify-between border-t border-obramowanie px-6 py-4 text-sm text-tekst-drugorzedny'>
            <span>
              Strona {strona} z {liczbaStron}
            </span>

            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={() => onZmianaStrony(strona - 1)}
                disabled={strona <= 1}
                className='rounded-md border border-obramowanie bg-tlo-karta px-4 py-2 transition hover:border-akcent hover:text-akcent disabled:cursor-not-allowed disabled:opacity-50'
              >
                Poprzednia
              </button>
              <button
                type='button'
                className='rounded-md border border-akcent bg-akcent/10 px-4 py-2 font-medium text-akcent'
              >
                {strona}
              </button>
              <button
                type='button'
                onClick={() => onZmianaStrony(strona + 1)}
                disabled={strona >= liczbaStron}
                className='rounded-md border border-obramowanie bg-tlo-karta px-4 py-2 transition hover:border-akcent hover:text-akcent disabled:cursor-not-allowed disabled:opacity-50'
              >
                Nastepna
              </button>
            </div>
          </div>
        </div>
      </section>

      {czyModalOtwarty ? (
        <div className='fixed inset-0 z-50 overflow-y-auto bg-black/45 p-3 backdrop-blur-[2px] md:p-4'>
          <div className='flex min-h-full items-start justify-center py-2 md:py-6'>
            <div className='flex w-full max-w-[1680px] flex-col overflow-hidden rounded-3xl border border-obramowanie bg-tlo-karta shadow-2xl'>
            <div className='flex flex-col gap-5 border-b border-obramowanie bg-tlo-naglowek px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:px-7'>
              <div className='flex flex-col gap-4 lg:flex-row lg:items-center'>
                <h2 className='text-2xl font-semibold text-tekst-glowny sm:text-3xl xl:text-4xl'>
                  {trybModalu === 'dodawanie'
                    ? 'Dodaj zamowienie'
                    : trybModalu === 'podglad'
                      ? 'Podglad zamowienia'
                      : 'Edytuj zamowienie'}
                </h2>
              </div>

              <div className='flex items-center justify-end gap-6 text-tekst-drugorzedny'>
                <HelpCircle className='h-5 w-5' />
                <button type='button' onClick={zamknijModal} className='text-tekst-drugorzedny hover:text-tekst-glowny'>
                  <X className='h-6 w-6' />
                </button>
              </div>
            </div>

            <div className='overflow-y-auto px-5 py-5 sm:px-6 lg:px-7 lg:py-6'>
              <form onSubmit={zapiszZamowienie} className='space-y-6'>
                <div className='grid gap-5 xl:grid-cols-3'>
                  <PoleFormularza etykieta='Klient'>
                    <select
                      value={formularz.produkcjaNaMagazyn ? '' : formularz.klientId}
                      onChange={(event) => ustawPoleFormularza('klientId', event.target.value)}
                      disabled={formularz.produkcjaNaMagazyn || ladowanieSlownikow || trybModalu === 'podglad'}
                      className={klasyPolaModala}
                    >
                      <option value=''>Wybierz klienta</option>
                      {klienci.map((klient) => (
                        <option key={klient.id} value={klient.id}>
                          {klient.nazwa}
                        </option>
                      ))}
                    </select>
                  </PoleFormularza>

                  <PoleFormularza etykieta='Zew. nr zamowienia'>
                    <input
                      value={formularz.zewnetrznyNumer}
                      onChange={(event) =>
                        ustawPoleFormularza('zewnetrznyNumer', event.target.value)
                      }
                      disabled={trybModalu === 'podglad'}
                      className={klasyPolaModala}
                    />
                  </PoleFormularza>

                  <PoleFormularza etykieta='Oczekiwany termin realizacji*'>
                    <input
                      type='date'
                      value={formularz.oczekiwanaData}
                      onChange={(event) =>
                        ustawPoleFormularza('oczekiwanaData', event.target.value)
                      }
                      disabled={trybModalu === 'podglad'}
                      className={klasyPolaModala}
                    />
                  </PoleFormularza>
                </div>

                <div className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne'>
                  <div className='overflow-x-auto'>
                    <table className='min-w-[1220px] w-full border-collapse text-sm'>
                      <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                        <tr>
                          <th className='w-12 border border-obramowanie px-3 py-3 text-center font-semibold'>lp.</th>
                          <th className='border border-obramowanie px-3 py-3 font-semibold'>Produkt</th>
                          <th className='w-32 border border-obramowanie px-3 py-3 font-semibold'>Dodatkowe oznaczenia</th>
                          <th className='w-28 border border-obramowanie px-3 py-3 font-semibold'>Ilosc</th>
                          <th className='w-28 border border-obramowanie px-3 py-3 font-semibold'>Cena</th>
                          <th className='w-40 border border-obramowanie px-3 py-3 font-semibold'>Podsumowanie</th>
                          <th className='w-36 border border-obramowanie px-3 py-3 font-semibold'>Magazyn</th>
                          <th className='w-24 border border-obramowanie px-3 py-3 font-semibold'>Akcje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formularz.pozycje.map((pozycja, indeks) => {
                          const produkt = produktyMap.get(Number(pozycja.produktId));
                          const ilosc = Math.max(0, Number(pozycja.ilosc || '0'));
                          const cena = pozycja.cena.trim()
                            ? Number(pozycja.cena)
                            : produkt?.cena != null
                              ? naLiczbe(produkt.cena)
                              : 0;
                          const netto = ilosc * cena;
                          const vat = netto * ((produkt?.stawkaVat ?? 23) / 100);

                          return (
                            <tr key={pozycja.id}>
                              <td className='border border-obramowanie px-3 py-3 text-center align-top'>
                                {indeks + 1}
                              </td>
                              <td className='border border-obramowanie px-3 py-3 align-top'>
                                <select
                                  value={pozycja.produktId}
                                  onChange={(event) =>
                                    ustawPolePozycji(pozycja.id, 'produktId', event.target.value)
                                  }
                                  disabled={ladowanieSlownikow || trybModalu === 'podglad'}
                                  className={klasyPolaWTabeli}
                                >
                                  <option value=''>Wyszukaj produkt</option>
                                  {produkty.map((produktOpcja) => (
                                    <option key={produktOpcja.id} value={produktOpcja.id}>
                                      {produktOpcja.nazwa}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className='border border-obramowanie px-3 py-3 align-top text-tekst-drugorzedny'>
                                {produkt?.dodatkoweOznaczenia || '-'}
                              </td>
                              <td className='border border-obramowanie px-3 py-3 align-top'>
                                <div className='flex gap-2'>
                                  <input
                                    value={pozycja.ilosc}
                                    onChange={(event) =>
                                      ustawPolePozycji(pozycja.id, 'ilosc', event.target.value)
                                    }
                                    disabled={trybModalu === 'podglad'}
                                    className={`${klasyPolaWTabeli} text-right`}
                                  />
                                  <div className='flex items-center text-sm text-tekst-drugorzedny'>szt.</div>
                                </div>
                              </td>
                              <td className='border border-obramowanie px-3 py-3 align-top'>
                                <input
                                  value={pozycja.cena}
                                  onChange={(event) =>
                                    ustawPolePozycji(pozycja.id, 'cena', event.target.value)
                                  }
                                  disabled={trybModalu === 'podglad'}
                                  className={`${klasyPolaWTabeli} text-right`}
                                />
                              </td>
                              <td className='border border-obramowanie px-3 py-3 align-top text-sm text-tekst-glowny'>
                                <div>Netto: {formatujWalute(netto)}</div>
                                <div>Brutto: {formatujWalute(netto + vat)}</div>
                                <div>VAT: {formatujWalute(vat)}</div>
                              </td>
                              <td className='border border-obramowanie px-3 py-3 align-top text-sm text-tekst-drugorzedny'>
                                <div>Na stanie:</div>
                                <div>
                                  Na produkcji: <strong>0,00</strong>
                                </div>
                              </td>
                              <td className='border border-obramowanie px-3 py-3 align-top'>
                                <div className='flex items-center justify-center gap-3'>
                                  <button
                                    type='button'
                                    onClick={() => usunPozycje(pozycja.id)}
                                    disabled={formularz.pozycje.length === 1 || trybModalu === 'podglad'}
                                    className='text-red-400 disabled:opacity-40'
                                  >
                                    <Trash2 className='h-4 w-4' />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className='flex flex-col gap-5 border-t border-obramowanie px-4 py-5 xl:flex-row xl:items-center xl:justify-between'>
                    <div className='flex flex-wrap items-center gap-4'>
                      <div className='flex items-center gap-3 text-tekst-glowny'>
                        <PackagePlus className='h-6 w-6' />
                        <span className='text-lg'>Produkcja na magazyn</span>
                      </div>
                      <Przelacznik
                        aktywny={formularz.produkcjaNaMagazyn}
                        onZmiana={(wartosc) => {
                          ustawPoleFormularza('produkcjaNaMagazyn', wartosc);
                          if (wartosc) {
                            ustawPoleFormularza('klientId', '');
                          }
                        }}
                      />
                    </div>

                    <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end'>
                      <button
                        type='button'
                        onClick={dodajPozycje}
                        disabled={trybModalu === 'podglad'}
                        className='inline-flex items-center gap-2 rounded-full bg-akcent px-5 py-3 text-sm font-semibold text-white disabled:opacity-50'
                      >
                        <Plus className='h-4 w-4' />
                        DODAJ POZYCJE
                      </button>

                      <div className='grid w-full min-w-0 grid-cols-4 overflow-hidden rounded-2xl border border-obramowanie bg-tlo-karta text-sm font-semibold text-tekst-glowny lg:w-[420px]'>
                        <div className='px-4 py-3 text-center'>Waluta</div>
                        <div className='px-4 py-3 text-center'>Netto</div>
                        <div className='px-4 py-3 text-center'>Brutto</div>
                        <div className='px-4 py-3 text-center'>VAT</div>
                        <div className='border-t border-obramowanie px-4 py-3 text-center'>PLN</div>
                        <div className='border-t border-obramowanie px-4 py-3 text-center'>
                          {formatujWalute(sumaFormularza.netto)}
                        </div>
                        <div className='border-t border-obramowanie px-4 py-3 text-center'>
                          {formatujWalute(sumaFormularza.brutto)}
                        </div>
                        <div className='border-t border-obramowanie px-4 py-3 text-center'>
                          {formatujWalute(sumaFormularza.vat)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className='border-t border-obramowanie pt-6'>
                  <div className='grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.75fr)]'>
                    <div className='space-y-6'>
                      <label className='block'>
                        <span className='mb-2 block text-sm font-medium text-tekst-drugorzedny'>
                          Uwagi dla wszystkich
                        </span>
                        <textarea
                          value={formularz.uwagiDlaWszystkich}
                          onChange={(event) =>
                            ustawPoleFormularza('uwagiDlaWszystkich', event.target.value)
                          }
                          disabled={trybModalu === 'podglad'}
                          rows={7}
                          className={klasyTextareaModala}
                        />
                      </label>

                      <label className='block'>
                        <span className='mb-2 block text-sm font-medium text-tekst-drugorzedny'>
                          Uwagi niewidoczne dla produkcji
                        </span>
                        <textarea
                          value={formularz.uwagiNiewidoczne}
                          onChange={(event) =>
                            ustawPoleFormularza('uwagiNiewidoczne', event.target.value)
                          }
                          disabled={trybModalu === 'podglad'}
                          rows={7}
                          className={klasyTextareaModala}
                        />
                      </label>
                    </div>

                    <div className='space-y-6'>
                      <div>
                        <div className='mb-2 flex items-center gap-3 text-3xl font-semibold text-tekst-glowny'>
                          <span>Dodatkowe pola zamowienia</span>
                          <Pencil className='h-5 w-5 text-akcent' />
                        </div>
                      </div>

                      <PanelUpload tytul='Pliki do zamowienia' />
                      <PanelUpload tytul='Zdjecia do zamowienia' />
                    </div>
                  </div>
                </div>

                <div className='-mx-5 -mb-5 flex flex-col items-stretch justify-center gap-4 border-t border-obramowanie bg-tlo-naglowek px-5 py-5 sm:-mx-6 sm:-mb-5 sm:px-6 lg:-mx-7 lg:-mb-6 lg:flex-row lg:items-center lg:gap-5 lg:px-7 lg:py-7'>
                  <button
                    type='submit'
                    value='zostan'
                    disabled={zapisywanie}
                    className='rounded-full bg-tlo-karta px-8 py-3 text-base font-semibold text-tekst-glowny border border-obramowanie transition hover:border-akcent hover:text-akcent disabled:opacity-60'
                  >
                    {trybModalu === 'podglad'
                      ? 'ZAMKNIJ'
                      : zapisywanie
                        ? 'ZAPISYWANIE...'
                        : 'ZAPISZ I ZOSTAN'}
                  </button>

                  {trybModalu !== 'podglad' ? (
                    <button
                      type='submit'
                      value='zamknij'
                      disabled={zapisywanie}
                      className='rounded-full bg-akcent px-8 py-3 text-base font-semibold text-white transition hover:bg-akcent-hover disabled:opacity-60'
                    >
                      ZAPISZ
                    </button>
                  ) : null}
                </div>

                {bladFormularza ? (
                  <div className='rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
                    {bladFormularza}
                  </div>
                ) : null}
              </form>
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {pokazImporter ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
          <div className='max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-obramowanie bg-tlo-karta p-1 shadow-2xl'>
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='px-5 pt-5 text-xl font-semibold text-tekst-glowny'>Importer zamowien</h3>
              <button
                type='button'
                onClick={() => ustawPokazImporter(false)}
                className='px-5 pt-5 text-tekst-drugorzedny hover:text-tekst-glowny'
              >
                <X className='h-5 w-5' />
              </button>
            </div>
            <div className='px-5 pb-5'>
              <ImporterCsv
                kolumnyDocelowe={KOLUMNY_IMPORTU}
                onImport={(wiersze) => {
                  void obsluzImport(wiersze);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
