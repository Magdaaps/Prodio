import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import klientApi from '../../api/klient';
import Pole from '../../komponenty/ui/Pole';
import Przycisk from '../../komponenty/ui/Przycisk';
import Rozwijane from '../../komponenty/ui/Rozwijane';
import {
  type MagazynDto,
  type SurowiecDto,
  type ZlecenieDto,
  formatujLiczbe,
  KorektaFormularz,
  type OdpowiedzApi,
  PrzyjecieFormularz,
  PrzeniesFormularz,
  useMagazynSlowniki,
  WydanieFormularz,
} from './StanyMagazynowe';

type Zakladka = 'PRZYJECIA' | 'WYDANIA' | 'KOREKTY' | 'PRZENIESIENIA';

type Przyjecie = {
  id: number;
  numer: string | null;
  magazyn: MagazynDto;
  surowiec: SurowiecDto;
  ilosc: number;
  cena: number | null;
  uwagi: string | null;
  zatwierdzone: boolean;
  utworzonyW: string;
};

type Wydanie = {
  id: number;
  numer: string | null;
  magazyn: MagazynDto;
  surowiec: SurowiecDto;
  ilosc: number;
  zlecenieId: number | null;
  zlecenie: ZlecenieDto | null;
  uwagi: string | null;
  utworzonyW: string;
};

type Korekta = {
  id: number;
  numer: string | null;
  magazyn: MagazynDto;
  surowiec: SurowiecDto;
  ilosc: number;
  uwagi: string | null;
  utworzonyW: string;
};

type Przeniesienie = {
  id: number;
  numer: string | null;
  magazyn: MagazynDto;
  magazynDocelowy: MagazynDto | null;
  surowiec: SurowiecDto;
  ilosc: number;
  uwagi: string | null;
  utworzonyW: string;
};

type OdpowiedzListy<T> = OdpowiedzApi<T[]> & {
  total: number;
  page: number;
  limit: number;
};

const ZAKLADKI: Array<{ id: Zakladka; etykieta: string }> = [
  { id: 'PRZYJECIA', etykieta: 'Przyjecia' },
  { id: 'WYDANIA', etykieta: 'Wydania' },
  { id: 'KOREKTY', etykieta: 'Korekty' },
  { id: 'PRZENIESIENIA', etykieta: 'Przeniesienia' },
];

const KLASY_KARTY = 'rounded-[28px] border border-slate-700 bg-[#1E2A3A] shadow-xl shadow-black/20';

function formatujDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function pobierzZakladkeZUrl(pathname: string): Zakladka {
  if (pathname.endsWith('/wydania') || pathname.endsWith('/wydania-magazynowe')) return 'WYDANIA';
  if (pathname.endsWith('/korekty') || pathname.endsWith('/korekty-remanenty')) return 'KOREKTY';
  if (pathname.endsWith('/przeniesienia') || pathname.endsWith('/przeniesienia-magazynowe')) return 'PRZENIESIENIA';
  return 'PRZYJECIA';
}

