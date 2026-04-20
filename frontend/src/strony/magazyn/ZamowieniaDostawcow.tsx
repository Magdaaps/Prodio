import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileImage,
  Files,
  Info,
  ListFilter,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import klientApi from '../../api/klient';
import Pole from '../../komponenty/ui/Pole';
import Przycisk from '../../komponenty/ui/Przycisk';
import Rozwijane from '../../komponenty/ui/Rozwijane';
import { type OdpowiedzApi, type SurowiecDto, useMagazynSlowniki } from './StanyMagazynowe';

type StatusZamowieniaDostawcy = 'OCZEKUJE' | 'WYSLANE' | 'CZESCIOWO_DOSTARCZONE' | 'DOSTARCZONE' | 'ANULOWANE';

type Dostawca = {
  id: number;
  nazwa: string;
};

type PozycjaZamowieniaApi = {
  id: number;
  surowiecId: number;
  ilosc: number;
  cena: number | null;
  surowiec: SurowiecDto;
};

type ZamowienieDostawcy = {
  id: number;
  numer: string;
  status: StatusZamowieniaDostawcy;
  dataZlozenia: string;
  dataDostawy: string | null;
  uwagi?: string | null;
  dostawca: Dostawca;
  pozycje: PozycjaZamowieniaApi[];
};

type OdpowiedzListy<T> = OdpowiedzApi<T[]> & {
  total: number;
  page: number;
  limit: number;
};

type ZalacznikRoboczy = {
  id: string;
  nazwa: string;
};

type PozycjaRobocza = {
  id: string;
  surowiecId: string;
  ilosc: string;
  cena: string;
  jednostka: string;
  stawkaVat: string;
  waluta: string;
  oczekiwanyTermin: string;
  waga: string;
  wymiar: string;
  dodatkoweOznaczenie: string;
  sugerowanaData: string;
  indeks: string;
  uwagi: string;
  uwagiNiewidoczne: string;
};

type FormularzZamowienia = {
  dostawcaId: string;
  zewnetrznyNumer: string;
  oczekiwanyTermin: string;
  uwagi: string;
  uwagiNiewidoczne: string;
  pozycje: PozycjaRobocza[];
  pliki: ZalacznikRoboczy[];
  obrazy: ZalacznikRoboczy[];
};

const STATUSY: StatusZamowieniaDostawcy[] = ['OCZEKUJE', 'WYSLANE', 'CZESCIOWO_DOSTARCZONE', 'DOSTARCZONE', 'ANULOWANE'];
const KLASY_KARTY = 'rounded-[28px] border border-slate-700 bg-[#1E2A3A] shadow-xl shadow-black/20';
const ROZMIAR_STRONY = 10;

function pobierzKomunikatBledu(blad: unknown, domyslnyKomunikat: string) {
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

  return domyslnyKomunikat;
}

function utworzId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function utworzPustaPozycje(): PozycjaRobocza {
  return {
    id: utworzId(),
    surowiecId: '',
    ilosc: '',
    cena: '',
    jednostka: '',
    stawkaVat: '23',
    waluta: 'PLN',
    oczekiwanyTermin: '',
    waga: '',
    wymiar: '',
    dodatkoweOznaczenie: '',
    sugerowanaData: '',
    indeks: '',
    uwagi: '',
    uwagiNiewidoczne: '',
  };
}

function utworzPustyFormularz(): FormularzZamowienia {
  return {
    dostawcaId: '',
    zewnetrznyNumer: '',
    oczekiwanyTermin: '',
    uwagi: '',
    uwagiNiewidoczne: '',
    pozycje: [],
    pliki: [],
    obrazy: [],
  };
}

function badgeStatusu(status: StatusZamowieniaDostawcy) {
  const mapa = {
    OCZEKUJE: 'bg-slate-500/15 text-slate-200 border border-slate-500/20',
    WYSLANE: 'bg-sky-500/15 text-sky-200 border border-sky-500/20',
    CZESCIOWO_DOSTARCZONE: 'bg-amber-500/15 text-amber-200 border border-amber-500/20',
    DOSTARCZONE: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/20',
    ANULOWANE: 'bg-red-500/15 text-red-200 border border-red-500/20',
  };
  return mapa[status];
}

function etykietaStatusu(status: StatusZamowieniaDostawcy) {
  const mapa: Record<StatusZamowieniaDostawcy, string> = {
    OCZEKUJE: 'Oczekuje',
    WYSLANE: 'Wyslane',
    CZESCIOWO_DOSTARCZONE: 'Czesciowo dostarczone',
    DOSTARCZONE: 'Dostarczone',
    ANULOWANE: 'Anulowane',
  };

  return mapa[status];
}

