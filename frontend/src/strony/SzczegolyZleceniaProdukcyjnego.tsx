import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  Check,
  ExternalLink,
  Package,
  Pencil,
  Plus,
  Printer,
  User,
  X,
} from 'lucide-react';
import klientApi from '../api/klient';
import type { OdpowiedzApi, StatusZlecenia } from '../typy/indeks';

type ZakladkaZlecenia = 'Edytuj' | 'Historia pracy' | 'Zuzycie surowcow' | 'Pauzy' | 'Cale zamowienie';

type PracownikOpcja = {
  id: number;
  imie: string;
  nazwisko: string;
  stanowisko?: string | null;
  aktywny?: boolean;
};

type HistoriaWydajnosci = {
  id: number;
  pracownikId: number | null;
  iloscWykonana: number;
  iloscBrakow: number;
  opisBrakow: string | null;
  czasStart: string;
  czasStop: string | null;
  kosztMaszynyPln: number | string;
  kosztPracownikaPln: number | string;
  dodanoRecznie: boolean;
};

type ZuzycieSurowca = {
  nazwa: string;
  jednostka: string;
  planowanaIlosc: number;
  realnaIlosc: number;
  odchylenieIlosci: number;
  planowanyKoszt: number;
  zrealizowanyKoszt: number;
};

type SzczegolyZleceniaProdukcyjnego = {
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
  maszyna: {
    id: number;
    nazwa: string;
  };
  zamowienie: {
    id: number;
    idProdio: string;
    zewnetrznyNumer: string | null;
    oczekiwanaData: string | null;
    klient: { id: number; nazwa: string } | null;
    pozycje: Array<{
      id: number;
      ilosc: number;
      produkt: {
        id: number;
        nazwa: string;
        zdjecie: string | null;
        grupa: { id: number; nazwa: string } | null;
      };
    }>;
  };
  poprzednik: {
    id: number;
    numer: string;
    status: StatusZlecenia;
    iloscPlan: number;
    iloscWykonana: number;
  } | null;
  historiaWydajnosci: HistoriaWydajnosci[];
  koszty: {
    kpi: {
      produkty: { plan: number; wykonane: number; procent: number };
      brakowosc: { iloscBrakow: number; procent: number };
      czas: { planowanyGodziny: number; zrealizowanyGodziny: number; procent: number };
    };
    tabelaKosztow: Array<{
      klucz: string;
      etykieta: string;
      poziom: number;
      suma?: boolean;
      planowanyCzas: number;
      planowanyKoszt: number;
      zrealizowanyCzas: number;
      zrealizowanyKoszt: number;
    }>;
    zuzycieSurowcow: ZuzycieSurowca[];
  };
};

const STATUS_META: Record<StatusZlecenia, { etykieta: string; klasy: string }> = {
  STOP: { etykieta: 'STOP', klasy: 'border-slate-500/50 bg-slate-700/80 text-white' },
  W_TOKU: { etykieta: 'W TOKU', klasy: 'border-akcent/40 bg-akcent/15 text-akcent' },
  PAUZA: { etykieta: 'PAUZA', klasy: 'border-amber-500/30 bg-amber-500/15 text-amber-300' },
  GOTOWE: { etykieta: 'GOTOWE', klasy: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300' },
  ANULOWANE: { etykieta: 'ANULOWANE', klasy: 'border-red-500/30 bg-red-500/15 text-red-300' },
};

const ZAKLADKI: ZakladkaZlecenia[] = ['Edytuj', 'Historia pracy', 'Zuzycie surowcow', 'Pauzy', 'Cale zamowienie'];

function formatujLiczbe(wartosc: number | string, miejsca = 0) {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: miejsca,
    maximumFractionDigits: miejsca,
  }).format(Number(wartosc) || 0);
}

function formatujDate(wartosc: string | null, zGodzina = true) {
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

function formatujWalute(wartosc: number) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
  }).format(wartosc || 0);
}

function procentBezpieczny(wartosc: number) {
  return Math.max(0, Math.min(100, wartosc || 0));
}

function pobierzNazwePracownika(pracownik: PracownikOpcja) {
  return `${pracownik.imie} ${pracownik.nazwisko}`.trim();
}

function obliczSekundy(start: string, stop: string | null) {
  if (!stop) return 0;
  const czasStart = new Date(start).getTime();
  const czasStop = new Date(stop).getTime();
  if (Number.isNaN(czasStart) || Number.isNaN(czasStop) || czasStop <= czasStart) {
    return 0;
  }
  return Math.round((czasStop - czasStart) / 1000);
}

