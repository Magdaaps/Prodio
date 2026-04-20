import { useId, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-react';
import * as XLSX from 'xlsx';
import Przycisk from './ui/Przycisk';

type KolumnaDocelowa = {
  klucz: string;
  etykieta: string;
  wymagany: boolean;
};

type PropsImporteraCsv = {
  onImport: (wiersze: Record<string, unknown>[]) => void;
  kolumnyDocelowe: KolumnaDocelowa[];
};

type StanKomunikatu = {
  dodano: number;
  bledow: number;
};

const KLASY_SELECTA =
  'w-full rounded-lg border border-obramowanie bg-tlo-glowne px-3 py-2 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent';

function normalizujNaglowek(wartosc: unknown, indeks: number) {
  const tekst = String(wartosc ?? '').trim();
  return tekst || `Kolumna ${indeks + 1}`;
}

function pobierzArkusz(plk: File) {
  return plk.arrayBuffer().then((buffer) =>
    XLSX.read(buffer, {
      type: 'array',
      raw: false,
      cellDates: true,
    })
  );
}

function czyPustaWartosc(wartosc: unknown) {
  if (wartosc === null || wartosc === undefined) {
    return true;
  }

  if (typeof wartosc === 'string') {
    return wartosc.trim().length === 0;
  }

  return false;
}

export default function ImporterCsv({
  onImport,
  kolumnyDocelowe,
}: PropsImporteraCsv) {
  const inputId = useId();
  const [plik, ustawPlik] = useState<File | null>(null);
  const [wierszePliku, ustawWierszePliku] = useState<Record<string, unknown>[]>([]);
  const [naglowkiPliku, ustawNaglowkiPliku] = useState<string[]>([]);
  const [mapowanieKolumn, ustawMapowanieKolumn] = useState<Record<string, string>>({});
  const [czyPrzeciaganie, ustawCzyPrzeciaganie] = useState(false);
  const [ladowanie, ustawLadowanie] = useState(false);
  const [bladPliku, ustawBladPliku] = useState('');
  const [komunikat, ustawKomunikat] = useState<StanKomunikatu | null>(null);

  const wymaganeKolumny = useMemo(
    () => kolumnyDocelowe.filter((kolumna) => kolumna.wymagany),
    [kolumnyDocelowe]
  );

  const przypisaneKlucze = useMemo(
    () => Object.values(mapowanieKolumn).filter(Boolean),
    [mapowanieKolumn]
  );

  const zduplikowaneKlucze = useMemo(() => {
    const liczniki = new Map<string, number>();

    przypisaneKlucze.forEach((klucz) => {
      liczniki.set(klucz, (liczniki.get(klucz) ?? 0) + 1);
    });

    return new Set(
      Array.from(liczniki.entries())
        .filter(([, liczba]) => liczba > 1)
        .map(([klucz]) => klucz)
    );
  }, [przypisaneKlucze]);

  const brakujaceWymaganeKlucze = useMemo(
    () =>
      wymaganeKolumny
        .map((kolumna) => kolumna.klucz)
        .filter((klucz) => !przypisaneKlucze.includes(klucz) || zduplikowaneKlucze.has(klucz)),
    [przypisaneKlucze, wymaganeKolumny, zduplikowaneKlucze]
  );

  const czyMapowaniePoprawne =
    naglowkiPliku.length > 0 &&
    brakujaceWymaganeKlucze.length === 0 &&
    zduplikowaneKlucze.size === 0;

  const podgladWierszy = useMemo(() => wierszePliku.slice(0, 10), [wierszePliku]);

  const opcjeKolumn = useMemo(
    () =>
      kolumnyDocelowe.map((kolumna) => ({
        wartosc: kolumna.klucz,
        etykieta: `${kolumna.etykieta}${kolumna.wymagany ? ' *' : ''}`,
      })),
    [kolumnyDocelowe]
  );

  const przetworzPlik = async (nowyPlik: File) => {
    ustawLadowanie(true);
    ustawBladPliku('');
    ustawKomunikat(null);

    try {
      const skoroszyt = await pobierzArkusz(nowyPlik);
      const nazwaArkusza = skoroszyt.SheetNames[0];
      const arkusz = skoroszyt.Sheets[nazwaArkusza];

      if (!arkusz) {
        throw new Error('Wybrany plik nie zawiera danych do importu.');
      }

      const wiersze = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(arkusz, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      if (wiersze.length === 0) {
        throw new Error('Wybrany plik jest pusty.');
      }

      const [pierwszyWiersz, ...daneWierszy] = wiersze;
      const naglowki = (pierwszyWiersz ?? []).map((wartosc, indeks) =>
        normalizujNaglowek(wartosc, indeks)
      );

      const rekordy = daneWierszy
        .map((wiersz) => {
          const rekord: Record<string, unknown> = {};

          naglowki.forEach((naglowek, indeks) => {
            rekord[naglowek] = wiersz?.[indeks] ?? '';
          });

          return rekord;
        })
        .filter((rekord) =>
          Object.values(rekord).some((wartosc) => !czyPustaWartosc(wartosc))
        );

      const domyslneMapowanie = naglowki.reduce<Record<string, string>>((acc, naglowek) => {
        const dopasowanie = kolumnyDocelowe.find(
          (kolumna) =>
            kolumna.klucz.toLowerCase() === naglowek.toLowerCase() ||
            kolumna.etykieta.toLowerCase() === naglowek.toLowerCase()
        );

        acc[naglowek] = dopasowanie?.klucz ?? '';
        return acc;
      }, {});

      ustawPlik(nowyPlik);
      ustawNaglowkiPliku(naglowki);
      ustawWierszePliku(rekordy);
      ustawMapowanieKolumn(domyslneMapowanie);
    } catch (error) {
      ustawPlik(null);
      ustawNaglowkiPliku([]);
      ustawWierszePliku([]);
      ustawMapowanieKolumn({});
      ustawBladPliku(
        error instanceof Error ? error.message : 'Nie udalo sie odczytac wybranego pliku.'
      );
    } finally {
      ustawLadowanie(false);
    }
  };

  const obsluzWyborPliku = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const nowyPlik = event.target.files?.[0];

    if (!nowyPlik) {
      return;
    }

    await przetworzPlik(nowyPlik);
    event.target.value = '';
  };

  const obsluzUpuszczenie = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    ustawCzyPrzeciaganie(false);

    const nowyPlik = event.dataTransfer.files?.[0];

    if (!nowyPlik) {
      return;
    }

    await przetworzPlik(nowyPlik);
  };

  const obsluzImport = () => {
    const odwroconeMapowanie = Object.entries(mapowanieKolumn).filter(
      ([, kluczDocelowy]) => kluczDocelowy
    );

    const poprawneWiersze: Record<string, unknown>[] = [];
    let liczbaBledow = 0;

    wierszePliku.forEach((wiersz) => {
      const rekord: Record<string, unknown> = {};

      odwroconeMapowanie.forEach(([naglowekPliku, kluczDocelowy]) => {
        rekord[kluczDocelowy] = wiersz[naglowekPliku];
      });

      const maBrakujaceWartosci = wymaganeKolumny.some((kolumna) =>
        czyPustaWartosc(rekord[kolumna.klucz])
      );

      if (maBrakujaceWartosci) {
        liczbaBledow += 1;
        return;
      }

      poprawneWiersze.push(rekord);
    });

    onImport(poprawneWiersze);
    ustawKomunikat({
      dodano: poprawneWiersze.length,
      bledow: liczbaBledow,
    });
  };

  return (
    <section className='space-y-6 rounded-3xl border border-obramowanie bg-tlo-karta p-6 shadow-xl shadow-black/10'>
      <div className='space-y-2'>
        <p className='text-sm uppercase tracking-[0.22em] text-tekst-drugorzedny'>
          Import danych
        </p>
        <div className='flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between'>
          <div>
            <h2 className='text-2xl font-semibold text-tekst-glowny'>Importer CSV / XLSX</h2>
            <p className='mt-1 text-sm text-tekst-drugorzedny'>
              Wgraj plik, przypisz kolumny do pol systemowych i zaimportuj dane do aplikacji.
            </p>
          </div>
          {plik ? (
            <div className='rounded-2xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-drugorzedny'>
              Plik: <span className='font-medium text-tekst-glowny'>{plik.name}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className='space-y-4'>
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            ustawCzyPrzeciaganie(true);
          }}
          onDragLeave={() => ustawCzyPrzeciaganie(false)}
          onDrop={(event) => {
            void obsluzUpuszczenie(event);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-10 text-center transition-colors ${
            czyPrzeciaganie
              ? 'border-akcent bg-akcent/10'
              : 'border-obramowanie bg-tlo-glowne hover:border-akcent hover:bg-tlo-karta'
          }`}
        >
          <div className='mb-4 rounded-2xl border border-obramowanie bg-tlo-karta p-4 text-akcent'>
            <UploadCloud className='h-8 w-8' />
          </div>
          <p className='text-base font-medium text-tekst-glowny'>
            Przeciagnij tutaj plik CSV lub XLSX
          </p>
          <p className='mt-2 text-sm text-tekst-drugorzedny'>
            albo kliknij, aby wybrac plik z dysku
          </p>
          <p className='mt-4 inline-flex items-center gap-2 rounded-full border border-obramowanie bg-tlo-karta px-3 py-1.5 text-xs text-tekst-drugorzedny'>
            <FileSpreadsheet className='h-3.5 w-3.5' />
            Obslugiwane formaty: .csv, .xlsx, .xls
          </p>
        </label>

        <input
          id={inputId}
          type='file'
          accept='.csv,.xlsx,.xls'
          onChange={(event) => {
            void obsluzWyborPliku(event);
          }}
          className='hidden'
        />

        {ladowanie ? (
          <div className='rounded-2xl border border-obramowanie bg-tlo-glowne px-4 py-8 text-center text-sm text-tekst-drugorzedny'>
            Trwa odczytywanie pliku...
          </div>
        ) : null}

        {bladPliku ? (
          <div className='flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
            <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
            <span>{bladPliku}</span>
          </div>
        ) : null}

        {komunikat ? (
          <div className='flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200'>
            <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0' />
            <span>
              {komunikat.dodano} dodano / {komunikat.bledow} bledow
            </span>
          </div>
        ) : null}
      </div>

      {naglowkiPliku.length > 0 ? (
        <>
          <section className='space-y-4'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
              <div>
                <h3 className='text-lg font-semibold text-tekst-glowny'>Mapowanie kolumn</h3>
                <p className='text-sm text-tekst-drugorzedny'>
                  Przypisz kolumny z pliku do pol systemowych przed importem.
                </p>
              </div>
              <div className='text-sm text-tekst-drugorzedny'>
                Wierszy w pliku: <span className='font-semibold text-tekst-glowny'>{wierszePliku.length}</span>
              </div>
            </div>

            {brakujaceWymaganeKlucze.length > 0 ? (
              <div className='rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
                Brakuje mapowania dla wymaganych pol:{' '}
                {kolumnyDocelowe
                  .filter((kolumna) => brakujaceWymaganeKlucze.includes(kolumna.klucz))
                  .map((kolumna) => kolumna.etykieta)
                  .join(', ')}
              </div>
            ) : null}

            {zduplikowaneKlucze.size > 0 ? (
              <div className='rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
                Jedno pole systemowe moze byc przypisane tylko raz.
              </div>
            ) : null}

            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {wymaganeKolumny.map((kolumna) => {
                const czyBrakuje = brakujaceWymaganeKlucze.includes(kolumna.klucz);

                return (
                  <div
                    key={kolumna.klucz}
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      czyBrakuje
                        ? 'border-red-500/50 bg-red-500/10 text-red-200'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    }`}
                  >
                    <div className='text-xs uppercase tracking-[0.18em] opacity-80'>
                      Pole wymagane
                    </div>
                    <div className='mt-1 font-medium'>{kolumna.etykieta}</div>
                  </div>
                );
              })}
            </div>

            <div className='grid gap-4 lg:grid-cols-2'>
              {naglowkiPliku.map((naglowek) => {
                const wybranyKlucz = mapowanieKolumn[naglowek] ?? '';
                const czyBledne =
                  (!wybranyKlucz &&
                    wymaganeKolumny.some(
                      (kolumna) =>
                        kolumna.etykieta.toLowerCase() === naglowek.toLowerCase() ||
                        kolumna.klucz.toLowerCase() === naglowek.toLowerCase()
                    )) ||
                  zduplikowaneKlucze.has(wybranyKlucz);

                return (
                  <div
                    key={naglowek}
                    className={`rounded-2xl border p-4 ${
                      czyBledne
                        ? 'border-red-500/50 bg-red-500/10'
                        : 'border-obramowanie bg-tlo-glowne'
                    }`}
                  >
                    <div className='mb-2 text-xs uppercase tracking-[0.18em] text-tekst-drugorzedny'>
                      Kolumna pliku
                    </div>
                    <div className='mb-4 text-sm font-medium text-tekst-glowny'>{naglowek}</div>

                    <label className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>
                      Pole systemowe
                    </label>
                    <select
                      value={wybranyKlucz}
                      onChange={(event) =>
                        ustawMapowanieKolumn((poprzednie) => ({
                          ...poprzednie,
                          [naglowek]: event.target.value,
                        }))
                      }
                      className={`${KLASY_SELECTA} ${
                        czyBledne ? 'border-red-500 focus:border-red-500' : ''
                      }`}
                    >
                      <option value=''>Pomin te kolumne</option>
                      {opcjeKolumn.map((opcja) => (
                        <option key={String(opcja.wartosc)} value={opcja.wartosc}>
                          {opcja.etykieta}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>

          <section className='space-y-4'>
            <div>
              <h3 className='text-lg font-semibold text-tekst-glowny'>Podglad danych</h3>
              <p className='text-sm text-tekst-drugorzedny'>
                Pokazujemy pierwsze 10 wierszy z wybranego pliku.
              </p>
            </div>

            <div className='overflow-x-auto rounded-2xl border border-obramowanie bg-tlo-glowne'>
              <table className='min-w-full border-collapse text-left text-sm text-tekst-glowny'>
                <thead className='bg-tlo-naglowek'>
                  <tr>
                    {naglowkiPliku.map((naglowek) => {
                      const czyWymaganaKolumnaBezMapowania =
                        !mapowanieKolumn[naglowek] &&
                        wymaganeKolumny.some(
                          (kolumna) =>
                            kolumna.etykieta.toLowerCase() === naglowek.toLowerCase() ||
                            kolumna.klucz.toLowerCase() === naglowek.toLowerCase()
                        );

                      return (
                        <th
                          key={naglowek}
                          className={`border border-obramowanie px-4 py-3 font-medium ${
                            czyWymaganaKolumnaBezMapowania
                              ? 'text-red-300'
                              : 'text-tekst-drugorzedny'
                          }`}
                        >
                          {naglowek}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {podgladWierszy.map((wiersz, indeks) => (
                    <tr
                      key={`${indeks}-${Object.values(wiersz).join('|')}`}
                      className={indeks % 2 === 0 ? 'bg-tlo-glowne' : 'bg-tlo-karta/30'}
                    >
                      {naglowkiPliku.map((naglowek) => {
                        const wybranyKlucz = mapowanieKolumn[naglowek];
                        const czyPoleWymagane = wymaganeKolumny.some(
                          (kolumna) => kolumna.klucz === wybranyKlucz
                        );
                        const czyBrakWartosci =
                          czyPoleWymagane && czyPustaWartosc(wiersz[naglowek]);

                        return (
                          <td
                            key={`${indeks}-${naglowek}`}
                            className={`border border-obramowanie px-4 py-3 ${
                              czyBrakWartosci ? 'bg-red-500/10 text-red-200' : ''
                            }`}
                          >
                            {czyPustaWartosc(wiersz[naglowek])
                              ? '-'
                              : String(wiersz[naglowek])}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className='flex flex-col gap-3 border-t border-obramowanie pt-4 sm:flex-row sm:items-center sm:justify-between'>
            <p className='text-sm text-tekst-drugorzedny'>
              Pola oznaczone gwiazdka sa wymagane. Wiersze bez wymaganych wartosci zostana
              policzone jako bledy.
            </p>
            <Przycisk
              type='button'
              onClick={obsluzImport}
              disabled={!czyMapowaniePoprawne || ladowanie || wierszePliku.length === 0}
            >
              IMPORTUJ
            </Przycisk>
          </div>
        </>
      ) : null}
    </section>
  );
}
