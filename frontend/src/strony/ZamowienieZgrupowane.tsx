import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Check,
  Clock3,
  Copy,
  MoreHorizontal,
  Package,
  PackageCheck,
  Plus,
  Printer,
  Save,
  SquarePen,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react';
import klientApi from '../api/klient';
import type { OdpowiedzApi, StatusZamowienia, StatusZlecenia } from '../typy/indeks';

type Klient = {
  id: number;
  nazwa: string;
};

type BomSurowca = {
  ilosc: number | string;
  surowiec: {
    id: number;
    nazwa: string;
    jednostka: string;
    cena: number | string | null;
  };
};

type Produkt = {
  id: number;
  idProdio: string;
  nazwa: string;
  dodatkoweOznaczenia: string | null;
  cena: number | string | null;
  stawkaVat: number | null;
  zdjecie: string | null;
  bomSurowcow: BomSurowca[];
};

type PozycjaZamowienia = {
  id: number;
  produktId: number;
  ilosc: number;
  cena: number | string | null;
  produkt: Produkt | null;
};

type Maszyna = {
  id: number;
  nazwa: string;
};

type ZlecenieSkrot = {
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

type ZamowienieWGrupie = {
  id: number;
  idProdio: string;
  zewnetrznyNumer: string | null;
  status: StatusZamowienia;
  oczekiwanaData: string | null;
  uwagi: string | null;
  klient: Klient | null;
  pozycje: PozycjaZamowienia[];
  zlecenia: ZlecenieSkrot[];
};

type OdpowiedzZamowieniaZgrupowanego = {
  numer: string;
  klient: Klient | null;
  utworzonyW: string | null;
  oczekiwanaData: string | null;
  zamowienia: ZamowienieWGrupie[];
};

type OdpowiedzListy<T> = OdpowiedzApi<T[]> & {
  lacznie: number;
  strona: number;
  iloscNaStrone: number;
};

type TabelaKosztowWiersz = {
  klucz: string;
  etykieta: string;
  planowanyCzas: number;
  planowanyKoszt: number;
  zrealizowanyCzas: number;
  zrealizowanyKoszt: number;
};

type SzczegolyZlecenia = {
  id: number;
  zamowienieId: number;
  numer: string;
  status: StatusZlecenia;
  iloscPlan: number;
  iloscWykonana: number;
  iloscBrakow: number;
  planowanyStop: string | null;
  maszynaKoncowa: boolean;
  maszyna: Maszyna;
  koszty: {
    kpi: {
      czas: {
        planowanyGodziny: number;
        zrealizowanyGodziny: number;
      };
    };
    tabelaKosztow: TabelaKosztowWiersz[];
  };
};

type WierszHistoriiZamowienia = {
  id: number;
  numerZlecenia: string;
  maszynaOperacja: { id: number; nazwa: string };
  pracownik: { id: number; imie: string; nazwisko: string; aktywny: boolean } | null;
  iloscWykonana: number;
  czasSekundy: number;
  wydajnoscProcent: number;
  wydajnoscTekst: string;
  start: string;
  stop: string | null;
  braki: number;
  opisBrakow: string | null;
  operacjaKoncowa: boolean;
  powodyPrzerw: string[];
  tagi: string[];
  zlecenieId: number;
  zamowienieId: number;
  formatowanyCzas: string;
  formatowanaPauza: string;
};

type OdpowiedzHistoriiPracy = {
  dane: WierszHistoriiZamowienia[];
  total: number;
  strona: number;
  limit: number;
};

type WierszProduktu = {
  klucz: string;
  zamowienieId: number;
  idProdio: string;
  status: string;
  statusKlasy: string;
  pozostaleDni: number | null;
  produkt: string;
  produktyGotowe: number;
  produktyPlan: number;
  zleceniaGotowe: number;
  zleceniaWszystkie: number;
  sumaNetto: number;
  uwagi: string;
};

type WierszSurowca = {
  klucz: number;
  nazwa: string;
  liczbaZamowien: number;
  iloscNaZamowienie: number;
  iloscZuzyta: number;
  jednostka: string;
  planowanyKoszt: number;
  zrealizowanyKoszt: number;
  naStanie: number;
  naProdukcji: number;
};

type ElementMenuAkcji = {
  etykieta: string;
  ikona: ReactNode;
  akcja?: () => void;
};

type Zakladka =
  | 'Progres'
  | 'Edytuj'
  | 'Surowce'
  | 'Historia pracy'
  | 'Wydania magazynowe'
  | 'Przyjecia magazynowe';

const ZAKLADKI: Zakladka[] = [
  'Progres',
  'Edytuj',
  'Surowce',
  'Historia pracy',
  'Wydania magazynowe',
  'Przyjecia magazynowe',
];

type FormularzEdycji = {
  klientId: string;
  zewnetrznyNumer: string;
  wlasne: boolean;
  oczekiwanaData: string;
  terminPotwierdzony: string;
  dataWysylki: string;
  uwagiWidoczne: string;
  uwagiNiewidoczne: string;
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
  return `${formatujLiczbe(wartosc)} PLN`;
}

function formatujDate(wartosc: string | null) {
  if (!wartosc) {
    return '-';
  }

  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toISOString().slice(0, 10);
}

function formatujCzasZGodzin(godziny: number) {
  const sekundy = Math.max(0, Math.round(godziny * 3600));
  const godz = Math.floor(sekundy / 3600);
  const min = Math.floor((sekundy % 3600) / 60);
  const sek = sekundy % 60;
  return [godz, min, sek].map((wartosc) => String(wartosc).padStart(2, '0')).join(':');
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

function pobierzNazwePracownika(
  pracownik: WierszHistoriiZamowienia['pracownik']
) {
  if (!pracownik) {
    return '-';
  }

  return `${pracownik.imie} ${pracownik.nazwisko}`;
}

function obliczDniPozostale(wartosc: string | null) {
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

function odczytajMetaPole(tresc: string, klucz: string) {
  const wzorzec = new RegExp(`\\[${klucz}:(.*?)\\]`);
  const dopasowanie = tresc.match(wzorzec);
  return dopasowanie?.[1]?.trim() ?? '';
}

function usunMetaPola(tresc: string) {
  return tresc.replace(/\n?\[(terminPotwierdzony|dataWysylki):.*?\]/g, '').trim();
}

function rozdzielUwagiZMeta(uwagi: string | null) {
  const sekcje = rozdzielUwagi(uwagi);

  return {
    widoczne: sekcje.widoczne,
    niewidoczne: usunMetaPola(sekcje.niewidoczne),
    terminPotwierdzony: odczytajMetaPole(sekcje.niewidoczne, 'terminPotwierdzony'),
    dataWysylki: odczytajMetaPole(sekcje.niewidoczne, 'dataWysylki'),
  };
}

function polaczUwagiZMeta({
  uwagiWidoczne,
  uwagiNiewidoczne,
  terminPotwierdzony,
  dataWysylki,
}: {
  uwagiWidoczne: string;
  uwagiNiewidoczne: string;
  terminPotwierdzony: string;
  dataWysylki: string;
}) {
  const sekcje: string[] = [];
  const widoczne = uwagiWidoczne.trim();
  const meta: string[] = [];

  if (terminPotwierdzony) {
    meta.push(`[terminPotwierdzony:${terminPotwierdzony}]`);
  }

  if (dataWysylki) {
    meta.push(`[dataWysylki:${dataWysylki}]`);
  }

  const niewidoczne = [uwagiNiewidoczne.trim(), ...meta].filter(Boolean).join('\n');

  if (widoczne) {
    sekcje.push(`Uwagi dla wszystkich:\n${widoczne}`);
  }

  if (niewidoczne) {
    sekcje.push(`Uwagi niewidoczne dla produkcji:\n${niewidoczne}`);
  }

  return sekcje.join('\n\n---\n') || undefined;
}

function obliczProcent(realizacja: number, plan: number) {
  if (plan <= 0) {
    return 0;
  }

  return (realizacja / plan) * 100;
}

function pobierzFinalneZlecenia(zlecenia: SzczegolyZlecenia[]) {
  const koncowe = zlecenia.filter((zlecenie) => zlecenie.maszynaKoncowa);
  return koncowe.length > 0 ? koncowe : zlecenia.slice(-1);
}

function pobierzStatusWiersza(
  status: StatusZamowienia,
  produktyGotowe: number,
  produktyPlan: number
) {
  if (status === 'WYDANE' || status === 'ZAMKNIETE') {
    return {
      etykieta: 'WYDANE',
      klasy: 'bg-cyan-500/15 text-cyan-200 ring-1 ring-inset ring-cyan-400/30',
    };
  }

  if (produktyGotowe > 0 && produktyGotowe < produktyPlan) {
    return {
      etykieta: 'CZESCIOWO GOTOWE',
      klasy: 'bg-sky-500/15 text-sky-200 ring-1 ring-inset ring-sky-400/30',
    };
  }

  if (produktyPlan > 0 && produktyGotowe >= produktyPlan) {
    return {
      etykieta: 'GOTOWE',
      klasy: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/30',
    };
  }

  if (status === 'W_REALIZACJI') {
    return {
      etykieta: 'W TOKU',
      klasy: 'bg-orange-500/15 text-orange-200 ring-1 ring-inset ring-orange-400/30',
    };
  }

  return {
    etykieta: 'NOWE',
    klasy: 'bg-slate-500/20 text-slate-100 ring-1 ring-inset ring-slate-400/30',
  };
}

function PasekPostepu({
  wartosc,
  limit,
  kolor = 'niebieski',
}: {
  wartosc: number;
  limit: number;
  kolor?: 'niebieski' | 'zielony' | 'czerwony' | 'szary';
}) {
  const procent = limit > 0 ? Math.max(0, Math.min(100, (wartosc / limit) * 100)) : 0;
  const klasy =
    kolor === 'zielony'
      ? 'from-emerald-400 via-emerald-500 to-emerald-400'
      : kolor === 'czerwony'
        ? 'from-rose-500 via-red-500 to-rose-500'
        : kolor === 'szary'
          ? 'from-slate-500 via-slate-400 to-slate-500'
          : 'from-sky-400 via-blue-500 to-sky-400';

  return (
    <div className='mt-3 h-2 overflow-hidden rounded-full bg-slate-700/60'>
      <div className={`h-full rounded-full bg-gradient-to-r ${klasy}`} style={{ width: `${procent}%` }} />
    </div>
  );
}

function KartaKpi({
  etykieta,
  wartosc,
  pasek,
  limit,
  ikona,
  kolor,
}: {
  etykieta: string;
  wartosc: string;
  pasek: number;
  limit: number;
  ikona: ReactNode;
  kolor?: 'niebieski' | 'zielony' | 'czerwony' | 'szary';
}) {
  return (
    <article className='rounded-[26px] border border-obramowanie bg-tlo-karta/70 p-5 shadow-xl shadow-black/10'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <div className='text-sm text-tekst-drugorzedny'>{etykieta}</div>
          <div className='mt-3 text-2xl font-semibold text-tekst-glowny'>{wartosc}</div>
        </div>
        <div className='flex h-11 w-11 items-center justify-center rounded-2xl border border-obramowanie bg-tlo-glowne text-akcent'>
          {ikona}
        </div>
      </div>
      <PasekPostepu wartosc={pasek} limit={limit} kolor={kolor} />
    </article>
  );
}

function WierszKosztu({
  etykieta,
  planowanyCzas,
  planowanyKoszt,
  zrealizowanyCzas,
  zrealizowanyKoszt,
  wyrozniony = false,
}: {
  etykieta: string;
  planowanyCzas: number;
  planowanyKoszt: number;
  zrealizowanyCzas: number;
  zrealizowanyKoszt: number;
  wyrozniony?: boolean;
}) {
  const procentCzasu = obliczProcent(zrealizowanyCzas, planowanyCzas);
  const procentKosztu = obliczProcent(zrealizowanyKoszt, planowanyKoszt);
  const klasyWiersza = wyrozniony ? 'bg-akcent text-white' : 'odd:bg-tlo-glowne/25';

  return (
    <tr className={klasyWiersza}>
      <td className='border-b border-r border-obramowanie px-4 py-4 font-semibold'>{etykieta}</td>
      <td className='border-b border-r border-obramowanie px-4 py-4 text-center text-tekst-glowny'>
        {planowanyCzas > 0 ? formatujCzasZGodzin(planowanyCzas) : '-'}
      </td>
      <td className='border-b border-r border-obramowanie px-4 py-4 text-center text-tekst-glowny'>
        {planowanyKoszt > 0 ? formatujWalute(planowanyKoszt) : '-'}
      </td>
      <td className='border-b border-r border-obramowanie px-4 py-4 text-center'>
        <div className='font-semibold text-tekst-glowny'>
          {zrealizowanyCzas > 0 ? formatujCzasZGodzin(zrealizowanyCzas) : '-'}
        </div>
        {planowanyCzas > 0 ? (
          <div className={procentCzasu > 100 ? 'text-red-300' : 'text-emerald-300'}>
            ({formatujLiczbe(procentCzasu)}%)
          </div>
        ) : null}
      </td>
      <td className='border-b border-obramowanie px-4 py-4 text-center'>
        <div className='font-semibold text-tekst-glowny'>
          {zrealizowanyKoszt > 0 ? formatujWalute(zrealizowanyKoszt) : '-'}
        </div>
        {planowanyKoszt > 0 ? (
          <div className={procentKosztu > 100 ? 'text-red-300' : 'text-emerald-300'}>
            ({formatujLiczbe(procentKosztu)}%)
          </div>
        ) : null}
      </td>
    </tr>
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

    return () => {
      document.removeEventListener('mousedown', obsluzKlik);
    };
  }, [otwarte, onClose]);

  return (
    <div ref={ref} className='relative flex justify-center'>
      <button
        type='button'
        onClick={onToggle}
        className='inline-flex h-10 w-10 items-center justify-center rounded-full border border-obramowanie bg-tlo-glowne text-akcent transition hover:border-akcent hover:bg-akcent/10'
        aria-label='Pokaz akcje'
      >
        <MoreHorizontal className='h-4 w-4' />
      </button>

      {otwarte ? (
        <div className='absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-2xl border border-obramowanie bg-tlo-karta shadow-2xl'>
          {elementy.map((element) => (
            <button
              key={element.etykieta}
              type='button'
              onClick={() => {
                element.akcja?.();
                onClose();
              }}
              className='flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-tekst-glowny transition hover:bg-tlo-glowne'
            >
              <span className='shrink-0 text-akcent'>{element.ikona}</span>
              <span>{element.etykieta}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SekcjaPustejTabeliMagazynowej({
  tytul,
  opis,
  kolumny,
  onDodaj,
}: {
  tytul: string;
  opis: string;
  kolumny: string[];
  onDodaj: () => void;
}) {
  return (
    <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
      <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h2 className='text-2xl font-semibold text-tekst-glowny'>{tytul}</h2>
          <p className='mt-1 text-sm text-tekst-drugorzedny'>{opis}</p>
        </div>
        <button
          type='button'
          onClick={onDodaj}
          className='inline-flex items-center gap-2 rounded-full bg-akcent px-6 py-3 text-sm font-semibold uppercase tracking-[0.04em] text-white transition hover:bg-akcent-hover'
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
                {kolumny.map((etykieta) => (
                  <th
                    key={etykieta}
                    className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold last:border-r-0'
                  >
                    {etykieta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className='bg-tlo-glowne/20'>
                <td colSpan={kolumny.length} className='px-5 py-5 text-sm text-tekst-drugorzedny'>
                  <div className='flex items-center gap-3'>
                    <div className='flex h-8 w-8 items-center justify-center rounded-full bg-akcent/10 text-akcent'>
                      <AlertTriangle className='h-4 w-4' />
                    </div>
                    <span>Nie znaleziono danych dla tego zamowienia zgrupowanego.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function ZamowienieZgrupowane() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const numer = searchParams.get('numer') ?? '';
  const [aktywnaZakladka, ustawAktywnaZakladke] = useState<Zakladka>('Progres');
  const [dane, ustawDane] = useState<OdpowiedzZamowieniaZgrupowanego | null>(null);
  const [szczegolyZlecen, ustawSzczegolyZlecen] = useState<SzczegolyZlecenia[]>([]);
  const [historiaPracyWiersze, ustawHistoriePracyWiersze] = useState<WierszHistoriiZamowienia[]>([]);
  const [klienci, ustawKlientow] = useState<Klient[]>([]);
  const [formularzEdycji, ustawFormularzEdycji] = useState<FormularzEdycji>({
    klientId: '',
    zewnetrznyNumer: '',
    wlasne: false,
    oczekiwanaData: '',
    terminPotwierdzony: '',
    dataWysylki: '',
    uwagiWidoczne: '',
    uwagiNiewidoczne: '',
  });
  const [ladowanie, ustawLadowanie] = useState(true);
  const [blad, ustawBlad] = useState('');
  const [zapisywanieEdycji, ustawZapisywanieEdycji] = useState(false);
  const [komunikatEdycji, ustawKomunikatEdycji] = useState('');
  const [otwarteMenuSurowca, ustawOtwarteMenuSurowca] = useState<number | null>(null);

  useEffect(() => {
    let anulowano = false;

    const pobierzDane = async () => {
      if (!numer) {
        ustawBlad('Brak numeru zamowienia zgrupowanego.');
        ustawLadowanie(false);
        return;
      }

      ustawLadowanie(true);
      ustawBlad('');

      try {
        const odpowiedz = await klientApi.get<OdpowiedzApi<OdpowiedzZamowieniaZgrupowanego>>('/zamowienia/grupowane', {
          params: { numer },
        });

        if (anulowano) {
          return;
        }

        const daneZgrupowane = odpowiedz.data.dane;
        ustawDane(daneZgrupowane);

        const idsZlecen = daneZgrupowane.zamowienia.flatMap((zamowienie) =>
          zamowienie.zlecenia.map((zlecenie) => zlecenie.id)
        );

        const odpowiedziZlecen = await Promise.all(
          idsZlecen.map((idZlecenia) =>
            klientApi.get<OdpowiedzApi<SzczegolyZlecenia>>(`/zlecenia-produkcyjne/${idZlecenia}`)
          )
        );

        const odpowiedziHistorii = await Promise.all(
          idsZlecen.map((idZlecenia) =>
            klientApi.get<OdpowiedzHistoriiPracy>('/historia-pracy', {
              params: { page: 1, limit: 200, zlecenieId: idZlecenia },
            })
          )
        );

        if (anulowano) {
          return;
        }

        ustawSzczegolyZlecen(odpowiedziZlecen.map((element) => element.data.dane));
        ustawHistoriePracyWiersze(
          odpowiedziHistorii
            .flatMap((element) => element.data.dane ?? [])
            .filter((wiersz, indeks, tablica) => tablica.findIndex((element) => element.id === wiersz.id) === indeks)
            .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
        );
      } catch {
        if (!anulowano) {
          ustawBlad('Nie udalo sie pobrac zamowienia zgrupowanego.');
          ustawDane(null);
          ustawSzczegolyZlecen([]);
          ustawHistoriePracyWiersze([]);
        }
      } finally {
        if (!anulowano) {
          ustawLadowanie(false);
        }
      }
    };

    void pobierzDane();

    return () => {
      anulowano = true;
    };
  }, [numer]);

  useEffect(() => {
    let anulowano = false;

    const pobierzKlientow = async () => {
      try {
        const odpowiedz = await klientApi.get<OdpowiedzListy<Klient>>('/klienci', {
          params: {
            strona: 1,
            iloscNaStrone: 200,
            sortPole: 'nazwa',
            sortKierunek: 'asc',
          },
        });

        if (!anulowano) {
          ustawKlientow(odpowiedz.data.dane ?? []);
        }
      } catch {
        if (!anulowano) {
          ustawKlientow([]);
        }
      }
    };

    void pobierzKlientow();

    return () => {
      anulowano = true;
    };
  }, []);

  useEffect(() => {
    if (!dane) {
      return;
    }

    const metaUwagi = rozdzielUwagiZMeta(dane.zamowienia[0]?.uwagi ?? null);

    ustawFormularzEdycji({
      klientId: dane.klient?.id ? String(dane.klient.id) : '',
      zewnetrznyNumer: dane.numer,
      wlasne: !dane.klient,
      oczekiwanaData: naDateInput(dane.oczekiwanaData),
      terminPotwierdzony: metaUwagi.terminPotwierdzony,
      dataWysylki: metaUwagi.dataWysylki,
      uwagiWidoczne: metaUwagi.widoczne,
      uwagiNiewidoczne: metaUwagi.niewidoczne,
    });
  }, [dane]);

  const podsumowanie = useMemo(() => {
    if (!dane) {
      return null;
    }

    const mapaZlecenNaZamowienie = new Map<number, SzczegolyZlecenia[]>();
    szczegolyZlecen.forEach((zlecenie) => {
      const lista = mapaZlecenNaZamowienie.get(zlecenie.zamowienieId) ?? [];
      lista.push(zlecenie);
      mapaZlecenNaZamowienie.set(zlecenie.zamowienieId, lista);
    });

    const wierszeProduktow: WierszProduktu[] = dane.zamowienia.map((zamowienie) => {
      const zleceniaZamowienia = mapaZlecenNaZamowienie.get(zamowienie.id) ?? [];
      const finalneZlecenia = pobierzFinalneZlecenia(zleceniaZamowienia);
      const produktyPlan = zamowienie.pozycje.reduce((suma, pozycja) => suma + naLiczbe(pozycja.ilosc), 0);
      const produktyGotowe = finalneZlecenia.reduce((suma, zlecenie) => suma + naLiczbe(zlecenie.iloscWykonana), 0);
      const sumaNetto = zamowienie.pozycje.reduce((suma, pozycja) => {
        const cena = pozycja.cena != null ? naLiczbe(pozycja.cena) : naLiczbe(pozycja.produkt?.cena);
        return suma + naLiczbe(pozycja.ilosc) * cena;
      }, 0);
      const status = pobierzStatusWiersza(zamowienie.status, produktyGotowe, produktyPlan);
      const nazwaProduktu =
        zamowienie.pozycje.length === 0
          ? 'Brak pozycji'
          : zamowienie.pozycje.length === 1
            ? zamowienie.pozycje[0]?.produkt?.nazwa || 'Produkt'
            : `${zamowienie.pozycje[0]?.produkt?.nazwa || 'Produkt'} + ${zamowienie.pozycje.length - 1} kolejne`;

      return {
        klucz: String(zamowienie.id),
        zamowienieId: zamowienie.id,
        idProdio: zamowienie.idProdio,
        status: status.etykieta,
        statusKlasy: status.klasy,
        pozostaleDni: obliczDniPozostale(zamowienie.oczekiwanaData),
        produkt: nazwaProduktu,
        produktyGotowe,
        produktyPlan,
        zleceniaGotowe: zleceniaZamowienia.filter((zlecenie) => zlecenie.status === 'GOTOWE').length,
        zleceniaWszystkie: zleceniaZamowienia.length,
        sumaNetto,
        uwagi: rozdzielUwagi(zamowienie.uwagi).widoczne || '-',
      };
    });

    const zamowieniaZak = dane.zamowienia.filter((zamowienie) =>
      ['GOTOWE', 'WYDANE', 'ZAMKNIETE'].includes(zamowienie.status)
    ).length;
    const zamowieniaWszystkie = dane.zamowienia.length;
    const produktyPlan = wierszeProduktow.reduce((suma, wiersz) => suma + wiersz.produktyPlan, 0);
    const produktyGotowe = wierszeProduktow.reduce((suma, wiersz) => suma + wiersz.produktyGotowe, 0);
    const produktyWydane = dane.zamowienia.reduce((suma, zamowienie) => {
      if (zamowienie.status !== 'WYDANE' && zamowienie.status !== 'ZAMKNIETE') {
        return suma;
      }

      return suma + zamowienie.pozycje.reduce((sumaPozycji, pozycja) => sumaPozycji + naLiczbe(pozycja.ilosc), 0);
    }, 0);

    const sumaOperacji = szczegolyZlecen.reduce(
      (akumulator, zlecenie) => {
        const operacje = zlecenie.koszty.tabelaKosztow.find((wiersz) => wiersz.klucz === 'suma-operacje');
        const ustawianie = zlecenie.koszty.tabelaKosztow.find((wiersz) => wiersz.klucz === 'ustawianie');
        const maszyny = zlecenie.koszty.tabelaKosztow.find((wiersz) => wiersz.klucz === 'maszyny');
        const pracownicy = zlecenie.koszty.tabelaKosztow.find((wiersz) => wiersz.klucz === 'pracownicy');

        return {
          planowanyCzas: akumulator.planowanyCzas + naLiczbe(operacje?.planowanyCzas),
          zrealizowanyCzas: akumulator.zrealizowanyCzas + naLiczbe(operacje?.zrealizowanyCzas),
          planowanyKosztOperacji: akumulator.planowanyKosztOperacji + naLiczbe(operacje?.planowanyKoszt),
          zrealizowanyKosztOperacji: akumulator.zrealizowanyKosztOperacji + naLiczbe(operacje?.zrealizowanyKoszt),
          planowanyKosztMaszyn: akumulator.planowanyKosztMaszyn + naLiczbe(maszyny?.planowanyKoszt),
          zrealizowanyKosztMaszyn: akumulator.zrealizowanyKosztMaszyn + naLiczbe(maszyny?.zrealizowanyKoszt),
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

    const iloscDobrychProduktow = dane.zamowienia.reduce((suma, zamowienie) => {
      const zleceniaZamowienia = mapaZlecenNaZamowienie.get(zamowienie.id) ?? [];
      const finalneZlecenia = pobierzFinalneZlecenia(zleceniaZamowienia);

      return (
        suma +
        finalneZlecenia.reduce(
          (sumaFinalna, zlecenie) =>
            sumaFinalna + Math.max(0, naLiczbe(zlecenie.iloscWykonana) - naLiczbe(zlecenie.iloscBrakow)),
          0
        )
      );
    }, 0);

    const agregacjaSurowcow = new Map<number, WierszSurowca>();

    dane.zamowienia.forEach((zamowienie) => {
      const wiersz = wierszeProduktow.find((element) => element.zamowienieId === zamowienie.id);
      const wspolczynnikRealizacji =
        wiersz && wiersz.produktyPlan > 0 ? Math.min(1, wiersz.produktyGotowe / wiersz.produktyPlan) : 0;

      zamowienie.pozycje.forEach((pozycja) => {
        pozycja.produkt?.bomSurowcow.forEach((bom) => {
          const planowanaIlosc = naLiczbe(bom.ilosc) * naLiczbe(pozycja.ilosc);
          const zrealizowanaIlosc = planowanaIlosc * wspolczynnikRealizacji;
          const cena = naLiczbe(bom.surowiec.cena);
          const istniejacy = agregacjaSurowcow.get(bom.surowiec.id) ?? {
            klucz: bom.surowiec.id,
            nazwa: bom.surowiec.nazwa,
            liczbaZamowien: 0,
            iloscNaZamowienie: 0,
            iloscZuzyta: 0,
            jednostka: bom.surowiec.jednostka,
            planowanyKoszt: 0,
            zrealizowanyKoszt: 0,
            naStanie: 0,
            naProdukcji: 0,
          };

          istniejacy.iloscNaZamowienie += planowanaIlosc;
          istniejacy.iloscZuzyta += zrealizowanaIlosc;
          istniejacy.planowanyKoszt += planowanaIlosc * cena;
          istniejacy.zrealizowanyKoszt += zrealizowanaIlosc * cena;
          agregacjaSurowcow.set(bom.surowiec.id, istniejacy);
        });
      });
    });

    dane.zamowienia.forEach((zamowienie) => {
      const surowceWZamowieniu = new Set<number>();

      zamowienie.pozycje.forEach((pozycja) => {
        pozycja.produkt?.bomSurowcow.forEach((bom) => {
          surowceWZamowieniu.add(bom.surowiec.id);
        });
      });

      surowceWZamowieniu.forEach((surowiecId) => {
        const istniejacy = agregacjaSurowcow.get(surowiecId);
        if (istniejacy) {
          istniejacy.liczbaZamowien += 1;
        }
      });
    });

    const surowce = [...agregacjaSurowcow.values()]
      .map((surowiec) => ({
        ...surowiec,
        naStanie: -(surowiec.iloscNaZamowienie - surowiec.iloscZuzyta),
        naProdukcji: -surowiec.iloscZuzyta,
      }))
      .sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'));

    const planowanyKosztSurowcow = surowce.reduce(
      (suma, wiersz) => suma + wiersz.planowanyKoszt,
      0
    );
    const zrealizowanyKosztSurowcow = surowce.reduce(
      (suma, wiersz) => suma + wiersz.zrealizowanyKoszt,
      0
    );

    const kosztCalkowityPlan =
      sumaOperacji.planowanyKosztOperacji + sumaOperacji.planowanyKosztUstawiania + planowanyKosztSurowcow;
    const kosztCalkowityReal =
      sumaOperacji.zrealizowanyKosztOperacji + sumaOperacji.zrealizowanyKosztUstawiania + zrealizowanyKosztSurowcow;

    return {
      wierszeProduktow,
      zamowieniaZak,
      zamowieniaWszystkie,
      produktyPlan,
      produktyGotowe,
      produktyWydane,
      czasPlanowany: sumaOperacji.planowanyCzas,
      czasZrealizowany: sumaOperacji.zrealizowanyCzas,
      kosztMaszynPlan: sumaOperacji.planowanyKosztMaszyn,
      kosztMaszynReal: sumaOperacji.zrealizowanyKosztMaszyn,
      kosztPracownikowPlan: sumaOperacji.planowanyKosztPracownikow,
      kosztPracownikowReal: sumaOperacji.zrealizowanyKosztPracownikow,
      kosztOperacjiPlan: sumaOperacji.planowanyKosztOperacji,
      kosztOperacjiReal: sumaOperacji.zrealizowanyKosztOperacji,
      surowce,
      kosztUstawianiaPlan: sumaOperacji.planowanyKosztUstawiania,
      kosztUstawianiaReal: sumaOperacji.zrealizowanyKosztUstawiania,
      kosztSurowcowPlan: planowanyKosztSurowcow,
      kosztSurowcowReal: zrealizowanyKosztSurowcow,
      kosztCalkowityPlan,
      kosztCalkowityReal,
      kosztNaProduktPlan: iloscDobrychProduktow > 0 ? kosztCalkowityPlan / iloscDobrychProduktow : 0,
      kosztNaProduktReal: iloscDobrychProduktow > 0 ? kosztCalkowityReal / iloscDobrychProduktow : 0,
    };
  }, [dane, szczegolyZlecen]);

  const zapiszEdycje = async () => {
    if (!dane) {
      return;
    }

    ustawZapisywanieEdycji(true);
    ustawKomunikatEdycji('');

    try {
      await klientApi.put('/zamowienia/grupowane', {
        klientId: formularzEdycji.wlasne ? null : formularzEdycji.klientId || null,
        zewnetrznyNumer: formularzEdycji.zewnetrznyNumer,
        oczekiwanaData: formularzEdycji.oczekiwanaData || null,
        uwagi: polaczUwagiZMeta({
          uwagiWidoczne: formularzEdycji.uwagiWidoczne,
          uwagiNiewidoczne: formularzEdycji.uwagiNiewidoczne,
          terminPotwierdzony: formularzEdycji.terminPotwierdzony,
          dataWysylki: formularzEdycji.dataWysylki,
        }) ?? null,
      }, {
        params: { numer: dane.numer },
      });

      ustawDane((poprzednie) =>
        poprzednie
          ? {
              ...poprzednie,
              numer: formularzEdycji.zewnetrznyNumer,
              klient: formularzEdycji.wlasne
                ? null
                : klienci.find((klient) => String(klient.id) === formularzEdycji.klientId) ?? null,
              oczekiwanaData: formularzEdycji.oczekiwanaData || null,
              zamowienia: poprzednie.zamowienia.map((zamowienie) => ({
                ...zamowienie,
                zewnetrznyNumer: formularzEdycji.zewnetrznyNumer || null,
                klient: formularzEdycji.wlasne
                  ? null
                  : klienci.find((klient) => String(klient.id) === formularzEdycji.klientId) ?? null,
                oczekiwanaData: formularzEdycji.oczekiwanaData || null,
                uwagi:
                  polaczUwagiZMeta({
                    uwagiWidoczne: formularzEdycji.uwagiWidoczne,
                    uwagiNiewidoczne: formularzEdycji.uwagiNiewidoczne,
                    terminPotwierdzony: formularzEdycji.terminPotwierdzony,
                    dataWysylki: formularzEdycji.dataWysylki,
                  }) ?? null,
              })),
            }
          : poprzednie
      );
      ustawKomunikatEdycji('Zmiany zostaly zapisane we wszystkich zamowieniach tej grupy.');
    } catch {
      ustawKomunikatEdycji('Nie udalo sie zapisac zmian.');
    } finally {
      ustawZapisywanieEdycji(false);
    }
  };

  if (ladowanie) {
    return (
      <div className='flex min-h-[60vh] items-center justify-center rounded-[28px] border border-obramowanie bg-tlo-karta/70 text-tekst-drugorzedny'>
        Ladowanie zamowienia zgrupowanego...
      </div>
    );
  }

  if (blad || !dane || !podsumowanie) {
    return (
      <div className='rounded-[28px] border border-red-500/30 bg-red-500/10 px-6 py-5 text-red-200'>
        {blad || 'Nie udalo sie wyswietlic zamowienia zgrupowanego.'}
      </div>
    );
  }

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
                Wroc do listy
              </Link>
              <span className='rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-orange-200'>
                Zamowienie zgrupowane
              </span>
            </div>

            <div>
              <h1 className='text-3xl font-semibold text-tekst-glowny sm:text-4xl'>
                {dane.numer}
              </h1>
              <div className='mt-2 text-sm text-tekst-drugorzedny'>
                Zbiorczy widok dla wielu zamowien i wielu produktow podpietych pod ten sam numer zewnetrzny.
              </div>
            </div>

            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/45 px-4 py-3'>
                <div className='text-sm text-tekst-drugorzedny'>Klient</div>
                <div className='mt-2 font-medium text-tekst-glowny'>{dane.klient?.nazwa || '-'}</div>
              </div>
              <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/45 px-4 py-3'>
                <div className='text-sm text-tekst-drugorzedny'>Data</div>
                <div className='mt-2 font-medium text-tekst-glowny'>{formatujDate(dane.utworzonyW)}</div>
              </div>
              <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/45 px-4 py-3'>
                <div className='text-sm text-tekst-drugorzedny'>Pozycji / zamowien</div>
                <div className='mt-2 font-medium text-tekst-glowny'>
                  {podsumowanie.wierszeProduktow.length} / {podsumowanie.zamowieniaWszystkie}
                </div>
              </div>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-3 xl:justify-end'>
            {[
              { etykieta: 'Zaplanuj', ikona: <Clock3 className='h-4 w-4' /> },
              { etykieta: 'Drukuj', ikona: <Printer className='h-4 w-4' />, akcja: () => window.print() },
              { etykieta: 'Duplikuj', ikona: <Copy className='h-4 w-4' /> },
              { etykieta: 'Zamknij', ikona: <X className='h-4 w-4' />, akcja: () => navigate('/zamowienia') },
            ].map((przycisk) => (
              <button
                key={przycisk.etykieta}
                type='button'
                onClick={przycisk.akcja}
                className='inline-flex h-11 items-center gap-2 rounded-full border border-obramowanie bg-tlo-glowne/50 px-5 text-sm font-semibold text-tekst-glowny transition hover:border-akcent hover:text-akcent'
              >
                {przycisk.ikona}
                {przycisk.etykieta}
              </button>
            ))}
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
                  aktywna ? 'border-b-2 border-emerald-400 text-tekst-glowny' : 'text-tekst-drugorzedny hover:text-tekst-glowny'
                }`}
              >
                {zakladka}
              </button>
            );
          })}
        </div>
      </section>

      {aktywnaZakladka === 'Wydania magazynowe' ? (
        <section className='space-y-6'>
          <SekcjaPustejTabeliMagazynowej
            tytul='Wydania magazynowe'
            opis='Zestawienie wydan magazynowych powiazanych z calym zamowieniem zgrupowanym.'
            kolumny={[
              'ID Prodio',
              'Magazyn',
              'Produkt/surowiec',
              'Ilosc',
              'Ilosc zamowiona',
              'Dostawca/Klient',
              'Identyfikacja',
              'Data',
              'Cena',
              'Uwagi',
            ]}
            onDodaj={() => navigate('/magazyn/wydania-magazynowe')}
          />
        </section>
      ) : false ? (
        <section className='space-y-6'>
          <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
            <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <h2 className='text-2xl font-semibold text-tekst-glowny'>Wydania magazynowe</h2>
              </div>
              <button
                type='button'
                className='inline-flex items-center gap-2 rounded-full bg-akcent px-6 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover'
              >
                <Plus className='h-4 w-4' />
                DODAJ
              </button>
            </div>

            <div className='overflow-hidden rounded-[24px] border border-obramowanie'>
              <div className='overflow-x-auto'>
                <table className='min-w-[1320px] w-full text-sm'>
                  <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                    <tr>
                      {['ID Prodio', 'Magazyn', 'Produkt/surowiec', 'Ilość', 'Ilość zamówiona', 'Dostawca/Klient', 'Identyfikacja', 'Data', 'Cena', 'Uwagi'].map((etykieta) => (
                        <th
                          key={etykieta}
                          className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold last:border-r-0'
                        >
                          {etykieta}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={10} className='px-4 py-5 text-sm text-tekst-drugorzedny'>
                        <div className='flex items-center gap-3'>
                          <AlertTriangle className='h-5 w-5 text-tekst-glowny' />
                          <span>Nie znaleziono danych</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </section>
      ) : aktywnaZakladka === 'Przyjecia magazynowe' ? (
        <section className='space-y-6'>
          <SekcjaPustejTabeliMagazynowej
            tytul='Przyjecia magazynowe'
            opis='Zestawienie przyjec magazynowych dla wszystkich pozycji skladajacych sie na to zamowienie zgrupowane.'
            kolumny={[
              'ID Prodio',
              'Magazyn',
              'Produkt/surowiec',
              'Dostarczone/Zamowione',
              'Ilosc zamowiona',
              'Dostawca/Klient',
              'Identyfikacja',
              'Data',
              'Cena',
              'Uwagi',
            ]}
            onDodaj={() => navigate('/magazyn/przyjecia-magazynowe')}
          />
        </section>
      ) : false ? (
        <section className='space-y-6'>
          <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
            <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <h2 className='text-2xl font-semibold text-tekst-glowny'>Przyjęcia magazynowe</h2>
              </div>
              <button
                type='button'
                className='inline-flex items-center gap-2 rounded-full bg-akcent px-6 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover'
              >
                <Plus className='h-4 w-4' />
                DODAJ
              </button>
            </div>

            <div className='overflow-hidden rounded-[24px] border border-obramowanie'>
              <div className='overflow-x-auto'>
                <table className='min-w-[1320px] w-full text-sm'>
                  <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                    <tr>
                      {['ID Prodio', 'Magazyn', 'Produkt/surowiec', 'Dostarczone/Zamówione', 'Ilość zamówiona', 'Dostawca/Klient', 'Identyfikacja', 'Data', 'Cena', 'Uwagi'].map((etykieta) => (
                        <th
                          key={etykieta}
                          className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold last:border-r-0'
                        >
                          {etykieta}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={10} className='px-4 py-5 text-sm text-tekst-drugorzedny'>
                        <div className='flex items-center gap-3'>
                          <AlertTriangle className='h-5 w-5 text-tekst-glowny' />
                          <span>Nie znaleziono danych</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </section>
      ) : aktywnaZakladka === 'Historia pracy' ? (
        <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
          <div className='mb-6'>
            <h2 className='text-2xl font-semibold text-tekst-glowny'>Historia pracy</h2>
          </div>

          <div className='overflow-hidden rounded-3xl border border-obramowanie'>
            <div className='overflow-x-auto'>
              <table className='min-w-[1680px] w-full text-sm'>
                <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                  <tr>
                    <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>ID Prodio</th>
                    <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Nr zlecenia</th>
                    <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Maszyna/Operacja</th>
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
                      <td colSpan={15} className='px-6 py-12 text-center text-tekst-drugorzedny'>
                        Brak wpisow historii pracy dla tego zamowienia zgrupowanego.
                      </td>
                    </tr>
                  ) : (
                    historiaPracyWiersze.map((wiersz) => {
                      const zamowienie = dane.zamowienia.find((element) => element.id === wiersz.zamowienieId);
                      const ostrzezenieWydajnosci = wiersz.wydajnoscProcent < 100;
                      const uwagi = [...wiersz.powodyPrzerw, ...wiersz.tagi].filter(Boolean).join(', ');

                      return (
                        <tr key={wiersz.id} className='odd:bg-tlo-glowne/25 even:bg-tlo-karta/20'>
                          <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                            <span className='border-b border-dashed border-akcent text-akcent'>
                              {zamowienie?.idProdio || '-'}
                            </span>
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                            <span className='border-b border-dashed border-akcent text-akcent'>{wiersz.numerZlecenia}</span>
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                            {wiersz.maszynaOperacja.nazwa}
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                            <span className='border-b border-dashed border-akcent text-akcent'>
                              {pobierzNazwePracownika(wiersz.pracownik)}
                            </span>
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-right text-tekst-glowny'>
                            {formatujLiczbe(wiersz.iloscWykonana, 2)}
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                            <div className='flex items-center gap-2 text-tekst-glowny'>
                              <span>{wiersz.formatowanyCzas || '-'}</span>
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
                            {wiersz.formatowanaPauza || '-'}
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
                            {wiersz.opisBrakow || ''}
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-center'>
                            {wiersz.operacjaKoncowa ? (
                              <Check className='mx-auto h-4 w-4 text-emerald-300' />
                            ) : (
                              <X className='mx-auto h-4 w-4 text-red-300' />
                            )}
                          </td>
                          <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-drugorzedny'>
                            {uwagi}
                          </td>
                          <td className='border-b border-obramowanie px-4 py-4 align-top text-center'>
                            <div className='flex items-center justify-center gap-3 text-akcent'>
                              <button type='button' className='transition hover:text-akcent-hover' aria-label={`Drukuj wpis ${wiersz.id}`}>
                                <Printer className='h-4 w-4' />
                              </button>
                              <button type='button' className='transition hover:text-akcent-hover' aria-label={`Edytuj wpis ${wiersz.id}`}>
                                <SquarePen className='h-4 w-4' />
                              </button>
                            </div>
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
      ) : aktywnaZakladka === 'Surowce' ? (
        <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
          <div className='mb-5'>
            <h2 className='text-2xl font-semibold text-tekst-glowny'>Podsumowanie surowcow</h2>
          </div>

          <div className='overflow-hidden rounded-3xl border border-obramowanie'>
            <div className='overflow-x-auto'>
              <table className='min-w-[1480px] w-full text-sm'>
                <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                  <tr>
                    <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Nazwa</th>
                    <th className='border-b border-r border-obramowanie px-4 py-4 text-center font-semibold'>Zamowienia</th>
                    <th className='border-b border-r border-obramowanie px-4 py-4 text-right font-semibold'>Ilosc na zamowienie</th>
                    <th className='border-b border-r border-obramowanie px-4 py-4 text-right font-semibold'>Ilosc zuzyta</th>
                    <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Ilosc zuzyta/ilosc na zamowienie</th>
                    <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Jednostka</th>
                    <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Stany magazynowe</th>
                    <th className='border-b border-r border-obramowanie px-4 py-4 text-left font-semibold'>Aktualny/Planowany koszt zuzycia</th>
                    <th className='border-b border-obramowanie px-4 py-4 text-center font-semibold'>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {podsumowanie.surowce.length === 0 ? (
                    <tr>
                      <td colSpan={9} className='px-6 py-10 text-center text-sm text-tekst-drugorzedny'>
                        Brak surowcow powiazanych z pozycjami tego zamowienia zgrupowanego.
                      </td>
                    </tr>
                  ) : (
                    podsumowanie.surowce.map((surowiec) => (
                      <tr key={surowiec.klucz} className='odd:bg-tlo-glowne/35 even:bg-tlo-karta/20'>
                        <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                          <span className='border-b border-dashed border-akcent text-akcent transition hover:text-akcent-hover'>
                            {surowiec.nazwa}
                          </span>
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 text-center align-top text-tekst-glowny'>
                          {formatujLiczbe(surowiec.liczbaZamowien)}
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 text-right align-top text-tekst-glowny'>
                          {formatujLiczbe(surowiec.iloscNaZamowienie)}
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 text-right align-top text-akcent'>
                          {formatujLiczbe(surowiec.iloscZuzyta)}
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                          <div className='text-tekst-glowny'>
                            {formatujLiczbe(surowiec.iloscZuzyta)} / {formatujLiczbe(surowiec.iloscNaZamowienie)}
                          </div>
                          <PasekPostepu
                            wartosc={surowiec.iloscZuzyta}
                            limit={Math.max(1, surowiec.iloscNaZamowienie)}
                            kolor='zielony'
                          />
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                          {surowiec.jednostka}
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                          <div>
                            Na stanie:{' '}
                            <span className={surowiec.naStanie < 0 ? 'font-semibold text-red-300' : 'font-semibold text-emerald-300'}>
                              {formatujLiczbe(surowiec.naStanie)}
                            </span>
                          </div>
                          <div className='mt-1'>
                            Na produkcji:{' '}
                            <span className='font-semibold text-red-300'>{formatujLiczbe(surowiec.naProdukcji)}</span>
                          </div>
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                          <div className='text-tekst-glowny'>
                            {formatujWalute(surowiec.zrealizowanyKoszt)} / {formatujWalute(surowiec.planowanyKoszt)}
                          </div>
                          <PasekPostepu
                            wartosc={surowiec.zrealizowanyKoszt}
                            limit={Math.max(1, surowiec.planowanyKoszt)}
                            kolor='zielony'
                          />
                        </td>
                        <td className='border-b border-obramowanie px-4 py-4 text-center align-top'>
                          <MenuAkcji
                            elementy={[
                              {
                                etykieta: 'Zamowiono',
                                ikona: <ShoppingCart className='h-4 w-4' />,
                                akcja: () => navigate('/magazyn/zamowienia-dostawcow'),
                              },
                              {
                                etykieta: 'Przyjecia',
                                ikona: <PackageCheck className='h-4 w-4' />,
                                akcja: () => navigate('/magazyn/przyjecia-magazynowe'),
                              },
                              {
                                etykieta: 'Wydania',
                                ikona: <Truck className='h-4 w-4' />,
                                akcja: () => navigate('/magazyn/wydania-magazynowe'),
                              },
                              {
                                etykieta: 'Przeniesienia',
                                ikona: <ArrowRightLeft className='h-4 w-4' />,
                                akcja: () => navigate('/magazyn/przeniesienia-magazynowe'),
                              },
                              {
                                etykieta: 'Pokaz zuzycie',
                                ikona: <Package className='h-4 w-4' />,
                                akcja: () => navigate('/historia-pracy'),
                              },
                            ]}
                            otwarte={otwarteMenuSurowca === surowiec.klucz}
                            onToggle={() =>
                              ustawOtwarteMenuSurowca((poprzednie) =>
                                poprzednie === surowiec.klucz ? null : surowiec.klucz
                              )
                            }
                            onClose={() => ustawOtwarteMenuSurowca(null)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : aktywnaZakladka === 'Edytuj' ? (
        <div className='overflow-hidden rounded-[28px] border border-obramowanie bg-tlo-karta/70 shadow-xl shadow-black/10'>
          <div className='border-b border-obramowanie bg-akcent/15 px-6 py-4 text-sm font-medium text-orange-100'>
            Uzupelnione pola nadpisza dane we wszystkich zamowieniach z zewnetrznym numerem zamowienia: {dane.numer}
          </div>

          <div className='space-y-8 p-6'>
            <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_240px_minmax(0,1fr)]'>
              <label className='block'>
                <span className='sr-only'>Klient</span>
                <div className='relative'>
                  <select
                    value={formularzEdycji.wlasne ? '' : formularzEdycji.klientId}
                    onChange={(event) =>
                      ustawFormularzEdycji((poprzednie) => ({
                        ...poprzednie,
                        klientId: event.target.value,
                        wlasne: false,
                      }))
                    }
                    className='h-14 w-full appearance-none rounded-xl border border-obramowanie bg-tlo-glowne px-4 pr-12 text-[15px] text-tekst-glowny outline-none transition focus:border-akcent'
                  >
                    <option value=''>Klient</option>
                    {klienci.map((klient) => (
                      <option key={klient.id} value={klient.id}>
                        {klient.nazwa}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className='pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-tekst-drugorzedny' />
                </div>
              </label>

              <label className='block'>
                <span className='sr-only'>Zew. nr zamowienia</span>
                <input
                  value={formularzEdycji.zewnetrznyNumer}
                  onChange={(event) =>
                    ustawFormularzEdycji((poprzednie) => ({
                      ...poprzednie,
                      zewnetrznyNumer: event.target.value,
                    }))
                  }
                  placeholder='Zew. nr zamowienia'
                  className='h-14 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-[15px] text-tekst-glowny outline-none transition focus:border-akcent'
                />
              </label>

              <label className='flex h-14 items-center gap-4 rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-tekst-glowny'>
                <span className='text-[15px]'>Wlasne</span>
                <button
                  type='button'
                  onClick={() =>
                    ustawFormularzEdycji((poprzednie) => ({
                      ...poprzednie,
                      wlasne: !poprzednie.wlasne,
                      klientId: !poprzednie.wlasne ? '' : poprzednie.klientId,
                    }))
                  }
                  className={`relative h-7 w-12 rounded-full transition ${
                    formularzEdycji.wlasne ? 'bg-akcent' : 'bg-obramowanie'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                      formularzEdycji.wlasne ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </label>

              <label className='block'>
                <span className='sr-only'>Oczekiwany termin realizacji</span>
                <input
                  type='date'
                  value={formularzEdycji.oczekiwanaData}
                  onChange={(event) =>
                    ustawFormularzEdycji((poprzednie) => ({
                      ...poprzednie,
                      oczekiwanaData: event.target.value,
                    }))
                  }
                  className='h-14 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-[15px] text-tekst-glowny outline-none transition focus:border-akcent'
                />
              </label>
            </div>

            <div className='grid gap-5 xl:grid-cols-2'>
              <label className='block'>
                <span className='sr-only'>Termin potwierdzony</span>
                <input
                  type='date'
                  value={formularzEdycji.terminPotwierdzony}
                  onChange={(event) =>
                    ustawFormularzEdycji((poprzednie) => ({
                      ...poprzednie,
                      terminPotwierdzony: event.target.value,
                    }))
                  }
                  className='h-14 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-[15px] text-tekst-glowny outline-none transition focus:border-akcent'
                />
              </label>

              <label className='block'>
                <span className='sr-only'>Zaplanowana data wysylki</span>
                <input
                  type='date'
                  value={formularzEdycji.dataWysylki}
                  onChange={(event) =>
                    ustawFormularzEdycji((poprzednie) => ({
                      ...poprzednie,
                      dataWysylki: event.target.value,
                    }))
                  }
                  className='h-14 w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 text-[15px] text-tekst-glowny outline-none transition focus:border-akcent'
                />
              </label>
            </div>

            <div className='grid gap-7 xl:grid-cols-2'>
              <label className='block'>
                <span className='mb-3 block text-sm font-medium text-tekst-drugorzedny'>Uwagi dla wszystkich</span>
                <textarea
                  rows={8}
                  value={formularzEdycji.uwagiWidoczne}
                  onChange={(event) =>
                    ustawFormularzEdycji((poprzednie) => ({
                      ...poprzednie,
                      uwagiWidoczne: event.target.value,
                    }))
                  }
                  className='min-h-[200px] w-full rounded-2xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-[15px] text-tekst-glowny outline-none transition focus:border-akcent'
                />
              </label>

              <label className='block'>
                <span className='mb-3 block text-sm font-medium text-tekst-drugorzedny'>Uwagi niewidoczne dla produkcji</span>
                <textarea
                  rows={8}
                  value={formularzEdycji.uwagiNiewidoczne}
                  onChange={(event) =>
                    ustawFormularzEdycji((poprzednie) => ({
                      ...poprzednie,
                      uwagiNiewidoczne: event.target.value,
                    }))
                  }
                  className='min-h-[200px] w-full rounded-2xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-[15px] text-tekst-glowny outline-none transition focus:border-akcent'
                />
              </label>
            </div>

            {komunikatEdycji ? (
              <div
                className={`rounded-md px-4 py-3 text-sm ${
                  komunikatEdycji.includes('Nie udalo')
                    ? 'border border-red-500/30 bg-red-500/10 text-red-200'
                    : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                }`}
              >
                {komunikatEdycji}
              </div>
            ) : null}
          </div>

          <div className='flex items-center justify-center border-t border-obramowanie bg-tlo-naglowek px-6 py-7'>
            <button
              type='button'
              onClick={() => void zapiszEdycje()}
              disabled={zapisywanieEdycji}
              className='inline-flex items-center gap-2 rounded-full bg-akcent px-8 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover disabled:cursor-not-allowed disabled:opacity-60'
            >
              <Save className='h-4 w-4' />
              {zapisywanieEdycji ? 'ZAPISYWANIE...' : 'ZAPISZ'}
            </button>
          </div>
        </div>
      ) : aktywnaZakladka !== 'Progres' ? (
        <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 text-tekst-drugorzedny shadow-xl shadow-black/10'>
          Sekcja "{aktywnaZakladka}" bedzie rozwijana w tym dedykowanym widoku zgrupowanym. Progres jest juz liczony zbiorczo dla wszystkich produktow i zamowien podpietych pod {dane.numer}.
        </section>
      ) : (
        <>
          <section className='grid gap-4 xl:grid-cols-4'>
            <KartaKpi
              etykieta='Zamowienia (zak./wszyst.)'
              wartosc={`${formatujLiczbe(podsumowanie.zamowieniaZak)} / ${formatujLiczbe(podsumowanie.zamowieniaWszystkie)}`}
              pasek={podsumowanie.zamowieniaZak}
              limit={Math.max(1, podsumowanie.zamowieniaWszystkie)}
              ikona={<ClipboardList className='h-5 w-5' />}
              kolor='szary'
            />
            <KartaKpi
              etykieta='Produkty (got./wszyst.)'
              wartosc={`${formatujLiczbe(podsumowanie.produktyGotowe)} / ${formatujLiczbe(podsumowanie.produktyPlan)}`}
              pasek={podsumowanie.produktyGotowe}
              limit={Math.max(1, podsumowanie.produktyPlan)}
              ikona={<Package className='h-5 w-5' />}
              kolor='niebieski'
            />
            <KartaKpi
              etykieta='Produkty (wyd./wszyst.)'
              wartosc={`${formatujLiczbe(podsumowanie.produktyWydane)} / ${formatujLiczbe(podsumowanie.produktyPlan)}`}
              pasek={podsumowanie.produktyWydane}
              limit={Math.max(1, podsumowanie.produktyPlan)}
              ikona={<Truck className='h-5 w-5' />}
              kolor='szary'
            />
            <KartaKpi
              etykieta='Czas (pracy/norm.)'
              wartosc={`${formatujCzasZGodzin(podsumowanie.czasZrealizowany)} / ${formatujCzasZGodzin(podsumowanie.czasPlanowany)}`}
              pasek={podsumowanie.czasZrealizowany}
              limit={Math.max(0.0001, podsumowanie.czasPlanowany)}
              ikona={<CalendarDays className='h-5 w-5' />}
              kolor={podsumowanie.czasZrealizowany > podsumowanie.czasPlanowany ? 'czerwony' : 'niebieski'}
            />
          </section>

          <section className='rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
            <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
              <div>
                <h2 className='text-2xl font-semibold text-tekst-glowny'>Zamowione produkty</h2>
                <div className='mt-1 text-sm text-tekst-drugorzedny'>
                  Kazdy wiersz reprezentuje osobne zamowienie podrzedne `ZAM-...` w ramach {dane.numer}.
                </div>
              </div>

              <button
                type='button'
                className='inline-flex items-center gap-2 rounded-full bg-akcent px-5 py-3 text-sm font-semibold text-white transition hover:bg-akcent-hover'
              >
                Dodaj pozycje
              </button>
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
                    {podsumowanie.wierszeProduktow.map((wiersz) => (
                      <tr key={wiersz.klucz} className='odd:bg-tlo-glowne/35 even:bg-tlo-karta/20'>
                        <td className='border-b border-r border-obramowanie px-4 py-4 text-center align-top'>
                          <span className={`inline-flex rounded-lg px-3 py-2 text-xs font-semibold ${wiersz.statusKlasy}`}>
                            {wiersz.status}
                          </span>
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                          <Link to={`/zamowienia/${wiersz.zamowienieId}`} className='border-b border-dashed border-akcent text-akcent transition hover:text-akcent-hover'>
                            {wiersz.idProdio}
                          </Link>
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 text-center align-top'>
                          <span className={wiersz.pozostaleDni != null && wiersz.pozostaleDni < 0 ? 'font-semibold text-red-300' : 'font-semibold text-emerald-300'}>
                            {wiersz.pozostaleDni ?? '-'}
                          </span>
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 align-top text-tekst-glowny'>
                          {wiersz.produkt}
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                          <div className='text-tekst-glowny'>
                            {formatujLiczbe(wiersz.produktyGotowe)} / {formatujLiczbe(wiersz.produktyPlan)}
                          </div>
                          <PasekPostepu wartosc={wiersz.produktyGotowe} limit={Math.max(1, wiersz.produktyPlan)} kolor='niebieski' />
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 align-top'>
                          <div className='text-tekst-glowny'>
                            {wiersz.zleceniaGotowe} / {wiersz.zleceniaWszystkie}
                          </div>
                          <PasekPostepu wartosc={wiersz.zleceniaGotowe} limit={Math.max(1, wiersz.zleceniaWszystkie)} kolor='niebieski' />
                        </td>
                        <td className='border-b border-r border-obramowanie px-4 py-4 text-right align-top text-tekst-glowny'>
                          {formatujLiczbe(wiersz.sumaNetto)}
                        </td>
                        <td className='border-b border-obramowanie px-4 py-4 align-top text-tekst-drugorzedny'>
                          {wiersz.uwagi}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className='max-w-[920px] rounded-[28px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10 xl:w-1/2'>
            <div className='mb-5'>
              <h2 className='text-2xl font-semibold text-tekst-glowny'>Podsumowanie calosci</h2>
            </div>

            <div className='overflow-hidden rounded-3xl border border-obramowanie'>
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
                  <WierszKosztu
                    etykieta='Suma z maszyn/operacji:'
                    planowanyCzas={podsumowanie.czasPlanowany}
                    planowanyKoszt={podsumowanie.kosztOperacjiPlan}
                    zrealizowanyCzas={podsumowanie.czasZrealizowany}
                    zrealizowanyKoszt={podsumowanie.kosztOperacjiReal}
                  />
                  <WierszKosztu
                    etykieta='- W tym maszyny/operacje:'
                    planowanyCzas={0}
                    planowanyKoszt={podsumowanie.kosztMaszynPlan}
                    zrealizowanyCzas={0}
                    zrealizowanyKoszt={podsumowanie.kosztMaszynReal}
                  />
                  <WierszKosztu
                    etykieta='- W tym pracownicy:'
                    planowanyCzas={0}
                    planowanyKoszt={podsumowanie.kosztPracownikowPlan}
                    zrealizowanyCzas={0}
                    zrealizowanyKoszt={podsumowanie.kosztPracownikowReal}
                  />
                  <WierszKosztu
                    etykieta='Suma z ustawiania maszyn:'
                    planowanyCzas={0}
                    planowanyKoszt={podsumowanie.kosztUstawianiaPlan}
                    zrealizowanyCzas={0}
                    zrealizowanyKoszt={podsumowanie.kosztUstawianiaReal}
                  />
                  <WierszKosztu
                    etykieta='- W tym maszyny/operacje:'
                    planowanyCzas={0}
                    planowanyKoszt={0}
                    zrealizowanyCzas={0}
                    zrealizowanyKoszt={0}
                  />
                  <WierszKosztu
                    etykieta='- W tym pracownicy:'
                    planowanyCzas={0}
                    planowanyKoszt={0}
                    zrealizowanyCzas={0}
                    zrealizowanyKoszt={0}
                  />
                  <WierszKosztu
                    etykieta='Suma z maszyn/operacji + suma z ustawiania maszyn:'
                    planowanyCzas={podsumowanie.czasPlanowany}
                    planowanyKoszt={podsumowanie.kosztOperacjiPlan + podsumowanie.kosztUstawianiaPlan}
                    zrealizowanyCzas={podsumowanie.czasZrealizowany}
                    zrealizowanyKoszt={podsumowanie.kosztOperacjiReal + podsumowanie.kosztUstawianiaReal}
                  />
                  <WierszKosztu
                    etykieta='- W tym maszyny/operacje:'
                    planowanyCzas={0}
                    planowanyKoszt={podsumowanie.kosztMaszynPlan}
                    zrealizowanyCzas={0}
                    zrealizowanyKoszt={podsumowanie.kosztMaszynReal}
                  />
                  <WierszKosztu
                    etykieta='- W tym pracownicy:'
                    planowanyCzas={0}
                    planowanyKoszt={podsumowanie.kosztPracownikowPlan}
                    zrealizowanyCzas={0}
                    zrealizowanyKoszt={podsumowanie.kosztPracownikowReal}
                  />
                  <WierszKosztu
                    etykieta='Dla gotowego produktu:'
                    planowanyCzas={podsumowanie.produktyPlan > 0 ? podsumowanie.czasPlanowany / podsumowanie.produktyPlan : 0}
                    planowanyKoszt={podsumowanie.kosztOperacjiPlan + podsumowanie.kosztUstawianiaPlan > 0 ? (podsumowanie.kosztOperacjiPlan + podsumowanie.kosztUstawianiaPlan) / Math.max(1, podsumowanie.produktyPlan) : 0}
                    zrealizowanyCzas={podsumowanie.produktyGotowe > 0 ? podsumowanie.czasZrealizowany / podsumowanie.produktyGotowe : 0}
                    zrealizowanyKoszt={podsumowanie.produktyGotowe > 0 ? (podsumowanie.kosztOperacjiReal + podsumowanie.kosztUstawianiaReal) / podsumowanie.produktyGotowe : 0}
                  />
                  <WierszKosztu
                    etykieta='Surowce:'
                    planowanyCzas={0}
                    planowanyKoszt={podsumowanie.kosztSurowcowPlan}
                    zrealizowanyCzas={0}
                    zrealizowanyKoszt={podsumowanie.kosztSurowcowReal}
                  />
                  <WierszKosztu
                    etykieta='Calkowity koszt zamowienia:'
                    planowanyCzas={0}
                    planowanyKoszt={podsumowanie.kosztCalkowityPlan}
                    zrealizowanyCzas={0}
                    zrealizowanyKoszt={podsumowanie.kosztCalkowityReal}
                    wyrozniony
                  />
                  <WierszKosztu
                    etykieta='Calkowity koszt gotowego produktu:'
                    planowanyCzas={0}
                    planowanyKoszt={podsumowanie.kosztNaProduktPlan}
                    zrealizowanyCzas={0}
                    zrealizowanyKoszt={podsumowanie.kosztNaProduktReal}
                    wyrozniony
                  />
                  <WierszKosztu etykieta='Dodatkowe koszty:' planowanyCzas={0} planowanyKoszt={0} zrealizowanyCzas={0} zrealizowanyKoszt={0} />
                  <WierszKosztu
                    etykieta='Calkowity koszt zamowienia + Dodatkowe koszty:'
                    planowanyCzas={0}
                    planowanyKoszt={0}
                    zrealizowanyCzas={0}
                    zrealizowanyKoszt={0}
                    wyrozniony
                  />
                  <WierszKosztu
                    etykieta='Calkowity koszt gotowego produktu + Dodatkowe koszty:'
                    planowanyCzas={0}
                    planowanyKoszt={0}
                    zrealizowanyCzas={0}
                    zrealizowanyKoszt={0}
                    wyrozniony
                  />
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