function formatujCzas(sekundy: number) {
  if (!Number.isFinite(sekundy) || sekundy <= 0) {
    return '00:00:00';
  }

  const godziny = Math.floor(sekundy / 3600);
  const minuty = Math.floor((sekundy % 3600) / 60);
  const pozostaleSekundy = sekundy % 60;

  return [godziny, minuty, pozostaleSekundy]
    .map((wartosc) => String(wartosc).padStart(2, '0'))
    .join(':');
}

function formatujCzasZGodzin(godziny: number) {
  return formatujCzas(Math.round((godziny || 0) * 3600));
}

function KartaPostepu({
  etykieta,
  wartosc,
  mianownik,
  procent,
  kolor = 'bg-akcent',
}: {
  etykieta: string;
  wartosc: string;
  mianownik: string;
  procent: number;
  kolor?: string;
}) {
  return (
    <div className='rounded-[26px] border border-obramowanie bg-tlo-karta/70 p-5 shadow-lg shadow-black/10'>
      <p className='text-sm text-tekst-drugorzedny'>{etykieta}</p>
      <p className='mt-4 text-right text-2xl font-semibold text-tekst-glowny'>
        {wartosc} <span className='text-lg text-tekst-drugorzedny'>/ {mianownik}</span>
      </p>
      <div className='mt-4 h-2 overflow-hidden rounded-full bg-tlo-glowne'>
        <div className={`h-full rounded-full ${kolor}`} style={{ width: `${procentBezpieczny(procent)}%` }} />
      </div>
    </div>
  );
}

function ZakladkaPrzycisk({
  aktywna,
  etykieta,
  onClick,
}: {
  aktywna: boolean;
  etykieta: string;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`border-b-4 px-1 pb-3 pt-1 text-base font-semibold transition ${
        aktywna
          ? 'border-emerald-500 text-tekst-glowny'
          : 'border-transparent text-tekst-drugorzedny hover:text-tekst-glowny'
      }`}
    >
      {etykieta}
    </button>
  );
}

function PoleOdczytu({
  etykieta,
  wartosc,
  pogrubione = false,
}: {
  etykieta: string;
  wartosc: React.ReactNode;
  pogrubione?: boolean;
}) {
  return (
    <div className='rounded-2xl border border-obramowanie bg-tlo-karta/40 px-4 py-3'>
      <p className='text-sm text-tekst-drugorzedny'>{etykieta}</p>
      <div className={`mt-2 text-base text-tekst-glowny ${pogrubione ? 'font-semibold' : ''}`}>{wartosc}</div>
    </div>
  );
}

function NaglowekTabeli({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`border-b border-r border-obramowanie px-4 py-4 text-left font-semibold ${className}`}>{children}</th>;
}