export default function Transakcje() {
  const location = useLocation();
  const { magazyny, surowce, zlecenia, odswiez: odswiezSlowniki } = useMagazynSlowniki();
  const [zakladka, ustawZakladke] = useState<Zakladka>(location.pathname.includes('/magazyn/transakcje') ? 'PRZYJECIA' : pobierzZakladkeZUrl(location.pathname));
  const [magazynId, ustawMagazynId] = useState('');
  const [zlecenieId, ustawZlecenieId] = useState('');
  const [dataOd, ustawDateOd] = useState('');
  const [dataDo, ustawDateDo] = useState('');
  const [page, ustawPage] = useState(1);
  const [total, ustawTotal] = useState(0);
  const [ladowanie, ustawLadowanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [przyjecia, ustawPrzyjecia] = useState<Przyjecie[]>([]);
  const [wydania, ustawWydania] = useState<Wydanie[]>([]);
  const [korekty, ustawKorekty] = useState<Korekta[]>([]);
  const [przeniesienia, ustawPrzeniesienia] = useState<Przeniesienie[]>([]);
  const [modal, ustawModal] = useState<null | Zakladka>(null);

  useEffect(() => {
    if (!location.pathname.includes('/magazyn/transakcje')) {
      ustawZakladke(pobierzZakladkeZUrl(location.pathname));
    }
  }, [location.pathname]);

  useEffect(() => {
    ustawPage(1);
  }, [zakladka, magazynId, zlecenieId, dataOd, dataDo]);

  const pobierzDane = async () => {
    ustawLadowanie(true);
    ustawBlad('');
    try {
      if (zakladka === 'PRZYJECIA') {
        const odpowiedz = await klientApi.get<OdpowiedzListy<Przyjecie>>('/magazyn/przyjecia', {
          params: { page, limit: 30, magazynId: magazynId || undefined, dataOd: dataOd || undefined, dataDo: dataDo || undefined },
        });
        ustawPrzyjecia(odpowiedz.data.dane);
        ustawTotal(odpowiedz.data.total);
      } else if (zakladka === 'WYDANIA') {
        const odpowiedz = await klientApi.get<OdpowiedzListy<Wydanie>>('/magazyn/wydania', {
          params: { page, limit: 30, magazynId: magazynId || undefined, zlecenieId: zlecenieId || undefined, dataOd: dataOd || undefined, dataDo: dataDo || undefined },
        });
        ustawWydania(odpowiedz.data.dane);
        ustawTotal(odpowiedz.data.total);
      } else if (zakladka === 'KOREKTY') {
        const odpowiedz = await klientApi.get<OdpowiedzListy<Korekta>>('/magazyn/korekty', {
          params: { page, limit: 30, magazynId: magazynId || undefined, dataOd: dataOd || undefined, dataDo: dataDo || undefined },
        });
        ustawKorekty(odpowiedz.data.dane);
        ustawTotal(odpowiedz.data.total);
      } else {
        const odpowiedz = await klientApi.get<OdpowiedzListy<Przeniesienie>>('/magazyn/przeniesienia', {
          params: { page, limit: 30, magazynId: magazynId || undefined, dataOd: dataOd || undefined, dataDo: dataDo || undefined },
        });
        ustawPrzeniesienia(odpowiedz.data.dane);
        ustawTotal(odpowiedz.data.total);
      }
    } catch {
      ustawBlad('Nie udalo sie pobrac transakcji magazynowych.');
    } finally {
      ustawLadowanie(false);
    }
  };

  useEffect(() => {
    void pobierzDane();
  }, [zakladka, magazynId, zlecenieId, dataOd, dataDo, page]);

  const odswiezWszystko = async () => {
    await Promise.all([pobierzDane(), odswiezSlowniki()]);
  };

  const liczbaStron = Math.max(1, Math.ceil(total / 30));

  const mapaStanow = useMemo(() => {
    const mapa = new Map<number, number>();
    przyjecia.forEach((item) => mapa.set(item.surowiec.id, (mapa.get(item.surowiec.id) ?? 0) + item.ilosc));
    return mapa;
  }, [przyjecia]);

  return (
    <div className='space-y-6 text-slate-100'>
      <section className={`${KLASY_KARTY} bg-gradient-to-br from-[#1E2A3A] via-[#182230] to-[#0f1724] p-6`}>
        <div className='flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between'>
          <div>
            <div className='mb-3 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-200'>Sprint 9</div>
            <h1 className='text-3xl font-semibold'>Transakcje magazynowe</h1>
            <p className='mt-2 max-w-3xl text-sm text-slate-400'>Przyjecia, wydania, korekty i przeniesienia w jednym widoku operacyjnym.</p>
          </div>
          <Przycisk onClick={() => ustawModal(zakladka)}>
            <Plus size={16} />
            Dodaj
          </Przycisk>
        </div>
      </section>

      <section className={`${KLASY_KARTY} p-4`}>
        <div className='flex flex-wrap gap-3'>
          {ZAKLADKI.map((tab) => (
            <button key={tab.id} type='button' onClick={() => ustawZakladke(tab.id)} className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${zakladka === tab.id ? 'bg-orange-400 text-slate-950' : 'bg-slate-950/50 text-slate-300 hover:bg-slate-800'}`}>
              {tab.etykieta}
            </button>
          ))}
        </div>
      </section>

      <section className={`${KLASY_KARTY} p-4`}>
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          <Rozwijane etykieta='Magazyn' opcje={magazyny.map((magazyn) => ({ wartosc: String(magazyn.id), etykieta: magazyn.nazwa }))} wartosc={magazynId} onZmiana={(wartosc) => ustawMagazynId(String(wartosc))} placeholder='Wszystkie magazyny' />
          {zakladka === 'WYDANIA' ? (
            <Rozwijane etykieta='Zlecenie' opcje={zlecenia.map((zlecenie) => ({ wartosc: String(zlecenie.id), etykieta: zlecenie.numer }))} wartosc={zlecenieId} onZmiana={(wartosc) => ustawZlecenieId(String(wartosc))} placeholder='Wszystkie zlecenia' />
          ) : <div />}
          <Pole etykieta='Data od' type='date' value={dataOd} onChange={(event) => ustawDateOd(event.target.value)} />
          <Pole etykieta='Data do' type='date' value={dataDo} onChange={(event) => ustawDateDo(event.target.value)} />
        </div>
      </section>

      {blad ? <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}

      <section className={`${KLASY_KARTY} p-4`}>
        <div className='overflow-x-auto rounded-[24px] border border-slate-700 bg-slate-950/40'>
          {zakladka === 'PRZYJECIA' ? (
            <table className='min-w-[1300px] w-full text-sm'>
              <thead className='bg-slate-950/80 text-slate-300'><tr>{['Numer', 'Magazyn', 'Surowiec', 'Ilosc', 'Cena', 'Wartosc', 'Uwagi', 'Data', 'Zatwierdzone'].map((label) => <th key={label} className='px-4 py-3 text-left font-medium'>{label}</th>)}</tr></thead>
              <tbody>
                {ladowanie ? <tr><td colSpan={9} className='px-4 py-10 text-center text-slate-400'>Ladowanie przyjec...</td></tr> : przyjecia.length === 0 ? <tr><td colSpan={9} className='px-4 py-10 text-center text-slate-400'>Brak przyjec.</td></tr> : przyjecia.map((item) => (
                  <tr key={item.id} className='border-t border-slate-800 odd:bg-slate-900/20'>
                    <td className='px-4 py-3'>{item.numer ?? '--'}</td>
                    <td className='px-4 py-3'>{item.magazyn.nazwa}</td>
                    <td className='px-4 py-3'>{item.surowiec.nazwa}</td>
                    <td className='px-4 py-3'>{formatujLiczbe(item.ilosc, 4)}</td>
                    <td className='px-4 py-3'>{item.cena !== null ? formatujLiczbe(item.cena) : '--'}</td>
                    <td className='px-4 py-3'>{item.cena !== null ? formatujLiczbe(item.cena * item.ilosc) : '--'}</td>
                    <td className='px-4 py-3'>{item.uwagi ?? '--'}</td>
                    <td className='px-4 py-3'>{formatujDateTime(item.utworzonyW)}</td>
                    <td className='px-4 py-3'>{item.zatwierdzone ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {zakladka === 'WYDANIA' ? (
            <table className='min-w-[1250px] w-full text-sm'>
              <thead className='bg-slate-950/80 text-slate-300'><tr>{['Numer', 'Magazyn', 'Surowiec', 'Ilosc', 'Zlecenie', 'Uwagi', 'Data'].map((label) => <th key={label} className='px-4 py-3 text-left font-medium'>{label}</th>)}</tr></thead>
              <tbody>
                {ladowanie ? <tr><td colSpan={7} className='px-4 py-10 text-center text-slate-400'>Ladowanie wydan...</td></tr> : wydania.length === 0 ? <tr><td colSpan={7} className='px-4 py-10 text-center text-slate-400'>Brak wydan.</td></tr> : wydania.map((item) => (
                  <tr key={item.id} className='border-t border-slate-800 odd:bg-slate-900/20'>
                    <td className='px-4 py-3'>{item.numer ?? '--'}</td>
                    <td className='px-4 py-3'>{item.magazyn.nazwa}</td>
                    <td className='px-4 py-3'>{item.surowiec.nazwa}</td>
                    <td className='px-4 py-3'>{formatujLiczbe(item.ilosc, 4)}</td>
                    <td className='px-4 py-3'>{item.zlecenie ? <Link to={`/zlecenia-produkcyjne`} className='text-orange-200 hover:text-orange-100'>{item.zlecenie.numer}</Link> : '--'}</td>
                    <td className='px-4 py-3'>{item.uwagi ?? '--'}</td>
                    <td className='px-4 py-3'>{formatujDateTime(item.utworzonyW)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {zakladka === 'KOREKTY' ? (
            <table className='min-w-[1150px] w-full text-sm'>
              <thead className='bg-slate-950/80 text-slate-300'><tr>{['Numer', 'Magazyn', 'Surowiec', 'Ilosc', 'Powod', 'Data'].map((label) => <th key={label} className='px-4 py-3 text-left font-medium'>{label}</th>)}</tr></thead>
              <tbody>
                {ladowanie ? <tr><td colSpan={6} className='px-4 py-10 text-center text-slate-400'>Ladowanie korekt...</td></tr> : korekty.length === 0 ? <tr><td colSpan={6} className='px-4 py-10 text-center text-slate-400'>Brak korekt.</td></tr> : korekty.map((item) => (
                  <tr key={item.id} className='border-t border-slate-800 odd:bg-slate-900/20'>
                    <td className='px-4 py-3'>{item.numer ?? '--'}</td>
                    <td className='px-4 py-3'>{item.magazyn.nazwa}</td>
                    <td className='px-4 py-3'>{item.surowiec.nazwa}</td>
                    <td className={`px-4 py-3 ${item.ilosc < 0 ? 'text-red-300' : 'text-slate-100'}`}>{formatujLiczbe(item.ilosc, 4)}</td>
                    <td className='px-4 py-3'>{item.uwagi ?? '--'}</td>
                    <td className='px-4 py-3'>{formatujDateTime(item.utworzonyW)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {zakladka === 'PRZENIESIENIA' ? (
            <table className='min-w-[1300px] w-full text-sm'>
              <thead className='bg-slate-950/80 text-slate-300'><tr>{['Numer', 'Magazyn zrod.', 'Magazyn docel.', 'Surowiec', 'Ilosc', 'Uwagi', 'Data'].map((label) => <th key={label} className='px-4 py-3 text-left font-medium'>{label}</th>)}</tr></thead>
              <tbody>
                {ladowanie ? <tr><td colSpan={7} className='px-4 py-10 text-center text-slate-400'>Ladowanie przeniesien...</td></tr> : przeniesienia.length === 0 ? <tr><td colSpan={7} className='px-4 py-10 text-center text-slate-400'>Brak przeniesien.</td></tr> : przeniesienia.map((item) => (
                  <tr key={item.id} className='border-t border-slate-800 odd:bg-slate-900/20'>
                    <td className='px-4 py-3'>{item.numer ?? '--'}</td>
                    <td className='px-4 py-3'>{item.magazyn.nazwa}</td>
                    <td className='px-4 py-3'>{item.magazynDocelowy?.nazwa ?? '--'}</td>
                    <td className='px-4 py-3'>{item.surowiec.nazwa}</td>
                    <td className='px-4 py-3'>{formatujLiczbe(item.ilosc, 4)}</td>
                    <td className='px-4 py-3'>{item.uwagi ?? '--'}</td>
                    <td className='px-4 py-3'>{formatujDateTime(item.utworzonyW)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        <div className='mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-slate-300'>
          <span>Strona {page} z {liczbaStron}</span>
          <div className='flex gap-2'>
            <Przycisk wariant='drugorzedny' rozmiar='maly' disabled={page <= 1} onClick={() => ustawPage((prev) => prev - 1)}>Poprzednia</Przycisk>
            <Przycisk wariant='drugorzedny' rozmiar='maly' disabled={page >= liczbaStron} onClick={() => ustawPage((prev) => prev + 1)}>Nastepna</Przycisk>
          </div>
        </div>
      </section>

      <PrzyjecieFormularz czyOtwarty={modal === 'PRZYJECIA'} onZamknij={() => ustawModal(null)} onZapisano={odswiezWszystko} magazyny={magazyny} surowce={surowce} />
      <WydanieFormularz czyOtwarty={modal === 'WYDANIA'} onZamknij={() => ustawModal(null)} onZapisano={odswiezWszystko} magazyny={magazyny} surowce={surowce} zlecenia={zlecenia} maxIlosc={magazynId && wydania[0] ? mapaStanow.get(wydania[0].surowiec.id) : undefined} />
      <KorektaFormularz czyOtwarty={modal === 'KOREKTY'} onZamknij={() => ustawModal(null)} onZapisano={odswiezWszystko} magazyny={magazyny} surowce={surowce} />
      <PrzeniesFormularz czyOtwarty={modal === 'PRZENIESIENIA'} onZamknij={() => ustawModal(null)} onZapisano={odswiezWszystko} magazyny={magazyny} surowce={surowce} />
    </div>
  );
}
