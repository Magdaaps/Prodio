import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Download, Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import klientApi from '../api/klient';
import TabelaDanych from '../komponenty/TabelaDanych';
import Pole from '../komponenty/ui/Pole';
import Modal from '../komponenty/ui/Modal';
import Przycisk from '../komponenty/ui/Przycisk';
import { useTabelaDanych } from '../hooki/useTabelaDanych';
import type { KolumnaTabeliDanych } from '../typy/indeks';

interface GrupaProduktu { id: number; nazwa: string; }
interface KlientProduktu { id: number; nazwa: string; }

interface Produkt {
  id: number;
  idProdio: string;
  nazwa: string;
  ean: string | null;
  dodatkoweOznaczenia: string | null;
  grupaId: number | null;
  klientId: number | null;
  aktywny: boolean;
  zdjecie: string | null;
  grupa: GrupaProduktu | null;
  klient: KlientProduktu | null;
}

interface OperacjaProduktu {
  id: number;
  normaSztGodz: string | number;
  parametry: string | null;
  tagi: string[];
  maszynaKoncowa: boolean;
  kolejnosc: number;
  maszyna: { id: number; nazwa: string };
}

interface SurowiecProduktu {
  id: number;
  ilosc: string | number;
  jednostka: string;
  surowiec: { id: number; nazwa: string; jednostka: string; cena: string | number; waluta: string };
  maszyna: { id: number; nazwa: string } | null;
}

interface SzczegolyProduktu extends Produkt {
  wymiar: string | null;
  sposobPakowania: string | null;
  informacjeNiewidoczne: string | null;
  informacjeWidoczne: string | null;
  cena: string | number | null;
  waluta: string | null;
  stawkaVat: number | null;
  bomOperacji: OperacjaProduktu[];
  bomSurowcow: SurowiecProduktu[];
}

interface OdpowiedzApi<T> {
  sukces: boolean;
  dane: T;
  wiadomosc?: string;
}

interface OdpowiedzListy<T> {
  sukces: boolean;
  dane: T[];
  lacznie: number;
  strona: number;
  iloscNaStrone: number;
  wiadomosc?: string;
}

const mapaPolSortowania: Record<string, string> = {
  grupa: 'grupaId',
  klient: 'klientId',
};

const pobierzDatePliku = () => {
  const data = new Date();
  const rok = data.getFullYear();
  const miesiac = String(data.getMonth() + 1).padStart(2, '0');
  const dzien = String(data.getDate()).padStart(2, '0');

  return `${rok}-${miesiac}-${dzien}`;
};

