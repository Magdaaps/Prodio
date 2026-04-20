import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { KolumnaTabeliDanych, PropsTabeliDanych } from '../typy/indeks';

type KierunekSortowania = 'asc' | 'desc';

const LICZBA_WIERSZY_SKELETONU = 5;
const MAKSYMALNA_LICZBA_WIDOCZNYCH_STRON = 5;

export default function TabelaDanych<T extends object>({
  kolumny,
  dane,
  ladowanie = false,
  stronaPaginacji = 1,
  iloscNaStrone = 10,
  lacznie,
  onZmianaStrony,
  onSortowanie,
  wybraneDane = [],
  onWybierzWszystkie,
}: PropsTabeliDanych<T>) {
  const [kluczSortowania, ustawKluczSortowania] = useState('');
  const [kierunekSortowania, ustawKierunekSortowania] = useState<KierunekSortowania>('asc');

  const lacznaLiczbaElementow = lacznie ?? dane.length;
  const liczbaStron = Math.max(1, Math.ceil(lacznaLiczbaElementow / iloscNaStrone));

  const wszystkieZaznaczone = dane.length > 0 && dane.every((wiersz) => wybraneDane.includes(wiersz));

  const widoczneNumeryStron = useMemo(() => {
    const polowaOkna = Math.floor(MAKSYMALNA_LICZBA_WIDOCZNYCH_STRON / 2);
    let poczatek = Math.max(1, stronaPaginacji - polowaOkna);
    let koniec = Math.min(liczbaStron, poczatek + MAKSYMALNA_LICZBA_WIDOCZNYCH_STRON - 1);

    if (koniec - poczatek + 1 < MAKSYMALNA_LICZBA_WIDOCZNYCH_STRON) {
      poczatek = Math.max(1, koniec - MAKSYMALNA_LICZBA_WIDOCZNYCH_STRON + 1);
    }

    return Array.from({ length: koniec - poczatek + 1 }, (_, indeks) => poczatek + indeks);
  }, [liczbaStron, stronaPaginacji]);

  const obsluzSortowanie = (kolumna: KolumnaTabeliDanych<T>) => {
    if (!kolumna.sortowalny) {
      return;
    }

    const nowyKlucz = String(kolumna.klucz);
    const nowyKierunek: KierunekSortowania =
      kluczSortowania === nowyKlucz && kierunekSortowania === 'asc' ? 'desc' : 'asc';

    ustawKluczSortowania(nowyKlucz);
    ustawKierunekSortowania(nowyKierunek);
    onSortowanie?.(nowyKlucz, nowyKierunek);
  };

  const renderujIkoneSortowania = (kolumna: KolumnaTabeliDanych<T>) => {
    if (!kolumna.sortowalny) {
      return null;
    }

    const aktywna = kluczSortowania === String(kolumna.klucz);
    const wspolneKlasy = `h-4 w-4 ${aktywna ? 'text-akcent' : 'text-tekst-drugorzedny'}`;

    if (aktywna && kierunekSortowania === 'desc') {
      return <ChevronDown className={wspolneKlasy} />;
    }

    return <ChevronUp className={wspolneKlasy} />;
  };

  const renderujKomorke = (kolumna: KolumnaTabeliDanych<T>, wiersz: T) => {
    if (kolumna.renderuj) {
      return kolumna.renderuj(wiersz);
    }

    const wartosc = (wiersz as Record<string, unknown>)[String(kolumna.klucz)];

    if (wartosc === null || wartosc === undefined) {
      return '-';
    }

    return String(wartosc);
  };

  const przyciskPaginacji =
    'rounded-md border border-obramowanie px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className='space-y-4'>
      <div className='overflow-x-auto rounded-lg border border-obramowanie'>
        <table className='min-w-full border-collapse text-left text-sm text-tekst-glowny'>
          <thead className='sticky top-0 z-10 bg-tlo-naglowek'>
            <tr>
              <th className='border border-obramowanie px-4 py-3 w-12'>
                <input
                  type='checkbox'
                  checked={wszystkieZaznaczone}
                  onChange={(event) => onWybierzWszystkie?.(event.target.checked)}
                  className='h-4 w-4 rounded border-obramowanie bg-tlo-glowne text-akcent focus:ring-akcent'
                />
              </th>
              {kolumny.map((kolumna) => (
                <th
                  key={String(kolumna.klucz)}
                  className='border border-obramowanie px-4 py-3 font-medium text-tekst-drugorzedny'
                  style={kolumna.szerokosc ? { width: kolumna.szerokosc } : undefined}
                >
                  <button
                    type='button'
                    onClick={() => obsluzSortowanie(kolumna)}
                    disabled={!kolumna.sortowalny}
                    className={`flex items-center gap-2 ${
                      kolumna.sortowalny
                        ? 'cursor-pointer text-tekst-glowny transition-colors hover:text-akcent'
                        : 'cursor-default text-tekst-drugorzedny'
                    }`}
                  >
                    <span>{kolumna.naglowek}</span>
                    {renderujIkoneSortowania(kolumna)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {ladowanie &&
              Array.from({ length: LICZBA_WIERSZY_SKELETONU }, (_, indeksWiersza) => (
                <tr
                  key={`skeleton-${indeksWiersza}`}
                  className={indeksWiersza % 2 === 0 ? 'bg-tlo-glowne' : 'bg-tlo-karta/30'}
                >
                  <td className='border border-obramowanie px-4 py-3'>
                    <div className='h-4 w-4 animate-pulse rounded bg-obramowanie' />
                  </td>
                  {kolumny.map((kolumna) => (
                    <td key={`skeleton-${indeksWiersza}-${String(kolumna.klucz)}`} className='border border-obramowanie px-4 py-3'>
                      <div className='h-4 w-full animate-pulse rounded bg-obramowanie' />
                    </td>
                  ))}
                </tr>
              ))}

            {!ladowanie && dane.length === 0 && (
              <tr>
                <td
                  colSpan={kolumny.length + 1}
                  className='border border-obramowanie px-4 py-10 text-center text-tekst-drugorzedny'
                >
                  Brak danych
                </td>
              </tr>
            )}

            {!ladowanie &&
              dane.map((wiersz, indeksWiersza) => {
                const zaznaczony = wybraneDane.includes(wiersz);

                return (
                  <tr key={indeksWiersza} className={indeksWiersza % 2 === 0 ? 'bg-tlo-glowne' : 'bg-tlo-karta/30'}>
                    <td className='border border-obramowanie px-4 py-3'>
                      <input
                        type='checkbox'
                        checked={zaznaczony}
                        readOnly
                        className='h-4 w-4 rounded border-obramowanie bg-tlo-glowne text-akcent focus:ring-akcent'
                      />
                    </td>
                    {kolumny.map((kolumna) => (
                      <td key={String(kolumna.klucz)} className='border border-obramowanie px-4 py-3 text-tekst-glowny'>
                        {renderujKomorke(kolumna, wiersz)}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3 text-sm text-tekst-drugorzedny'>
        <span>
          Strona {stronaPaginacji} z {liczbaStron}
        </span>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => onZmianaStrony?.(stronaPaginacji - 1)}
            disabled={stronaPaginacji <= 1}
            className={`${przyciskPaginacji} hover:border-akcent hover:text-akcent`}
          >
            Poprzednia
          </button>

          {widoczneNumeryStron.map((numerStrony) => (
            <button
              key={numerStrony}
              type='button'
              onClick={() => onZmianaStrony?.(numerStrony)}
              className={`${przyciskPaginacji} ${
                numerStrony === stronaPaginacji
                  ? 'border-akcent text-akcent'
                  : 'hover:border-akcent hover:text-akcent'
              }`}
            >
              {numerStrony}
            </button>
          ))}

          <button
            type='button'
            onClick={() => onZmianaStrony?.(stronaPaginacji + 1)}
            disabled={stronaPaginacji >= liczbaStron}
            className={`${przyciskPaginacji} hover:border-akcent hover:text-akcent`}
          >
            Następna
          </button>
        </div>
      </div>
    </div>
  );
}