function KomorkaTabeli({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-r border-obramowanie px-4 py-4 align-top ${className}`}>{children}</td>;
}

export default function SzczegolyZleceniaProdukcyjnego() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [dane, ustawDane] = useState<SzczegolyZleceniaProdukcyjnego | null>(null);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [blad, ustawBlad] = useState('');
  const [pracownicy, ustawPracownikow] = useState<PracownikOpcja[]>([]);
  const [ladowaniePracownikow, ustawLadowaniePracownikow] = useState(false);
  const [zapisywaniePracownikow, ustawZapisywaniePracownikow] = useState(false);
  const [bladPracownikow, ustawBladPracownikow] = useState('');
  const [czyPickerOtwarty, ustawCzyPickerOtwarty] = useState(false);
  const [szukajPracownika, ustawSzukajPracownika] = useState('');
  const [wybranePracownicyIds, ustawWybranePracownicyIds] = useState<number[]>([]);
  const [czyEdycjaTagow, ustawCzyEdycjaTagow] = useState(false);
  const [tagiRobocze, ustawTagiRobocze] = useState('');
  const [uwagiRobocze, ustawUwagiRobocze] = useState('');
  const [zapisywanieTagow, ustawZapisywanieTagow] = useState(false);
  const [bladTagow, ustawBladTagow] = useState('');
  const [aktywnaZakladka, ustawAktywnaZakladka] = useState<ZakladkaZlecenia>('Edytuj');
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const pobierz = async () => {
    ustawLadowanie(true);
    ustawBlad('');

    try {
      const odpowiedz = await klientApi.get<OdpowiedzApi<SzczegolyZleceniaProdukcyjnego>>(`/zlecenia-produkcyjne/${id}`);
      ustawDane(odpowiedz.data.dane);
      ustawWybranePracownicyIds(odpowiedz.data.dane.przypisaniPracownicyIds ?? []);
      ustawTagiRobocze((odpowiedz.data.dane.tagi ?? []).join(', '));
      ustawUwagiRobocze(odpowiedz.data.dane.uwagi ?? '');
    } catch {
      ustawBlad('Nie udalo sie pobrac szczegolow zlecenia produkcyjnego.');
      ustawDane(null);
    } finally {
      ustawLadowanie(false);
    }
  };

  useEffect(() => {
    void pobierz();
  }, [id]);

  useEffect(() => {
    const pobierzPracownikow = async () => {
      ustawLadowaniePracownikow(true);

      try {
        const odpowiedz = await klientApi.get<{ dane: PracownikOpcja[]; lacznie: number }>('/pracownicy', {
          params: { strona: 1, iloscNaStrone: 200, sortPole: 'imie', sortKierunek: 'asc' },
        });
        ustawPracownikow(odpowiedz.data.dane ?? []);
      } catch {
        ustawPracownikow([]);
      } finally {
        ustawLadowaniePracownikow(false);
      }
    };

    void pobierzPracownikow();
  }, []);

  useEffect(() => {
    const obsluzKlikPoza = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        ustawCzyPickerOtwarty(false);
      }
    };

    document.addEventListener('mousedown', obsluzKlikPoza);
    return () => document.removeEventListener('mousedown', obsluzKlikPoza);
  }, []);

  const produkt = dane?.zamowienie.pozycje[0]?.produkt ?? null;
  const metaStatusu = dane ? STATUS_META[dane.status] : null;

  const metryki = useMemo(() => {
    if (!dane) return null;

    const produktyDobre = Math.max(0, dane.iloscWykonana - dane.iloscBrakow);
    return {
      produktyDobre,
      postep: procentBezpieczny(dane.koszty.kpi.produkty.procent),
      brakowosc: procentBezpieczny(dane.koszty.kpi.brakowosc.procent),
      czas: procentBezpieczny(dane.koszty.kpi.czas.procent),
    };
  }, [dane]);

  const wybraniPracownicy = useMemo(() => {
    const mapa = new Map(pracownicy.map((pracownik) => [pracownik.id, pracownik]));
    return wybranePracownicyIds
      .map((pracownikId) => mapa.get(pracownikId) ?? dane?.przypisaniPracownicy.find((pracownik) => pracownik.id === pracownikId))
      .filter((pracownik): pracownik is PracownikOpcja => Boolean(pracownik));
  }, [dane?.przypisaniPracownicy, pracownicy, wybranePracownicyIds]);

  const dostepniPracownicy = useMemo(() => {
    const fraza = szukajPracownika.trim().toLowerCase();

    return pracownicy.filter((pracownik) => {
      if (wybranePracownicyIds.includes(pracownik.id)) {
        return false;
      }

      if (!fraza) {
        return true;
      }

      return [pobierzNazwePracownika(pracownik), pracownik.stanowisko ?? ''].join(' ').toLowerCase().includes(fraza);
    });
  }, [pracownicy, szukajPracownika, wybranePracownicyIds]);

  const mapaPracownikow = useMemo(() => {
    const wpisy = [...pracownicy, ...(dane?.przypisaniPracownicy ?? [])].map((pracownik) => [pracownik.id, pracownik] as const);
    return new Map(wpisy);
  }, [dane?.przypisaniPracownicy, pracownicy]);

  const historiaPracy = useMemo(() => {
    if (!dane) return [];

    return dane.historiaWydajnosci.map((wpis) => {
      const pracownik = wpis.pracownikId ? mapaPracownikow.get(wpis.pracownikId) : null;
      const sekundy = obliczSekundy(wpis.czasStart, wpis.czasStop);
      const godziny = sekundy / 3600;
      const wydajnoscNaGodzine = godziny > 0 ? wpis.iloscWykonana / godziny : 0;
      const norma = Number(dane.normaSztGodz) || 0;
      const wydajnoscProcent = norma > 0 ? (wydajnoscNaGodzine / norma) * 100 : 0;

      return {
        ...wpis,
        pracownikNazwa: pracownik ? pobierzNazwePracownika(pracownik) : wpis.pracownikId ? `ID ${wpis.pracownikId}` : '-',
        sekundy,
        wydajnoscNaGodzine,
        wydajnoscProcent,
      };
    });
  }, [dane, mapaPracownikow]);

  const sumaPauzSekundy = 0;

  const zapiszPracownikow = async () => {
    if (!dane) return;

    ustawZapisywaniePracownikow(true);
    ustawBladPracownikow('');

    try {
      await klientApi.put(`/zlecenia-produkcyjne/${dane.id}`, {
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
        przypisaniPracownicyIds: wybranePracownicyIds,
        aktywne: dane.aktywne,
        maszynaKoncowa: dane.maszynaKoncowa,
        uwagi: dane.uwagi ?? '',
      });

      ustawCzyPickerOtwarty(false);
      ustawSzukajPracownika('');
      await pobierz();
    } catch {
      ustawBladPracownikow('Nie udalo sie zapisac przypisanych pracownikow.');
    } finally {
      ustawZapisywaniePracownikow(false);
    }
  };

  const zapiszTagiIUwagi = async () => {
    if (!dane) return;

    ustawZapisywanieTagow(true);
    ustawBladTagow('');

    try {
      await klientApi.put(`/zlecenia-produkcyjne/${dane.id}`, {
        maszynaId: String(dane.maszynaId),
        iloscPlan: String(dane.iloscPlan),
        iloscWykonana: String(dane.iloscWykonana),
        iloscBrakow: String(dane.iloscBrakow),
        poprzednikId: dane.poprzednikId ? String(dane.poprzednikId) : null,
        planowanyStart: dane.planowanyStart,
        planowanyStop: dane.planowanyStop,
        normaSztGodz: String(dane.normaSztGodz ?? 0),
        status: dane.status,
        tagi: tagiRobocze
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        przypisaniPracownicyIds: wybranePracownicyIds,
        aktywne: dane.aktywne,
        maszynaKoncowa: dane.maszynaKoncowa,
        uwagi: uwagiRobocze,
      });

      ustawCzyEdycjaTagow(false);
      await pobierz();
    } catch {
      ustawBladTagow('Nie udalo sie zapisac tagow i uwag.');
    } finally {
      ustawZapisywanieTagow(false);
    }
  };

  if (ladowanie) {
    return (
      <div className='space-y-6'>
        <div className='h-36 animate-pulse rounded-[28px] border border-obramowanie bg-tlo-karta' />
        <div className='grid gap-4 lg:grid-cols-3'>
          <div className='h-32 animate-pulse rounded-[24px] border border-obramowanie bg-tlo-karta' />
          <div className='h-32 animate-pulse rounded-[24px] border border-obramowanie bg-tlo-karta' />
          <div className='h-32 animate-pulse rounded-[24px] border border-obramowanie bg-tlo-karta' />
        </div>
        <div className='h-[420px] animate-pulse rounded-[28px] border border-obramowanie bg-tlo-karta' />
      </div>
    );
  }

  if (blad || !dane || !metryki) {
    return (
      <div className='rounded-[28px] border border-red-500/30 bg-red-500/10 px-6 py-8 text-red-200'>
        <p className='text-lg font-semibold'>Nie udalo sie otworzyc zlecenia</p>
        <p className='mt-2 text-sm text-red-100/80'>{blad || 'Brak danych dla wybranego zlecenia.'}</p>
        <button
          type='button'
          onClick={() => navigate('/zlecenia-produkcyjne')}
          className='mt-5 inline-flex items-center gap-2 rounded-full border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/10'
        >
          <ArrowLeft className='h-4 w-4' />
          Wroc do listy
        </button>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <section className='rounded-[30px] border border-obramowanie bg-tlo-karta/70 px-6 py-6 shadow-xl shadow-black/10'>
        <div className='flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between'>
          <div className='space-y-4'>
            <button
              type='button'
              onClick={() => navigate('/zlecenia-produkcyjne')}
              className='inline-flex items-center gap-2 text-sm font-medium text-tekst-drugorzedny transition hover:text-akcent'
            >
              <ArrowLeft className='h-4 w-4' />
              Powrot do listy zlecen
            </button>

            <div className='flex flex-wrap items-center gap-3'>
              <h1 className='text-3xl font-semibold tracking-tight text-tekst-glowny'>Zlecenie produkcyjne</h1>
              <span className='text-3xl font-semibold tracking-tight text-tekst-glowny'>{dane.numer}</span>
            </div>

            <div className='flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-tekst-drugorzedny'>
              <span className='inline-flex items-center gap-2'>
                <Package className='h-4 w-4 text-akcent' />
                {dane.maszyna.nazwa}
              </span>
              <span className='inline-flex items-center gap-2'>
                <Boxes className='h-4 w-4 text-akcent' />
                {produkt?.nazwa || 'Brak produktu'}
              </span>
              <span className='inline-flex items-center gap-2'>
                <User className='h-4 w-4 text-akcent' />
                {dane.zamowienie.klient?.nazwa || 'Produkcja na magazyn'}
              </span>
              <span className={`inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold tracking-[0.18em] ${metaStatusu?.klasy}`}>
                {metaStatusu?.etykieta}
              </span>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-2 text-sm font-semibold'>
            <button
              type='button'
              onClick={() => setTimeout(() => ustawAktywnaZakladka('Edytuj'), 0)}
              className='inline-flex h-11 items-center gap-2 rounded-full border border-obramowanie px-4 text-tekst-glowny transition hover:border-akcent hover:text-akcent'
            >
              <Pencil className='h-4 w-4' />
              Edytuj
            </button>
            <button
              type='button'
              onClick={() => window.print()}
              className='inline-flex h-11 items-center gap-2 rounded-full border border-obramowanie px-4 text-tekst-glowny transition hover:border-akcent hover:text-akcent'
            >
              <Printer className='h-4 w-4' />
              Drukuj
            </button>
            <button
              type='button'
              onClick={() => navigate(`/zamowienia/${dane.zamowienieId}`)}
              className='inline-flex h-11 items-center gap-2 rounded-full border border-obramowanie px-4 text-tekst-glowny transition hover:border-akcent hover:text-akcent'
            >
              <ExternalLink className='h-4 w-4' />
              Zamowienie
            </button>
          </div>
        </div>

        <div className='mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-obramowanie pt-5'>
          {ZAKLADKI.map((zakladka) => (
            <ZakladkaPrzycisk
              key={zakladka}
              etykieta={zakladka === 'Cale zamowienie' ? 'Całe zamówienie' : zakladka === 'Zuzycie surowcow' ? 'Zużycie surowców' : zakladka}
              aktywna={aktywnaZakladka === zakladka}
              onClick={() => {
                if (zakladka === 'Cale zamowienie') {
                  navigate(`/zamowienia/${dane.zamowienieId}`);
                  return;
                }

                ustawAktywnaZakladka(zakladka);
              }}
            />
          ))}
        </div>
      </section>

      <div className='grid gap-4 lg:grid-cols-3'>
        <KartaPostepu
          etykieta='Produkty (got./wsz.)'
          wartosc={formatujLiczbe(metryki.produktyDobre, 2)}
          mianownik={formatujLiczbe(dane.iloscPlan, 2)}
          procent={metryki.postep}
          kolor='bg-blue-500'
        />
        <KartaPostepu
          etykieta='Brakowość (braki/produkty)'
          wartosc={formatujLiczbe(dane.iloscBrakow, 2)}
          mianownik={formatujLiczbe(dane.iloscWykonana || dane.iloscPlan, 2)}
          procent={metryki.brakowosc}
          kolor='bg-slate-500'
        />
        <KartaPostepu
          etykieta='Czas (pracy/norm.)'
          wartosc={formatujCzasZGodzin(dane.koszty.kpi.czas.zrealizowanyGodziny)}
          mianownik={formatujCzasZGodzin(dane.koszty.kpi.czas.planowanyGodziny)}
          procent={metryki.czas}
          kolor='bg-emerald-500'
        />
      </div>

      {aktywnaZakladka === 'Edytuj' ? (
        <section className='space-y-6 rounded-[30px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
          <div className='grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]'>
            <div className='grid gap-4 md:grid-cols-2'>
              <PoleOdczytu etykieta='Maszyna/Operacja' wartosc={dane.maszyna.nazwa} pogrubione />
              <PoleOdczytu etykieta='Ilość' wartosc={formatujLiczbe(dane.iloscPlan, 0)} pogrubione />
              <div className='md:col-span-2'>
                <PoleOdczytu
                  etykieta='Poprzednik operacji'
                  wartosc={
                    dane.poprzednik ? (
                      <div className='flex items-center justify-between gap-3'>
                        <span>{dane.poprzednik.numer}</span>
                        <span className='text-sm text-tekst-drugorzedny'>
                          {formatujLiczbe(dane.poprzednik.iloscWykonana, 0)} / {formatujLiczbe(dane.poprzednik.iloscPlan, 0)}
                        </span>
                      </div>
                    ) : (
                      'Brak poprzedniej operacji'
                    )
                  }
                />
              </div>
              <PoleOdczytu etykieta='Planowany start' wartosc={formatujDate(dane.planowanyStart)} />
              <PoleOdczytu etykieta='Planowany stop' wartosc={formatujDate(dane.planowanyStop)} pogrubione />
            </div>

            <div className='space-y-4'>
              <PoleOdczytu
                etykieta='Tagi'
                wartosc={
                  dane.tagi.length > 0 ? (
                    <div className='flex flex-wrap gap-2'>
                      {dane.tagi.map((tag) => (
                        <span key={tag} className='rounded-full border border-akcent/30 bg-akcent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-akcent'>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    'Brak tagow'
                  )
                }
              />

              <div ref={pickerRef} className='rounded-2xl border border-obramowanie bg-tlo-karta/40 px-4 py-3'>
                <div className='flex items-center justify-between gap-3'>
                  <p className='text-sm text-tekst-drugorzedny'>Przypisz pracownika</p>
                  <button
                    type='button'
                    onClick={() => ustawCzyPickerOtwarty((poprzednie) => !poprzednie)}
                    className='inline-flex items-center gap-2 rounded-full border border-obramowanie px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-tekst-glowny transition hover:border-akcent hover:text-akcent'
                  >
                    <Plus className='h-3.5 w-3.5' />
                    Wybierz
                  </button>
                </div>

                <div className='mt-3 flex flex-wrap gap-2'>
                  {wybraniPracownicy.length > 0 ? (
                    wybraniPracownicy.map((pracownik) => (
                      <span key={pracownik.id} className='inline-flex items-center gap-2 rounded-full border border-obramowanie bg-tlo-glowne px-3 py-1.5 text-sm text-tekst-glowny'>
                        <span>{pobierzNazwePracownika(pracownik)}</span>
                        <button
                          type='button'
                          onClick={() => ustawWybranePracownicyIds((poprzednie) => poprzednie.filter((idPracownika) => idPracownika !== pracownik.id))}
                          className='text-tekst-drugorzedny transition hover:text-red-300'
                          aria-label={`Usun pracownika ${pobierzNazwePracownika(pracownik)}`}
                        >
                          <X className='h-3.5 w-3.5' />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className='text-sm text-tekst-drugorzedny'>Brak przypisanych pracownikow.</span>
                  )}
                </div>

                {czyPickerOtwarty ? (
                  <div className='mt-4 space-y-4 rounded-2xl border border-obramowanie bg-tlo-glowne/40 p-4'>
                    <input
                      value={szukajPracownika}
                      onChange={(event) => ustawSzukajPracownika(event.target.value)}
                      placeholder='Szukaj pracownika lub stanowiska'
                      className='w-full rounded-xl border border-obramowanie bg-tlo-karta px-4 py-3 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                    />

                    <div className='max-h-72 overflow-y-auto rounded-2xl border border-obramowanie'>
                      {ladowaniePracownikow ? (
                        <div className='px-4 py-5 text-sm text-tekst-drugorzedny'>Ladowanie pracownikow...</div>
                      ) : dostepniPracownicy.length === 0 ? (
                        <div className='px-4 py-5 text-sm text-tekst-drugorzedny'>Brak pasujacych pracownikow.</div>
                      ) : (
                        dostepniPracownicy.map((pracownik) => (
                          <button
                            key={pracownik.id}
                            type='button'
                            onClick={() =>
                              ustawWybranePracownicyIds((poprzednie) =>
                                poprzednie.includes(pracownik.id) ? poprzednie : [...poprzednie, pracownik.id]
                              )
                            }
                            className='flex w-full items-center justify-between gap-3 border-b border-obramowanie px-4 py-3 text-left transition last:border-b-0 hover:bg-akcent/5'
                          >
                            <div>
                              <p className='font-semibold text-tekst-glowny'>{pobierzNazwePracownika(pracownik)}</p>
                              <p className='text-sm text-tekst-drugorzedny'>{pracownik.stanowisko || '-'}</p>
                            </div>
                            <span className='rounded-full border border-obramowanie px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-tekst-glowny'>
                              Dodaj
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}

                <div className='mt-4'>
                  <button
                    type='button'
                    onClick={() => void zapiszPracownikow()}
                    disabled={zapisywaniePracownikow}
                    className='inline-flex h-11 items-center rounded-full bg-akcent px-4 text-sm font-semibold text-white transition hover:bg-akcent-hover disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    {zapisywaniePracownikow ? 'Zapisywanie...' : 'Zapisz pracownikow'}
                  </button>
                </div>

                {bladPracownikow ? <p className='mt-3 text-sm text-red-300'>{bladPracownikow}</p> : null}
              </div>
            </div>
          </div>

          <div className='grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)] xl:items-start'>
            <div className='rounded-2xl border border-obramowanie bg-tlo-karta/40 px-4 py-5'>
              <p className='text-base font-medium text-tekst-glowny'>Maszyna koncowa</p>
              <div className='mt-4'>
                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${dane.maszynaKoncowa ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-600/30 text-tekst-drugorzedny'}`}>
                  {dane.maszynaKoncowa ? 'Tak' : 'Nie'}
                </span>
              </div>
            </div>

            <div className='rounded-2xl border border-obramowanie bg-tlo-karta/40 px-4 py-4'>
              <div className='flex items-center justify-between gap-3'>
                <p className='text-sm text-tekst-drugorzedny'>Parametry operacji / tagi</p>
                <button
                  type='button'
                  onClick={() => {
                    ustawCzyEdycjaTagow((poprzednie) => !poprzednie);
                    ustawBladTagow('');
                    ustawTagiRobocze((dane.tagi ?? []).join(', '));
                    ustawUwagiRobocze(dane.uwagi ?? '');
                  }}
                  className='inline-flex items-center gap-2 text-sm font-semibold text-akcent transition hover:text-akcent-hover'
                >
                  <Pencil className='h-4 w-4' />
                  {czyEdycjaTagow ? 'Zamknij' : 'Edytuj'}
                </button>
              </div>

              {czyEdycjaTagow ? (
                <div className='mt-4 space-y-4'>
                  <input
                    value={tagiRobocze}
                    onChange={(event) => ustawTagiRobocze(event.target.value)}
                    placeholder='Np. pilne, nocna zmiana, kontrola'
                    className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                  <textarea
                    value={uwagiRobocze}
                    onChange={(event) => ustawUwagiRobocze(event.target.value)}
                    rows={6}
                    placeholder='Dodaj uwagi do zlecenia'
                    className='w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny outline-none transition focus:border-akcent'
                  />
                  <div className='flex flex-wrap gap-3'>
                    <button
                      type='button'
                      onClick={() => void zapiszTagiIUwagi()}
                      disabled={zapisywanieTagow}
                      className='inline-flex h-11 items-center rounded-full bg-akcent px-4 text-sm font-semibold text-white transition hover:bg-akcent-hover disabled:cursor-not-allowed disabled:opacity-60'
                    >
                      {zapisywanieTagow ? 'Zapisywanie...' : 'Zapisz'}
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        ustawCzyEdycjaTagow(false);
                        ustawBladTagow('');
                        ustawTagiRobocze((dane.tagi ?? []).join(', '));
                        ustawUwagiRobocze(dane.uwagi ?? '');
                      }}
                      className='inline-flex h-11 items-center rounded-full border border-obramowanie px-4 text-sm font-semibold text-tekst-glowny transition hover:border-akcent hover:text-akcent'
                    >
                      Anuluj
                    </button>
                  </div>
                  {bladTagow ? <p className='text-sm text-red-300'>{bladTagow}</p> : null}
                </div>
              ) : (
                <div className='mt-4 min-h-[144px] text-sm leading-6 text-tekst-drugorzedny'>
                  {dane.tagi.length > 0 ? dane.tagi.join(', ') : 'Brak dodatkowych parametrow.'}
                </div>
              )}
            </div>

            <div className='rounded-2xl border border-obramowanie bg-tlo-karta/40 px-4 py-4'>
              <p className='text-sm text-tekst-drugorzedny'>Uwagi</p>
              <div className='mt-4 min-h-[144px] text-sm leading-6 text-tekst-drugorzedny'>
                {czyEdycjaTagow ? uwagiRobocze || 'Brak uwag.' : dane.uwagi || 'Brak uwag technologicznych dla tej operacji.'}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {aktywnaZakladka === 'Historia pracy' ? (
        <section className='space-y-5 rounded-[30px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
          <h2 className='text-2xl font-semibold text-tekst-glowny'>Historia pracy</h2>
          <div className='overflow-hidden rounded-[24px] border border-obramowanie'>
            <div className='overflow-x-auto'>
              <table className='min-w-[1260px] w-full text-sm'>
                <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                  <tr>
                    <NaglowekTabeli>Pracownik</NaglowekTabeli>
                    <NaglowekTabeli className='text-right'>Ilość</NaglowekTabeli>
                    <NaglowekTabeli>Czas</NaglowekTabeli>
                    <NaglowekTabeli>Start</NaglowekTabeli>
                    <NaglowekTabeli>Stop</NaglowekTabeli>
                    <NaglowekTabeli>Pauza</NaglowekTabeli>
                    <NaglowekTabeli>Wydajność</NaglowekTabeli>
                    <NaglowekTabeli className='text-right'>Braki</NaglowekTabeli>
                    <NaglowekTabeli>Opis braków</NaglowekTabeli>
                    <NaglowekTabeli className='text-center'>Operacja końcowa</NaglowekTabeli>
                    <th className='border-b border-obramowanie px-4 py-4 text-left font-semibold'>Uwagi</th>
                  </tr>
                </thead>
                <tbody>
                  {historiaPracy.length === 0 ? (
                    <tr>
                      <td colSpan={11} className='px-6 py-12 text-center text-tekst-drugorzedny'>
                        Brak wpisow historii pracy dla tego zlecenia.
                      </td>
                    </tr>
                  ) : (
                    historiaPracy.map((wiersz) => (
                      <tr key={wiersz.id} className='odd:bg-tlo-glowne/25 even:bg-tlo-karta/20'>
                        <KomorkaTabeli className='text-akcent'>{wiersz.pracownikNazwa}</KomorkaTabeli>
                        <KomorkaTabeli className='text-right text-tekst-glowny'>{formatujLiczbe(wiersz.iloscWykonana, 0)}</KomorkaTabeli>
                        <KomorkaTabeli className='text-tekst-glowny'>{formatujCzas(wiersz.sekundy)}</KomorkaTabeli>
                        <KomorkaTabeli className='text-tekst-glowny'>{formatujDate(wiersz.czasStart)}</KomorkaTabeli>
                        <KomorkaTabeli className='text-tekst-glowny'>{formatujDate(wiersz.czasStop)}</KomorkaTabeli>
                        <KomorkaTabeli className='text-tekst-glowny'>00:00:00</KomorkaTabeli>
                        <KomorkaTabeli>
                          <span className={wiersz.wydajnoscProcent >= 100 ? 'text-emerald-300' : 'text-red-300'}>
                            {formatujLiczbe(wiersz.wydajnoscNaGodzine, 2)} szt./h
                            {Number(dane.normaSztGodz) > 0 ? `  ${formatujLiczbe(wiersz.wydajnoscProcent, 2)}%` : ''}
                          </span>
                        </KomorkaTabeli>
                        <KomorkaTabeli className='text-right text-tekst-glowny'>{formatujLiczbe(wiersz.iloscBrakow, 0)}</KomorkaTabeli>
                        <KomorkaTabeli className='text-tekst-drugorzedny'>{wiersz.opisBrakow || '-'}</KomorkaTabeli>
                        <KomorkaTabeli className='text-center'>
                          <span className={dane.maszynaKoncowa ? 'text-emerald-300' : 'text-red-300'}>
                            {dane.maszynaKoncowa ? <Check className='mx-auto h-4 w-4' /> : <X className='mx-auto h-4 w-4' />}
                          </span>
                        </KomorkaTabeli>
                        <td className='border-b border-obramowanie px-4 py-4 text-tekst-drugorzedny'>
                          {wiersz.dodanoRecznie ? 'Wpis reczny' : 'Panel / produkcja'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {aktywnaZakladka === 'Zuzycie surowcow' ? (
        <section className='space-y-5 rounded-[30px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
          <h2 className='text-2xl font-semibold text-tekst-glowny'>Zużycie surowców</h2>
          <div className='overflow-hidden rounded-[24px] border border-obramowanie'>
            <div className='overflow-x-auto'>
              <table className='min-w-[1120px] w-full text-sm'>
                <thead className='bg-tlo-naglowek text-tekst-drugorzedny'>
                  <tr>
                    <NaglowekTabeli>Surowiec</NaglowekTabeli>
                    <NaglowekTabeli>Jednostka</NaglowekTabeli>
                    <NaglowekTabeli className='text-right'>Ilość zużyta</NaglowekTabeli>
                    <NaglowekTabeli className='text-right'>Ilość według technologii</NaglowekTabeli>
                    <NaglowekTabeli className='text-right'>Odchylenie</NaglowekTabeli>
                    <NaglowekTabeli className='text-right'>Koszt realny</NaglowekTabeli>
                    <th className='border-b border-obramowanie px-4 py-4 text-right font-semibold'>Koszt planowany</th>
                  </tr>
                </thead>
                <tbody>
                  {dane.koszty.zuzycieSurowcow.length === 0 ? (
                    <tr>
                      <td colSpan={7} className='px-6 py-12 text-center text-tekst-drugorzedny'>
                        Brak danych surowcowych dla tej operacji.
                      </td>
                    </tr>
                  ) : (
                    dane.koszty.zuzycieSurowcow.map((surowiec) => (
                      <tr key={surowiec.nazwa} className='odd:bg-tlo-glowne/25 even:bg-tlo-karta/20'>
                        <KomorkaTabeli className='text-akcent'>{surowiec.nazwa}</KomorkaTabeli>
                        <KomorkaTabeli className='text-tekst-glowny'>{surowiec.jednostka}</KomorkaTabeli>
                        <KomorkaTabeli className='text-right text-tekst-glowny'>{formatujLiczbe(surowiec.realnaIlosc, 4)}</KomorkaTabeli>
                        <KomorkaTabeli className='text-right text-tekst-glowny'>{formatujLiczbe(surowiec.planowanaIlosc, 4)}</KomorkaTabeli>
                        <KomorkaTabeli className={`text-right ${surowiec.odchylenieIlosci > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                          {formatujLiczbe(surowiec.odchylenieIlosci, 4)}
                        </KomorkaTabeli>
                        <KomorkaTabeli className='text-right text-tekst-glowny'>{formatujWalute(surowiec.zrealizowanyKoszt)}</KomorkaTabeli>
                        <td className='border-b border-obramowanie px-4 py-4 text-right text-tekst-glowny'>
                          {formatujWalute(surowiec.planowanyKoszt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {aktywnaZakladka === 'Pauzy' ? (
        <section className='space-y-5 rounded-[30px] border border-obramowanie bg-tlo-karta/70 p-6 shadow-xl shadow-black/10'>
          <h2 className='text-2xl font-semibold text-tekst-glowny'>Pauzy {formatujCzas(sumaPauzSekundy)}</h2>
          <div className='flex min-h-[240px] items-center justify-center rounded-[24px] border border-dashed border-obramowanie bg-tlo-glowne/20 px-6 text-center text-lg text-tekst-drugorzedny'>
            Nie znaleziono danych
          </div>
        </section>
      ) : null}

    </div>
  );
}