export default function Produkty() {
  const navigate = useNavigate();
  const { strona, iloscNaStrone, kluczSortowania, kierunekSortowania, onZmianaStrony, onSortowanie, resetujStrone } =
    useTabelaDanych(10);
  const [produkty, ustawProdukty] = useState<Produkt[]>([]);
  const [lacznie, ustawLacznie] = useState(0);
  const [szukaj, ustawSzukaj] = useState('');
  const [szukajDebounced, ustawSzukajDebounced] = useState('');
  const [ladowanie, ustawLadowanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [usuwanieId, ustawUsuwanieId] = useState<number | null>(null);
  const [szczegolyProduktu, ustawSzczegolyProduktu] = useState<SzczegolyProduktu | null>(null);
  const [czyModalSzczegolowOtwarty, ustawCzyModalSzczegolowOtwarty] = useState(false);
  const [ladowanieSzczegolow, ustawLadowanieSzczegolow] = useState(false);
  const [bladSzczegolow, ustawBladSzczegolow] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      ustawSzukajDebounced(szukaj.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [szukaj]);

  useEffect(() => {
    resetujStrone();
  }, [szukajDebounced, resetujStrone]);

  useEffect(() => {
    void pobierzProduktow();
  }, [strona, iloscNaStrone, szukajDebounced, kluczSortowania, kierunekSortowania]);

  const pobierzProduktow = async () => {
    ustawLadowanie(true);
    ustawBlad('');

    try {
      const odpowiedz = await klientApi.get<OdpowiedzListy<Produkt>>('/produkty', {
        params: {
          strona,
          iloscNaStrone,
          szukaj: szukajDebounced,
          sortPole: mapaPolSortowania[kluczSortowania] ?? kluczSortowania,
          sortKierunek: kierunekSortowania,
        },
      });

      ustawProdukty(odpowiedz.data.dane);
      ustawLacznie(odpowiedz.data.lacznie);
    } catch {
      ustawBlad('Nie udalo sie pobrac listy produktow.');
      ustawProdukty([]);
      ustawLacznie(0);
    } finally {
      ustawLadowanie(false);
    }
  };

  const obsluzUsuwanie = async (produkt: Produkt) => {
    const potwierdzone = window.confirm(`Czy na pewno chcesz usunac produkt "${produkt.nazwa}"?`);

    if (!potwierdzone) {
      return;
    }

    ustawUsuwanieId(produkt.id);
    ustawBlad('');

    try {
      await klientApi.delete(`/produkty/${produkt.id}`);

      if (produkty.length === 1 && strona > 1) {
        onZmianaStrony(strona - 1);
      } else {
        await pobierzProduktow();
      }
    } catch {
      ustawBlad('Nie udalo sie usunac produktu.');
    } finally {
      ustawUsuwanieId(null);
    }
  };

  const eksportujProdukty = () => {
    const dane = produkty.map((produkt) => ({
      'ID Prodio': produkt.idProdio,
      Nazwa: produkt.nazwa,
      EAN: produkt.ean || '-',
      Klient: produkt.klient?.nazwa || '-',
      Grupa: produkt.grupa?.nazwa || '-',
      Aktywny: produkt.aktywny ? 'Tak' : 'Nie',
    }));

    const skoroszyt = XLSX.utils.book_new();
    const arkusz = XLSX.utils.json_to_sheet(dane);

    XLSX.utils.book_append_sheet(skoroszyt, arkusz, 'Produkty');
    XLSX.writeFile(skoroszyt, `produkty_${pobierzDatePliku()}.xlsx`);
  };

  const obsluzDuplikowanie = (produkt: Produkt) => {
    navigate('/produkty/nowy', { state: { duplicateFromId: produkt.id } });
  };

  const obsluzPokazSzczegoly = async (produkt: Produkt) => {
    ustawCzyModalSzczegolowOtwarty(true);
    ustawLadowanieSzczegolow(true);
    ustawBladSzczegolow('');

    try {
      const odpowiedz = await klientApi.get<OdpowiedzApi<SzczegolyProduktu>>(`/produkty/${produkt.id}`);
      ustawSzczegolyProduktu(odpowiedz.data.dane);
    } catch {
      ustawSzczegolyProduktu(null);
      ustawBladSzczegolow('Nie udalo sie pobrac szczegolow produktu.');
    } finally {
      ustawLadowanieSzczegolow(false);
    }
  };

  const zamknijModalSzczegolow = () => {
    ustawCzyModalSzczegolowOtwarty(false);
    ustawSzczegolyProduktu(null);
    ustawBladSzczegolow('');
    ustawLadowanieSzczegolow(false);
  };

  const kolumny = useMemo<KolumnaTabeliDanych<Produkt>[]>(
    () => [
      { klucz: 'idProdio', naglowek: 'ID Prodio', sortowalny: true, szerokosc: '130px' },
      {
        klucz: 'zdjecie',
        naglowek: 'Zdjecie',
        szerokosc: '90px',
        renderuj: (produkt) =>
          produkt.zdjecie ? (
            <img
              src={produkt.zdjecie}
              alt={produkt.nazwa}
              className='h-12 w-12 rounded object-contain bg-slate-800'
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className='h-12 w-12 rounded bg-slate-700/50 flex items-center justify-center text-tekst-drugorzedny'>
              <svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'><rect width='18' height='18' x='3' y='3' rx='2'/><circle cx='9' cy='9' r='2'/><path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/></svg>
            </div>
          ),
      },
      { klucz: 'nazwa', naglowek: 'Nazwa', sortowalny: true, szerokosc: '240px' },
      {
        klucz: 'ean',
        naglowek: 'EAN',
        sortowalny: true,
        szerokosc: '150px',
        renderuj: (produkt) => produkt.ean || '-',
      },
      {
        klucz: 'grupa',
        naglowek: 'Grupa',
        sortowalny: true,
        szerokosc: '180px',
        renderuj: (produkt) => produkt.grupa?.nazwa || '-',
      },
      {
        klucz: 'klient',
        naglowek: 'Klient',
        sortowalny: true,
        szerokosc: '200px',
        renderuj: (produkt) => produkt.klient?.nazwa || '-',
      },
      {
        klucz: 'aktywny',
        naglowek: 'Aktywny',
        sortowalny: true,
        szerokosc: '130px',
        renderuj: (produkt) => (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
              produkt.aktywny ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-300'
            }`}
          >
            {produkt.aktywny ? 'Aktywny' : 'Nieaktywny'}
          </span>
        ),
      },
      {
        klucz: 'akcje',
        naglowek: 'Akcje',
        szerokosc: '180px',
        renderuj: (produkt) => (
          <div className='flex items-center gap-2 whitespace-nowrap'>
            <Przycisk
              type='button'
              wariant='drugorzedny'
              rozmiar='maly'
              onClick={() => void obsluzPokazSzczegoly(produkt)}
              title='Zobacz szczegoly'
              aria-label={`Zobacz szczegoly produktu ${produkt.nazwa}`}
              className='h-8 w-8 px-0'
            >
              <Eye size={14} />
            </Przycisk>
            <Przycisk
              type='button'
              wariant='drugorzedny'
              rozmiar='maly'
              onClick={() => obsluzDuplikowanie(produkt)}
              title='Duplikuj'
              aria-label={`Duplikuj produkt ${produkt.nazwa}`}
              className='h-8 w-8 px-0'
            >
              <Copy size={14} />
            </Przycisk>
            <Przycisk
              type='button'
              wariant='drugorzedny'
              rozmiar='maly'
              onClick={() => navigate(`/produkty/${produkt.id}/edytuj`)}
              title='Edytuj'
              aria-label={`Edytuj produkt ${produkt.nazwa}`}
              className='h-8 w-8 px-0'
            >
              <Pencil size={14} />
            </Przycisk>
            <Przycisk
              type='button'
              wariant='niebezpieczny'
              rozmiar='maly'
              czyLaduje={usuwanieId === produkt.id}
              onClick={() => void obsluzUsuwanie(produkt)}
              title='Usun'
              aria-label={`Usun produkt ${produkt.nazwa}`}
              className='h-8 w-8 px-0'
            >
              <Trash2 size={14} />
            </Przycisk>
          </div>
        ),
      },
    ],
    [usuwanieId]
  );

  return (
    <div className='space-y-6'>
      <section className='rounded-2xl border border-obramowanie bg-tlo-karta p-6 shadow-sm'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
          <div className='space-y-2'>
            <p className='text-sm font-medium uppercase tracking-[0.24em] text-akcent'>Modul produktow</p>
            <div>
              <h1 className='text-3xl font-semibold text-tekst-glowny'>Produkty</h1>
              <p className='text-sm text-tekst-drugorzedny'>
                Zarzadzanie katalogiem produktow, grupami oraz przypisaniem do klientow.
              </p>
            </div>
          </div>

          <div className='flex w-full flex-col gap-3 sm:flex-row lg:w-auto'>
            <div className='w-full sm:min-w-[320px]'>
              <Pole
                etykieta='Szukaj po nazwie, ID Prodio lub EAN'
                placeholder='Np. PROD-1001 lub 590...'
                value={szukaj}
                onChange={(event) => ustawSzukaj(event.target.value)}
                ikonaPrefix={<Search size={16} />}
              />
            </div>

            <Przycisk className='self-end' onClick={() => navigate('/produkty/nowy')}>
              <Plus size={16} />
              Dodaj produkt
            </Przycisk>
          </div>
        </div>
      </section>

      <section className='rounded-2xl border border-obramowanie bg-tlo-karta p-6 shadow-sm'>
        <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='flex flex-col gap-1'>
            <h2 className='text-lg font-semibold text-tekst-glowny'>Lista produktow</h2>
            <p className='text-sm text-tekst-drugorzedny'>Lacznie rekordow: {lacznie}</p>
          </div>
          <Przycisk type='button' wariant='drugorzedny' onClick={eksportujProdukty}>
            <Download size={16} />
            EKSPORT
          </Przycisk>
        </div>

        {blad ? (
          <div className='mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300'>
            {blad}
          </div>
        ) : null}

        <TabelaDanych
          kolumny={kolumny}
          dane={produkty}
          ladowanie={ladowanie}
          stronaPaginacji={strona}
          iloscNaStrone={iloscNaStrone}
          lacznie={lacznie}
          onZmianaStrony={onZmianaStrony}
          onSortowanie={onSortowanie}
        />
      </section>

      <Modal
        czyOtwarty={czyModalSzczegolowOtwarty}
        onZamknij={zamknijModalSzczegolow}
        tytul={szczegolyProduktu?.nazwa || 'Szczegoly produktu'}
        rozmiar='bardzoDuzy'
        akcje={
          <>
            {szczegolyProduktu ? (
              <>
                <Przycisk type='button' wariant='drugorzedny' onClick={() => obsluzDuplikowanie(szczegolyProduktu)}>
                  <Copy size={16} />
                  Duplikuj
                </Przycisk>
                <Przycisk type='button' wariant='drugorzedny' onClick={() => navigate(`/produkty/${szczegolyProduktu.id}/edytuj`)}>
                  <Pencil size={16} />
                  Edytuj
                </Przycisk>
              </>
            ) : null}
            <Przycisk type='button' wariant='drugorzedny' onClick={zamknijModalSzczegolow}>
              <X size={16} />
              Zamknij
            </Przycisk>
          </>
        }
      >
        {ladowanieSzczegolow ? (
          <div className='grid gap-6 lg:grid-cols-[320px_1fr]'>
            <div className='h-[420px] animate-pulse rounded-2xl border border-obramowanie bg-tlo-glowne/60' />
            <div className='space-y-4'>
              <div className='h-24 animate-pulse rounded-2xl border border-obramowanie bg-tlo-glowne/60' />
              <div className='h-64 animate-pulse rounded-2xl border border-obramowanie bg-tlo-glowne/60' />
            </div>
          </div>
        ) : bladSzczegolow ? (
          <div className='rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-10 text-center text-sm text-red-300'>
            {bladSzczegolow}
          </div>
        ) : szczegolyProduktu ? (
          <div className='space-y-6'>
            <div className='grid gap-6 xl:grid-cols-[320px_1fr]'>
              <section className='rounded-2xl border border-obramowanie bg-tlo-glowne/50 p-5 shadow-sm'>
                <div className='mb-4'>
                  <p className='text-xs font-semibold uppercase tracking-[0.24em] text-akcent'>Podglad produktu</p>
                  <h3 className='mt-2 text-xl font-semibold text-tekst-glowny'>{szczegolyProduktu.nazwa}</h3>
                  <p className='mt-1 text-sm text-tekst-drugorzedny'>ID Prodio: {szczegolyProduktu.idProdio}</p>
                </div>

                <div className='flex min-h-[420px] items-center justify-center rounded-2xl border border-obramowanie bg-gradient-to-b from-slate-800/70 via-slate-900/70 to-slate-950/80 p-6'>
                  {szczegolyProduktu.zdjecie ? (
                    <img
                      src={szczegolyProduktu.zdjecie}
                      alt={szczegolyProduktu.nazwa}
                      className='max-h-[380px] w-full object-contain drop-shadow-[0_18px_40px_rgba(15,23,42,0.55)]'
                    />
                  ) : (
                    <div className='flex h-full min-h-[280px] w-full items-center justify-center rounded-2xl border border-dashed border-obramowanie text-sm text-tekst-drugorzedny'>
                      Brak zdjecia produktu
                    </div>
                  )}
                </div>

                <div className='mt-4 grid grid-cols-2 gap-3'>
                  <InfoKafelek etykieta='Status' wartosc={szczegolyProduktu.aktywny ? 'Aktywny' : 'Nieaktywny'} akcent={szczegolyProduktu.aktywny} />
                  <InfoKafelek etykieta='EAN' wartosc={szczegolyProduktu.ean || '-'} />
                  <InfoKafelek etykieta='Grupa' wartosc={szczegolyProduktu.grupa?.nazwa || 'Domyslna'} />
                  <InfoKafelek etykieta='Klient' wartosc={szczegolyProduktu.klient?.nazwa || '-'} />
                </div>
              </section>

              <div className='space-y-6'>
                <section className='rounded-2xl border border-obramowanie bg-tlo-glowne/40 p-5 shadow-sm'>
                  <div className='mb-4 flex flex-wrap items-start justify-between gap-3'>
                    <div>
                      <p className='text-xs font-semibold uppercase tracking-[0.24em] text-akcent'>Karta produktu</p>
                      <h3 className='mt-2 text-lg font-semibold text-tekst-glowny'>Szczegoly podstawowe</h3>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${szczegolyProduktu.aktywny ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-300'}`}>
                      {szczegolyProduktu.aktywny ? 'Aktywny' : 'Nieaktywny'}
                    </span>
                  </div>

                  <div className='grid gap-3 md:grid-cols-2'>
                    <WierszSzczegolu etykieta='Nazwa' wartosc={szczegolyProduktu.nazwa} />
                    <WierszSzczegolu etykieta='ID Prodio' wartosc={szczegolyProduktu.idProdio} />
                    <WierszSzczegolu etykieta='EAN' wartosc={szczegolyProduktu.ean} />
                    <WierszSzczegolu etykieta='Dodatkowe oznaczenia' wartosc={szczegolyProduktu.dodatkoweOznaczenia} />
                    <WierszSzczegolu etykieta='Grupa produktow' wartosc={szczegolyProduktu.grupa?.nazwa} />
                    <WierszSzczegolu etykieta='Klient' wartosc={szczegolyProduktu.klient?.nazwa} />
                    <WierszSzczegolu etykieta='Wymiar' wartosc={szczegolyProduktu.wymiar} />
                    <WierszSzczegolu etykieta='Sposob pakowania' wartosc={szczegolyProduktu.sposobPakowania} />
                    <WierszSzczegolu etykieta='Cena netto' wartosc={formatujCene(szczegolyProduktu.cena, szczegolyProduktu.waluta)} />
                    <WierszSzczegolu etykieta='Stawka VAT' wartosc={szczegolyProduktu.stawkaVat != null ? `${szczegolyProduktu.stawkaVat}%` : '-'} />
                  </div>
                </section>

                <section className='grid gap-6 lg:grid-cols-2'>
                  <BlokTekstowy
                    tytul='Informacje niewidoczne dla produkcji'
                    tresc={szczegolyProduktu.informacjeNiewidoczne}
                  />
                  <BlokTekstowy
                    tytul='Informacje widoczne dla produkcji'
                    tresc={szczegolyProduktu.informacjeWidoczne}
                  />
                </section>
              </div>
            </div>

            <div className='grid gap-6 xl:grid-cols-2'>
              <section className='rounded-2xl border border-obramowanie bg-tlo-glowne/40 p-5 shadow-sm'>
                <div className='mb-4 flex items-center justify-between gap-3'>
                  <div>
                    <p className='text-xs font-semibold uppercase tracking-[0.24em] text-akcent'>Technologia</p>
                    <h3 className='mt-2 text-lg font-semibold text-tekst-glowny'>Powiazane operacje</h3>
                  </div>
                  <span className='rounded-full bg-akcent/10 px-3 py-1 text-xs font-medium text-akcent'>
                    {szczegolyProduktu.bomOperacji.length} pozycji
                  </span>
                </div>

                {szczegolyProduktu.bomOperacji.length > 0 ? (
                  <div className='space-y-3'>
                    {szczegolyProduktu.bomOperacji
                      .slice()
                      .sort((a, b) => a.kolejnosc - b.kolejnosc)
                      .map((operacja) => (
                        <div key={operacja.id} className='rounded-xl border border-obramowanie bg-tlo-karta/70 p-4'>
                          <div className='flex items-start justify-between gap-3'>
                            <div>
                              <p className='text-sm font-semibold text-tekst-glowny'>{operacja.maszyna.nazwa}</p>
                              <p className='mt-1 text-xs text-tekst-drugorzedny'>Kolejnosc: {operacja.kolejnosc}</p>
                            </div>
                            {operacja.maszynaKoncowa ? (
                              <span className='rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400'>
                                Koncowa
                              </span>
                            ) : null}
                          </div>
                          <div className='mt-3 grid gap-2 text-sm text-tekst-drugorzedny'>
                            <p>Norma: <span className='text-tekst-glowny'>{String(operacja.normaSztGodz)} szt./h</span></p>
                            <p>Parametry: <span className='text-tekst-glowny'>{operacja.parametry || '-'}</span></p>
                            <p>Tagi: <span className='text-tekst-glowny'>{operacja.tagi.length ? operacja.tagi.join(', ') : '-'}</span></p>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <PustePowiazanie tresc='Brak przypisanych operacji dla tego produktu.' />
                )}
              </section>

              <section className='rounded-2xl border border-obramowanie bg-tlo-glowne/40 p-5 shadow-sm'>
                <div className='mb-4 flex items-center justify-between gap-3'>
                  <div>
                    <p className='text-xs font-semibold uppercase tracking-[0.24em] text-akcent'>Materialy</p>
                    <h3 className='mt-2 text-lg font-semibold text-tekst-glowny'>Powiazane surowce</h3>
                  </div>
                  <span className='rounded-full bg-akcent/10 px-3 py-1 text-xs font-medium text-akcent'>
                    {szczegolyProduktu.bomSurowcow.length} pozycji
                  </span>
                </div>

                {szczegolyProduktu.bomSurowcow.length > 0 ? (
                  <div className='space-y-3'>
                    {szczegolyProduktu.bomSurowcow.map((surowiec) => (
                      <div key={surowiec.id} className='rounded-xl border border-obramowanie bg-tlo-karta/70 p-4'>
                        <div className='flex items-start justify-between gap-3'>
                          <div>
                            <p className='text-sm font-semibold text-tekst-glowny'>{surowiec.surowiec.nazwa}</p>
                            <p className='mt-1 text-xs text-tekst-drugorzedny'>
                              Maszyna: {surowiec.maszyna?.nazwa || 'Bez przypisania'}
                            </p>
                          </div>
                          <span className='rounded-full bg-slate-500/15 px-3 py-1 text-xs font-medium text-slate-200'>
                            {String(surowiec.ilosc)} {surowiec.jednostka}
                          </span>
                        </div>
                        <p className='mt-3 text-sm text-tekst-drugorzedny'>
                          Cena referencyjna:{' '}
                          <span className='text-tekst-glowny'>
                            {String(surowiec.surowiec.cena)} {surowiec.surowiec.waluta}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <PustePowiazanie tresc='Brak przypisanych surowcow dla tego produktu.' />
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className='rounded-xl border border-obramowanie bg-tlo-glowne/30 px-4 py-10 text-center text-sm text-tekst-drugorzedny'>
            Wybierz produkt, aby zobaczyc jego szczegoly.
          </div>
        )}
      </Modal>
    </div>
  );
}

function InfoKafelek({ etykieta, wartosc, akcent = false }: { etykieta: string; wartosc: string; akcent?: boolean }) {
  return (
    <div className='rounded-xl border border-obramowanie bg-tlo-karta/70 px-4 py-3'>
      <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-tekst-drugorzedny'>{etykieta}</p>
      <p className={`mt-2 text-sm font-medium ${akcent ? 'text-emerald-400' : 'text-tekst-glowny'}`}>{wartosc}</p>
    </div>
  );
}

function WierszSzczegolu({ etykieta, wartosc }: { etykieta: string; wartosc?: string | null }) {
  return (
    <div className='rounded-xl border border-obramowanie bg-tlo-karta/70 px-4 py-3'>
      <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-tekst-drugorzedny'>{etykieta}</p>
      <p className='mt-2 text-sm text-tekst-glowny'>{wartosc && wartosc.trim() ? wartosc : '-'}</p>
    </div>
  );
}

function BlokTekstowy({ tytul, tresc }: { tytul: string; tresc?: string | null }) {
  return (
    <section className='rounded-2xl border border-obramowanie bg-tlo-glowne/40 p-5 shadow-sm'>
      <p className='text-xs font-semibold uppercase tracking-[0.24em] text-akcent'>Notatki</p>
      <h3 className='mt-2 text-lg font-semibold text-tekst-glowny'>{tytul}</h3>
      <div className='mt-4 min-h-[180px] rounded-xl border border-obramowanie bg-tlo-karta/70 p-4 text-sm leading-6 text-tekst-drugorzedny'>
        {tresc && tresc.trim() ? tresc : 'Brak dodatkowych informacji.'}
      </div>
    </section>
  );
}

function PustePowiazanie({ tresc }: { tresc: string }) {
  return (
    <div className='rounded-xl border border-dashed border-obramowanie bg-tlo-karta/50 px-4 py-10 text-center text-sm text-tekst-drugorzedny'>
      {tresc}
    </div>
  );
}

function formatujCene(cena: string | number | null, waluta: string | null) {
  if (cena == null || cena === '') {
    return '-';
  }

  return `${String(cena)} ${waluta || 'PLN'}`;
}