function formatujDate(value: string | null, withTime = false) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function formatujLiczbe(value: number, digits = 2) {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatujWalute(value: number, waluta: string) {
  return `${formatujLiczbe(value, 2)} ${waluta}`;
}

function dniDoDaty(value: string | null) {
  if (!value) return null;
  const teraz = new Date();
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return null;

  const start = new Date(teraz.getFullYear(), teraz.getMonth(), teraz.getDate()).getTime();
  const end = new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
  return Math.round((end - start) / 86400000);
}

function pobierzKlaseDni(iloscDni: number | null) {
  if (iloscDni === null) return 'text-slate-400';
  if (iloscDni < 0) return 'text-red-400';
  if (iloscDni <= 3) return 'text-orange-300';
  return 'text-emerald-300';
}

function obliczPodsumowaniePozycji(pozycje: PozycjaRobocza[]) {
  return pozycje.reduce(
    (acc, pozycja) => {
      const ilosc = Number(pozycja.ilosc) || 0;
      const cena = Number(pozycja.cena) || 0;
      const stawkaVat = Number(pozycja.stawkaVat) || 0;
      const netto = ilosc * cena;
      const vat = netto * (stawkaVat / 100);
      const brutto = netto + vat;

      return {
        netto: acc.netto + netto,
        vat: acc.vat + vat,
        brutto: acc.brutto + brutto,
        waluta: pozycja.waluta || acc.waluta || 'PLN',
      };
    },
    { netto: 0, vat: 0, brutto: 0, waluta: 'PLN' }
  );
}

function obliczPrzyjetePozycje(zamowienie: ZamowienieDostawcy) {
  if (zamowienie.status === 'DOSTARCZONE') return zamowienie.pozycje.length;
  if (zamowienie.status === 'CZESCIOWO_DOSTARCZONE') return Math.max(1, Math.floor(zamowienie.pozycje.length / 2));
  return 0;
}

function zbudujUwagiDoApi(formularz: FormularzZamowienia) {
  const sekcje = [
    formularz.uwagi.trim(),
    formularz.uwagiNiewidoczne.trim() ? `[Uwagi niewidoczne]\n${formularz.uwagiNiewidoczne.trim()}` : '',
  ].filter(Boolean);

  return sekcje.join('\n\n') || undefined;
}

function przefiltrujPliki(pliki: FileList | null) {
  if (!pliki) return [];

  return Array.from(pliki).map((plik) => ({
    id: utworzId(),
    nazwa: plik.name,
  }));
}

function JasnyModal({
  czyOtwarty,
  onZamknij,
  tytul,
  children,
  stopka,
  szerokosc = 'max-w-6xl',
}: {
  czyOtwarty: boolean;
  onZamknij: () => void;
  tytul: string;
  children: ReactNode;
  stopka?: ReactNode;
  szerokosc?: string;
}) {
  useEffect(() => {
    if (!czyOtwarty) return undefined;
    document.body.classList.add('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  }, [czyOtwarty]);

  useEffect(() => {
    if (!czyOtwarty) return undefined;

    const obsluzEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onZamknij();
      }
    };

    window.addEventListener('keydown', obsluzEsc);
    return () => window.removeEventListener('keydown', obsluzEsc);
  }, [czyOtwarty, onZamknij]);

  if (!czyOtwarty) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4'>
      <div className='absolute inset-0' onClick={onZamknij} />
      <div className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[24px] border border-obramowanie bg-tlo-karta text-tekst-glowny shadow-2xl shadow-black/30 ${szerokosc}`}>
        <div className='flex items-center justify-between border-b border-obramowanie px-6 py-5'>
          <h2 className='text-[22px] font-semibold text-tekst-glowny'>{tytul}</h2>
          <button type='button' onClick={onZamknij} className='rounded-full p-2 text-tekst-drugorzedny transition hover:bg-tlo-glowne hover:text-tekst-glowny' aria-label='Zamknij'>
            <X size={18} />
          </button>
        </div>
        <div className='flex-1 overflow-y-auto px-6 py-5'>{children}</div>
        {stopka ? <div className='border-t border-obramowanie bg-tlo-karta px-6 py-4'>{stopka}</div> : null}
      </div>
    </div>
  );
}

function JasnePole({
  label,
  icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; icon?: ReactNode }) {
  return (
    <label className='block'>
      {label ? <span className='mb-2 block text-sm font-medium text-tekst-drugorzedny'>{label}</span> : null}
      <span className='relative block'>
        {icon ? <span className='pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tekst-drugorzedny'>{icon}</span> : null}
        <input
          {...props}
          className={[
            'w-full rounded-md border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny outline-none transition focus:border-akcent focus:ring-2 focus:ring-akcent/15',
            icon ? 'pl-11' : '',
            props.className,
          ]
            .filter(Boolean)
            .join(' ')}
        />
      </span>
    </label>
  );
}

function JasneSelect({
  label,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className='block'>
      {label ? <span className='mb-2 block text-sm font-medium text-tekst-drugorzedny'>{label}</span> : null}
      <select
        {...props}
        className={[
          'w-full rounded-md border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny outline-none transition focus:border-akcent focus:ring-2 focus:ring-akcent/15',
          props.className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function JasnePoleTekstowe({
  label,
  rows = 5,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className='block'>
      {label ? <span className='mb-2 block text-sm font-medium text-tekst-drugorzedny'>{label}</span> : null}
      <textarea
        {...props}
        rows={rows}
        className={[
          'w-full rounded-md border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny outline-none transition focus:border-akcent focus:ring-2 focus:ring-akcent/15',
          props.className,
        ]
          .filter(Boolean)
          .join(' ')}
      />
    </label>
  );
}

function SekcjaZalacznikow({
  title,
  icon,
  items,
  onAdd,
  onRemove,
}: {
  title: string;
  icon: ReactNode;
  items: ZalacznikRoboczy[];
  onAdd: (items: ZalacznikRoboczy[]) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className='rounded-2xl border border-obramowanie bg-tlo-glowne shadow-sm'>
      <div className='flex items-center justify-between border-b border-obramowanie bg-tlo-karta px-4 py-3 text-sm font-semibold text-tekst-glowny'>
        <span>{title}</span>
        <label className='cursor-pointer rounded-full p-1 text-tekst-drugorzedny transition hover:bg-tlo-glowne hover:text-akcent'>
          <Plus size={18} />
          <input
            type='file'
            multiple
            className='hidden'
            onChange={(event) => {
              onAdd(przefiltrujPliki(event.target.files));
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>
      <div className='min-h-[96px] space-y-2 px-4 py-3 text-sm text-tekst-drugorzedny'>
        {items.length === 0 ? (
          <div className='flex h-[64px] items-center gap-2 text-tekst-drugorzedny'>
            {icon}
            Brak zalacznikow.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className='flex items-center justify-between rounded-md border border-obramowanie bg-tlo-karta px-3 py-2 text-tekst-glowny'>
              <span className='truncate'>{item.nazwa}</span>
              <button type='button' onClick={() => onRemove(item.id)} className='rounded-full p-1 text-tekst-drugorzedny transition hover:bg-tlo-glowne hover:text-red-400'>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ZamowieniaDostawcow() {
  const { surowce } = useMagazynSlowniki();
  const [dostawcy, ustawDostawcow] = useState<Dostawca[]>([]);
  const [zamowienia, ustawZamowienia] = useState<ZamowienieDostawcy[]>([]);
  const [dostawcaId, ustawDostawcaId] = useState('');
  const [status, ustawStatus] = useState('');
  const [dataOd, ustawDateOd] = useState('');
  const [dataDo, ustawDateDo] = useState('');
  const [pokazTylkoPrzeterminowane, ustawPokazTylkoPrzeterminowane] = useState(false);
  const [pokazGotowe, ustawPokazGotowe] = useState(true);
  const [pokazWidokPozycji, ustawPokazWidokPozycji] = useState(false);
  const [page, ustawPage] = useState(1);
  const [ladowanie, ustawLadowanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [czyModalZamowienia, ustawCzyModalZamowienia] = useState(false);
  const [czyModalPozycji, ustawCzyModalPozycji] = useState(false);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [formularz, ustawFormularz] = useState<FormularzZamowienia>(utworzPustyFormularz());
  const [roboczaPozycja, ustawRoboczaPozycja] = useState<PozycjaRobocza>(utworzPustaPozycje());
  const [bladPozycji, ustawBladPozycji] = useState('');
  const [rozwinieteZamowienia, ustawRozwinieteZamowienia] = useState<number[]>([]);

  useEffect(() => {
    const pobierzDostawcow = async () => {
      const odpowiedz = await klientApi.get('/magazyn/dostawcy').catch(() => null);
      ustawDostawcow(odpowiedz?.data?.dane ?? []);
    };

    void pobierzDostawcow();
  }, []);

  const pobierzZamowienia = async () => {
    ustawLadowanie(true);
    ustawBlad('');

    try {
      const odpowiedz = await klientApi.get<OdpowiedzListy<ZamowienieDostawcy>>('/magazyn/zamowienia-dostawcow', {
        params: { page: 1, limit: 200 },
      });
      ustawZamowienia(odpowiedz.data.dane);
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie pobrac zamowien dostawcow.'));
    } finally {
      ustawLadowanie(false);
    }
  };

  useEffect(() => {
    void pobierzZamowienia();
  }, []);

  useEffect(() => {
    ustawPage(1);
  }, [dostawcaId, status, dataOd, dataDo, pokazTylkoPrzeterminowane, pokazGotowe]);

  const przefiltrowaneZamowienia = useMemo(() => {
    return zamowienia.filter((item) => {
      const dzienDostawy = item.dataDostawy ? item.dataDostawy.slice(0, 10) : '';
      const zgodnyDostawca = !dostawcaId || String(item.dostawca.id) === dostawcaId;
      const zgodnyStatus = !status || item.status === status;
      const zgodnaDataOd = !dataOd || (dzienDostawy && dzienDostawy >= dataOd);
      const zgodnaDataDo = !dataDo || (dzienDostawy && dzienDostawy <= dataDo);
      const przeterminowane = dniDoDaty(item.dataDostawy) !== null && (dniDoDaty(item.dataDostawy) as number) < 0 && item.status !== 'DOSTARCZONE';
      const zgodnePrzeterminowanie = !pokazTylkoPrzeterminowane || przeterminowane;
      const zgodneGotowe = pokazGotowe || item.status !== 'DOSTARCZONE';

      return zgodnyDostawca && zgodnyStatus && zgodnaDataOd && zgodnaDataDo && zgodnePrzeterminowanie && zgodneGotowe;
    });
  }, [zamowienia, dostawcaId, status, dataOd, dataDo, pokazTylkoPrzeterminowane, pokazGotowe]);

  const liczbaStron = Math.max(1, Math.ceil(przefiltrowaneZamowienia.length / ROZMIAR_STRONY));

  const widoczneZamowienia = useMemo(() => {
    const start = (page - 1) * ROZMIAR_STRONY;
    return przefiltrowaneZamowienia.slice(start, start + ROZMIAR_STRONY);
  }, [page, przefiltrowaneZamowienia]);

  const podsumowanie = useMemo(() => obliczPodsumowaniePozycji(formularz.pozycje), [formularz.pozycje]);

  const resetujFormularz = () => {
    ustawFormularz(utworzPustyFormularz());
    ustawRoboczaPozycja(utworzPustaPozycje());
    ustawBladPozycji('');
  };

  const otworzModalDodawania = () => {
    resetujFormularz();
    ustawCzyModalZamowienia(true);
  };

  const dodajPozycje = () => {
    if (!roboczaPozycja.surowiecId || !(Number(roboczaPozycja.ilosc) > 0)) {
      ustawBladPozycji('Wybierz surowiec i podaj ilosc wieksza od zera.');
      return;
    }

    ustawFormularz((prev) => ({
      ...prev,
      pozycje: [
        ...prev.pozycje,
        {
          ...roboczaPozycja,
          jednostka:
            roboczaPozycja.jednostka ||
            surowce.find((surowiec) => String(surowiec.id) === roboczaPozycja.surowiecId)?.jednostka ||
            '',
          waluta:
            roboczaPozycja.waluta ||
            surowce.find((surowiec) => String(surowiec.id) === roboczaPozycja.surowiecId)?.waluta ||
            'PLN',
        },
      ],
    }));
    ustawRoboczaPozycja(utworzPustaPozycje());
    ustawBladPozycji('');
    ustawCzyModalPozycji(false);
  };

  const usunPozycjeRobocza = (id: string) => {
    ustawFormularz((prev) => ({
      ...prev,
      pozycje: prev.pozycje.filter((pozycja) => pozycja.id !== id),
    }));
  };

  const zapisz = async () => {
    if (!formularz.dostawcaId || formularz.pozycje.length === 0) {
      ustawBlad('Wybierz dostawce i dodaj co najmniej jedna pozycje.');
      return;
    }

    ustawZapisywanie(true);
    ustawBlad('');

    try {
      await klientApi.post('/magazyn/zamowienia-dostawcow', {
        dostawcaId: Number(formularz.dostawcaId),
        dataDostawy: formularz.oczekiwanyTermin || undefined,
        uwagi: zbudujUwagiDoApi(formularz),
        pozycje: formularz.pozycje.map((pozycja) => ({
          surowiecId: Number(pozycja.surowiecId),
          ilosc: Number(pozycja.ilosc),
          cena: pozycja.cena ? Number(pozycja.cena) : undefined,
        })),
      });

      ustawCzyModalZamowienia(false);
      resetujFormularz();
      await pobierzZamowienia();
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie zapisac zamowienia dostawcy.'));
    } finally {
      ustawZapisywanie(false);
    }
  };

  const zmienStatus = async (id: number, nextStatus: string) => {
    try {
      await klientApi.patch(`/magazyn/zamowienia-dostawcow/${id}`, { status: nextStatus });
      await pobierzZamowienia();
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie zaktualizowac statusu zamowienia.'));
    }
  };

  const usun = async (id: number) => {
    if (!window.confirm('Usunac zamowienie do dostawcy?')) return;

    try {
      await klientApi.delete(`/magazyn/zamowienia-dostawcow/${id}`);
      await pobierzZamowienia();
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie usunac zamowienia dostawcy.'));
    }
  };

  const przelaczRozwiniecie = (id: number) => {
    ustawRozwinieteZamowienia((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const opcjeDostawcow = dostawcy.map((dostawca) => ({
    wartosc: String(dostawca.id),
    etykieta: dostawca.nazwa,
  }));

  const opcjeSurowcow = surowce.map((surowiec) => ({
    value: String(surowiec.id),
    label: `${surowiec.nazwa} (${surowiec.jednostka})`,
  }));

  return (
    <div className='space-y-6 text-slate-100'>
      <section className={`${KLASY_KARTY} bg-gradient-to-br from-[#1E2A3A] via-[#182230] to-[#0f1724] p-6`}>
        <div className='flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between'>
          <div>
            <div className='mb-3 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-200'>Sprint 9</div>
            <h1 className='text-3xl font-semibold'>Zamowienia u dostawcow</h1>
            <p className='mt-2 max-w-3xl text-sm text-slate-400'>Lista i formularze zostaly dopasowane do dostarczonych ekranow, z osobnym formularzem pozycji i sekcjami zalacznikow.</p>
          </div>
          <div className='flex flex-wrap gap-3'>
            <button
              type='button'
              onClick={() => ustawPokazWidokPozycji((prev) => !prev)}
              className='inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f2937]'
            >
              <ListFilter size={16} />
              {pokazWidokPozycji ? 'Ukryj widok pozycji' : 'Widok pozycji'}
            </button>
            <button
              type='button'
              onClick={otworzModalDodawania}
              className='inline-flex items-center gap-2 rounded-full bg-[#ff9f1a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff8b00]'
            >
              <Plus size={16} />
              Dodaj
            </button>
            <button
              type='button'
              onClick={() => {
                ustawStatus('');
                ustawDostawcaId('');
                ustawDateOd('');
                ustawDateDo('');
                ustawPokazTylkoPrzeterminowane(false);
                ustawPokazGotowe(true);
              }}
              className='inline-flex items-center gap-2 rounded-full border border-slate-600 bg-transparent px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800/50'
            >
              <Settings2 size={16} />
              Dostosuj
            </button>
          </div>
        </div>
      </section>

      <section className={`${KLASY_KARTY} p-4`}>
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          <Rozwijane etykieta='Dostawca' opcje={opcjeDostawcow} wartosc={dostawcaId} onZmiana={(wartosc) => ustawDostawcaId(String(wartosc))} placeholder='Wszyscy dostawcy' />
          <Rozwijane etykieta='Status' opcje={STATUSY.map((item) => ({ wartosc: item, etykieta: etykietaStatusu(item) }))} wartosc={status} onZmiana={(wartosc) => ustawStatus(String(wartosc))} placeholder='Wszystkie statusy' />
          <Pole etykieta='Data od' type='date' value={dataOd} onChange={(event) => ustawDateOd(event.target.value)} />
          <Pole etykieta='Data do' type='date' value={dataDo} onChange={(event) => ustawDateDo(event.target.value)} />
        </div>
      </section>

      {blad ? <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}

      <section className={`${KLASY_KARTY} overflow-hidden p-0`}>
        <div className='flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 px-4 py-4'>
          <div className='flex flex-wrap items-center gap-6 text-sm text-slate-200'>
            <label className='inline-flex items-center gap-3'>
              <span className='relative'>
                <input type='checkbox' className='peer sr-only' checked={pokazGotowe} onChange={() => ustawPokazGotowe((prev) => !prev)} />
                <span className='block h-5 w-10 rounded-full bg-slate-600 transition peer-checked:bg-orange-400' />
                <span className='absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:left-[22px]' />
              </span>
              Wyswietl gotowe
            </label>
            <label className='inline-flex items-center gap-3'>
              <span className='relative'>
                <input
                  type='checkbox'
                  className='peer sr-only'
                  checked={pokazTylkoPrzeterminowane}
                  onChange={() => ustawPokazTylkoPrzeterminowane((prev) => !prev)}
                />
                <span className='block h-5 w-10 rounded-full bg-slate-600 transition peer-checked:bg-orange-400' />
                <span className='absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:left-[22px]' />
              </span>
              Pokaz tylko przeterminowane
            </label>
          </div>
          <div className='flex items-center gap-4 text-sm text-slate-400'>
            <span>Elementow na stronie:</span>
            <span className='text-base font-semibold text-white'>{ROZMIAR_STRONY}</span>
            <span>
              {przefiltrowaneZamowienia.length === 0 ? '0 - 0' : `${(page - 1) * ROZMIAR_STRONY + 1} - ${Math.min(page * ROZMIAR_STRONY, przefiltrowaneZamowienia.length)}`} z {przefiltrowaneZamowienia.length}
            </span>
          </div>
        </div>

        <div className='overflow-x-auto'>
          <table className='min-w-[1550px] w-full text-sm'>
            <thead className='border-b border-slate-700 bg-slate-900/50 text-slate-300'>
              <tr>
                {[
                  'Rozwin pozycje',
                  'Dostawca',
                  'ID Prodio',
                  'Zew. nr zamowienia u dostawcy',
                  'Przyjetych/Zamowionych',
                  'Pozostalo dni',
                  'Data wydrukowania',
                  'Data zamkniecia',
                  'Oczekiwany termin',
                  'Potwierdzony termin zamowienia',
                  'Data wysylki towaru',
                  'Akcje',
                ].map((label) => (
                  <th key={label} className='px-4 py-4 text-left font-semibold'>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ladowanie ? (
                <tr>
                  <td colSpan={12} className='px-4 py-10 text-center text-slate-400'>
                    Ladowanie zamowien...
                  </td>
                </tr>
              ) : widoczneZamowienia.length === 0 ? (
                <tr>
                  <td colSpan={12} className='px-4 py-10 text-center text-slate-400'>
                    Brak zamowien.
                  </td>
                </tr>
              ) : (
                widoczneZamowienia.map((item) => {
                  const dni = dniDoDaty(item.dataDostawy);
                  const przyjete = obliczPrzyjetePozycje(item);
                  const zamowione = item.pozycje.length;
                  const czyRozwiniete = rozwinieteZamowienia.includes(item.id);

                  return (
                    <>
                      <tr key={item.id} className='border-b border-slate-800/70 bg-slate-950/10 transition hover:bg-slate-900/20'>
                        <td className='px-4 py-4'>
                          <button
                            type='button'
                            onClick={() => przelaczRozwiniecie(item.id)}
                            className='inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-700/70 text-white transition hover:bg-slate-600'
                          >
                            {czyRozwiniete ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td className='px-4 py-4'>{item.dostawca.nazwa}</td>
                        <td className='px-4 py-4'>
                          <span className='text-sky-300 underline decoration-dotted underline-offset-4'>{item.numer}</span>
                        </td>
                        <td className='px-4 py-4 text-slate-400'>--</td>
                        <td className='px-4 py-4'>
                          <span className='font-semibold text-white'>{przyjete}</span> / {zamowione}
                        </td>
                        <td className={`px-4 py-4 font-semibold ${pobierzKlaseDni(dni)}`}>{dni === null ? '--' : dni > 0 ? `+${dni}` : dni}</td>
                        <td className='px-4 py-4 text-slate-400'>--</td>
                        <td className='px-4 py-4 text-slate-400'>--</td>
                        <td className='px-4 py-4 text-white'>{formatujDate(item.dataDostawy, true)}</td>
                        <td className='px-4 py-4 text-slate-400'>--</td>
                        <td className='px-4 py-4 text-slate-400'>--</td>
                        <td className='px-4 py-4'>
                          <div className='flex items-center gap-3 text-orange-300'>
                            <button type='button' className='transition hover:text-orange-200' title='Drukuj'>
                              <Printer size={16} />
                            </button>
                            <button type='button' className='transition hover:text-orange-200' title='Dokumenty'>
                              <Files size={16} />
                            </button>
                            <button type='button' className='cursor-not-allowed opacity-50' title='Edycja w kolejnym kroku'>
                              <Pencil size={16} />
                            </button>
                            <button type='button' onClick={() => void usun(item.id)} className='transition hover:text-red-300' title='Usun'>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {czyRozwiniete ? (
                        <tr key={`${item.id}-details`} className='border-b border-slate-800 bg-slate-950/30'>
                          <td colSpan={12} className='px-4 py-5'>
                            <div className='space-y-4'>
                              <div className='flex flex-wrap items-center justify-between gap-4'>
                                <div className='flex items-center gap-3'>
                                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeStatusu(item.status)}`}>{etykietaStatusu(item.status)}</span>
                                  <span className='text-sm text-slate-400'>Data zlozenia: {formatujDate(item.dataZlozenia, true)}</span>
                                </div>
                                <div className='w-full max-w-xs'>
                                  <Rozwijane
                                    etykieta='Status'
                                    opcje={STATUSY.map((wartosc) => ({ wartosc, etykieta: etykietaStatusu(wartosc) }))}
                                    wartosc={item.status}
                                    onZmiana={(wartosc) => void zmienStatus(item.id, String(wartosc))}
                                  />
                                </div>
                              </div>

                              {pokazWidokPozycji ? (
                                <div className='overflow-x-auto rounded-2xl border border-slate-700'>
                                  <table className='min-w-[900px] w-full text-sm'>
                                    <thead className='bg-slate-900/80 text-slate-300'>
                                      <tr>
                                        {['Surowiec', 'Ilosc', 'Cena', 'Wartosc netto', 'Waluta'].map((label) => (
                                          <th key={label} className='px-4 py-3 text-left font-medium'>
                                            {label}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.pozycje.map((pozycja) => (
                                        <tr key={pozycja.id} className='border-t border-slate-800'>
                                          <td className='px-4 py-3'>{pozycja.surowiec.nazwa}</td>
                                          <td className='px-4 py-3'>{formatujLiczbe(pozycja.ilosc, 4)} {pozycja.surowiec.jednostka}</td>
                                          <td className='px-4 py-3'>{pozycja.cena === null ? '--' : formatujWalute(pozycja.cena, pozycja.surowiec.waluta)}</td>
                                          <td className='px-4 py-3'>
                                            {pozycja.cena === null ? '--' : formatujWalute(pozycja.cena * pozycja.ilosc, pozycja.surowiec.waluta)}
                                          </td>
                                          <td className='px-4 py-3'>{pozycja.surowiec.waluta}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : null}

                              {item.uwagi ? (
                                <div className='rounded-2xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm text-slate-300'>
                                  <div className='mb-1 font-semibold text-slate-200'>Uwagi</div>
                                  <pre className='whitespace-pre-wrap font-sans text-sm'>{item.uwagi}</pre>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className='flex items-center justify-between gap-3 border-t border-slate-700 px-4 py-4 text-sm text-slate-300'>
          <span>
            Strona {page} z {liczbaStron}
          </span>
          <div className='flex gap-2'>
            <Przycisk wariant='drugorzedny' rozmiar='maly' disabled={page <= 1} onClick={() => ustawPage((prev) => prev - 1)}>
              Poprzednia
            </Przycisk>
            <Przycisk wariant='drugorzedny' rozmiar='maly' disabled={page >= liczbaStron} onClick={() => ustawPage((prev) => prev + 1)}>
              Nastepna
            </Przycisk>
          </div>
        </div>
      </section>

      <JasnyModal
        czyOtwarty={czyModalZamowienia}
        onZamknij={() => !zapisywanie && ustawCzyModalZamowienia(false)}
        tytul='Dodaj zamowienie u dostawcy'
        szerokosc='max-w-[1550px]'
        stopka={
          <div className='flex justify-center'>
            <button
              type='button'
              onClick={() => void zapisz()}
              disabled={zapisywanie}
              className='inline-flex min-w-[110px] items-center justify-center rounded-full bg-akcent px-6 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover disabled:cursor-not-allowed disabled:opacity-70'
            >
              {zapisywanie ? 'Zapisywanie...' : 'ZAPISZ'}
            </button>
          </div>
        }
      >
        <div className='space-y-6'>
          <div className='grid gap-5 xl:grid-cols-3'>
            <JasneSelect
              label='Dostawca*'
              value={formularz.dostawcaId}
              onChange={(event) => ustawFormularz((prev) => ({ ...prev, dostawcaId: event.target.value }))}
              options={[{ value: '', label: 'Wybierz' }, ...dostawcy.map((dostawca) => ({ value: String(dostawca.id), label: dostawca.nazwa }))]}
            />
            <JasnePole
              label='Zew. nr zamowienia u dostawcy'
              value={formularz.zewnetrznyNumer}
              onChange={(event) => ustawFormularz((prev) => ({ ...prev, zewnetrznyNumer: event.target.value }))}
              placeholder='Podaj numer'
            />
            <JasnePole
              label='Oczekiwany termin*'
              type='date'
              icon={<CalendarDays size={16} />}
              value={formularz.oczekiwanyTermin}
              onChange={(event) => ustawFormularz((prev) => ({ ...prev, oczekiwanyTermin: event.target.value }))}
            />
          </div>

          <div className='overflow-x-auto rounded-2xl border border-obramowanie bg-tlo-glowne'>
            <table className='min-w-[1150px] w-full text-sm'>
              <thead className='bg-tlo-karta text-tekst-drugorzedny'>
                <tr>
                  {['Status', 'Surowiec', 'Domyslny dostawca', 'Ilosc', 'Ilosc dostarczona', 'Cena', 'Stawka VAT', 'Waluta', 'Netto', 'Brutto', 'VAT', 'Akcje'].map((label) => (
                    <th key={label} className='border-b border-obramowanie px-4 py-3 text-left font-semibold'>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {formularz.pozycje.length === 0 ? (
                  <tr>
                    <td colSpan={12} className='px-4 py-8 text-tekst-drugorzedny'>
                      <div className='flex items-center gap-3'>
                        <Info size={18} className='text-akcent' />
                        Nie znaleziono danych
                      </div>
                    </td>
                  </tr>
                ) : (
                  formularz.pozycje.map((pozycja) => {
                    const surowiec = surowce.find((item) => String(item.id) === pozycja.surowiecId);
                    const ilosc = Number(pozycja.ilosc) || 0;
                    const cena = Number(pozycja.cena) || 0;
                    const vatRate = Number(pozycja.stawkaVat) || 0;
                    const netto = ilosc * cena;
                    const vat = netto * (vatRate / 100);
                    const brutto = netto + vat;

                    return (
                      <tr key={pozycja.id}>
                        <td className='border-b border-obramowanie px-4 py-3 text-tekst-glowny'>Nowa</td>
                        <td className='border-b border-obramowanie px-4 py-3 text-tekst-glowny'>{surowiec?.nazwa ?? '--'}</td>
                        <td className='border-b border-obramowanie px-4 py-3 text-tekst-glowny'>{dostawcy.find((item) => String(item.id) === formularz.dostawcaId)?.nazwa ?? '--'}</td>
                        <td className='border-b border-obramowanie px-4 py-3 text-tekst-glowny'>{formatujLiczbe(ilosc, 4)}</td>
                        <td className='border-b border-obramowanie px-4 py-3 text-tekst-glowny'>0</td>
                        <td className='border-b border-obramowanie px-4 py-3 text-tekst-glowny'>{cena ? formatujLiczbe(cena, 2) : '--'}</td>
                        <td className='border-b border-obramowanie px-4 py-3 text-tekst-glowny'>{pozycja.stawkaVat || '--'}%</td>
                        <td className='border-b border-obramowanie px-4 py-3 text-tekst-glowny'>{pozycja.waluta || surowiec?.waluta || 'PLN'}</td>
                        <td className='border-b border-obramowanie px-4 py-3 text-tekst-glowny'>{formatujLiczbe(netto, 2)}</td>
                        <td className='border-b border-obramowanie px-4 py-3 text-tekst-glowny'>{formatujLiczbe(brutto, 2)}</td>
                        <td className='border-b border-obramowanie px-4 py-3 text-tekst-glowny'>{formatujLiczbe(vat, 2)}</td>
                        <td className='border-b border-obramowanie px-4 py-3'>
                          <button type='button' onClick={() => usunPozycjeRobocza(pozycja.id)} className='text-tekst-drugorzedny transition hover:text-red-400'>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className='grid gap-6 xl:grid-cols-[1fr_1fr_auto_520px] xl:items-start'>
            <SekcjaZalacznikow
              title='Pliki'
              icon={<Files size={18} />}
              items={formularz.pliki}
              onAdd={(items) => ustawFormularz((prev) => ({ ...prev, pliki: [...prev.pliki, ...items] }))}
              onRemove={(id) => ustawFormularz((prev) => ({ ...prev, pliki: prev.pliki.filter((item) => item.id !== id) }))}
            />
            <SekcjaZalacznikow
              title='Obrazy'
              icon={<FileImage size={18} />}
              items={formularz.obrazy}
              onAdd={(items) => ustawFormularz((prev) => ({ ...prev, obrazy: [...prev.obrazy, ...items] }))}
              onRemove={(id) => ustawFormularz((prev) => ({ ...prev, obrazy: prev.obrazy.filter((item) => item.id !== id) }))}
            />
            <div className='flex justify-center xl:pt-1'>
              <button
                type='button'
                onClick={() => {
                  ustawRoboczaPozycja(utworzPustaPozycje());
                  ustawBladPozycji('');
                  ustawCzyModalPozycji(true);
                }}
                className='inline-flex items-center gap-2 rounded-full bg-akcent px-7 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover'
              >
                <PackagePlus size={16} />
                DODAJ POZYCJE
              </button>
            </div>
            <div className='overflow-hidden rounded-2xl border border-obramowanie bg-tlo-glowne'>
              <div className='grid grid-cols-4 border-b border-obramowanie bg-tlo-karta text-center text-sm font-semibold text-tekst-drugorzedny'>
                <div className='px-4 py-3'>Waluta</div>
                <div className='px-4 py-3'>Netto</div>
                <div className='px-4 py-3'>Brutto</div>
                <div className='px-4 py-3'>VAT</div>
              </div>
              <div className='grid grid-cols-4 text-center text-sm text-tekst-glowny'>
                <div className='px-4 py-3'>{podsumowanie.waluta}</div>
                <div className='px-4 py-3'>{formatujLiczbe(podsumowanie.netto, 2)}</div>
                <div className='px-4 py-3'>{formatujLiczbe(podsumowanie.brutto, 2)}</div>
                <div className='px-4 py-3'>{formatujLiczbe(podsumowanie.vat, 2)}</div>
              </div>
            </div>
          </div>

          <div className='grid gap-6 xl:grid-cols-2'>
            <JasnePoleTekstowe
              label='Uwagi'
              rows={6}
              value={formularz.uwagi}
              onChange={(event) => ustawFormularz((prev) => ({ ...prev, uwagi: event.target.value }))}
            />
            <JasnePoleTekstowe
              label='Uwagi (niewidoczne)'
              rows={6}
              value={formularz.uwagiNiewidoczne}
              onChange={(event) => ustawFormularz((prev) => ({ ...prev, uwagiNiewidoczne: event.target.value }))}
            />
          </div>
        </div>
      </JasnyModal>

      <JasnyModal
        czyOtwarty={czyModalPozycji}
        onZamknij={() => ustawCzyModalPozycji(false)}
        tytul='Nowa pozycja do zamowienia u dostawcy'
        szerokosc='max-w-3xl'
        stopka={
          <div className='flex flex-col items-center gap-3'>
            {bladPozycji ? <div className='text-sm text-red-600'>{bladPozycji}</div> : null}
            <button
              type='button'
              onClick={dodajPozycje}
              className='inline-flex min-w-[110px] items-center justify-center rounded-full bg-akcent px-6 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover'
            >
              DODAJ
            </button>
          </div>
        }
      >
        <div className='space-y-4'>
          <JasneSelect
            label='Surowiec*'
            value={roboczaPozycja.surowiecId}
            onChange={(event) => {
              const surowiec = surowce.find((item) => String(item.id) === event.target.value);
              ustawRoboczaPozycja((prev) => ({
                ...prev,
                surowiecId: event.target.value,
                jednostka: surowiec?.jednostka ?? prev.jednostka,
                waluta: surowiec?.waluta ?? prev.waluta,
                cena: prev.cena || (surowiec?.cena ? String(surowiec.cena) : ''),
              }));
            }}
            options={[{ value: '', label: 'Wybierz' }, ...opcjeSurowcow]}
          />
          <JasnePole label='Ilosc*' type='number' min='0.0001' step='0.0001' value={roboczaPozycja.ilosc} onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, ilosc: event.target.value }))} />
          <JasnePole label='Cena' type='number' min='0' step='0.01' value={roboczaPozycja.cena} onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, cena: event.target.value }))} />
          <JasnePole label='Jednostka' value={roboczaPozycja.jednostka} onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, jednostka: event.target.value }))} />
          <JasneSelect
            label='Stawka VAT'
            value={roboczaPozycja.stawkaVat}
            onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, stawkaVat: event.target.value }))}
            options={['0', '5', '8', '23'].map((value) => ({ value, label: `${value}%` }))}
          />
          <JasneSelect
            label='Waluta'
            value={roboczaPozycja.waluta}
            onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, waluta: event.target.value }))}
            options={['PLN', 'EUR', 'USD'].map((value) => ({ value, label: value }))}
          />
          <JasnePole
            label='Oczekiwany termin'
            type='date'
            icon={<CalendarDays size={16} />}
            value={roboczaPozycja.oczekiwanyTermin}
            onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, oczekiwanyTermin: event.target.value }))}
          />
          <JasnePole label='Waga' value={roboczaPozycja.waga} onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, waga: event.target.value }))} />
          <JasnePole label='Wymiar' value={roboczaPozycja.wymiar} onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, wymiar: event.target.value }))} />
          <JasnePole label='Dodatkowe oznaczenie' value={roboczaPozycja.dodatkoweOznaczenie} onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, dodatkoweOznaczenie: event.target.value }))} />
          <JasnePole
            label='Sugerowana data'
            type='date'
            icon={<CalendarDays size={16} />}
            value={roboczaPozycja.sugerowanaData}
            onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, sugerowanaData: event.target.value }))}
          />
          <JasnePole label='Indeks' value={roboczaPozycja.indeks} onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, indeks: event.target.value }))} />
          <JasnePoleTekstowe label='Uwagi' rows={4} value={roboczaPozycja.uwagi} onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, uwagi: event.target.value }))} />
          <JasnePoleTekstowe
            label='Uwagi (niewidoczne)'
            rows={4}
            value={roboczaPozycja.uwagiNiewidoczne}
            onChange={(event) => ustawRoboczaPozycja((prev) => ({ ...prev, uwagiNiewidoczne: event.target.value }))}
          />
        </div>
      </JasnyModal>
    </div>
  );
}
