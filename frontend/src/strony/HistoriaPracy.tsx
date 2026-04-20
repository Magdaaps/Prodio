import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Download, Factory, FileDown, Plus, Search, ShieldAlert } from 'lucide-react';
import * as XLSX from 'xlsx';
import klientApi from '../api/klient';
import OdznakaStatusu from '../komponenty/OdznakaStatusu';
import TabelaDanych from '../komponenty/TabelaDanych';
import Modal from '../komponenty/ui/Modal';
import Pole from '../komponenty/ui/Pole';
import Przycisk from '../komponenty/ui/Przycisk';
import Przelacznik from '../komponenty/ui/Przelacznik';
import Rozwijane from '../komponenty/ui/Rozwijane';
import { useTabelaDanych } from '../hooki/useTabelaDanych';
import type { KolumnaTabeliDanych } from '../typy/indeks';

type OpcjaPodstawowa = { id: number; nazwa: string };
type PracownikOpcja = { id: number; imie: string; nazwisko: string; aktywny?: boolean };
type ZlecenieOpcja = { id: number; numer: string; idProdio: string; zewnetrznyNumer: string | null };

type WierszHistoriiPracy = {
  id: number;
  numerZlecenia: string;
  zewnetrznyNumerZamowienia: string | null;
  idProdio: string;
  klient: { id: number; nazwa: string } | null;
  grupaProduktow: { id: number; nazwa: string } | null;
  produkt: { id: number; nazwa: string } | null;
  panelMeldunkowy: { id: number; nazwa: string } | null;
  maszynaOperacja: { id: number; nazwa: string };
  pracownik: { id: number; imie: string; nazwisko: string; aktywny: boolean } | null;
  iloscPlan: number;
  iloscWykonana: number;
  czasSekundy: number;
  czasBezPauzSekundy: number;
  pauzaSekundy: number;
  pauzaMinuty: number;
  powodyPrzerw: string[];
  normatywnyCzasSekundy: number;
  wydajnoscProcent: number;
  wydajnoscTekst: string;
  start: string;
  stop: string | null;
  typOperacji: string;
  tagi: string[];
  kosztMaszynyPln: number;
  kosztPracownikaPln: number;
  maBraki: boolean;
  braki: number;
  opisBrakow: string | null;
  operacjaKoncowa: boolean;
  produkcjaNaMagazyn: boolean;
  geolokalizacjaStart: string | null;
  geolokalizacjaStop: string | null;
  dodaneRecznie: boolean;
  utworzyl: string | null;
  statusZlecenia: 'STOP' | 'W_TOKU' | 'PAUZA' | 'GOTOWE' | 'ANULOWANE';
  zlecenieId: number;
  zamowienieId: number;
  klientId: number | null;
  produktId: number | null;
  grupaProduktowId: number | null;
  pracownikId: number | null;
  formatowanyCzas: string;
  formatowanyCzasBezPauz: string;
  formatowanaPauza: string;
  formatowanyNormatywnyCzas: string;
};

type OdpowiedzHistoriiPracy = { dane: WierszHistoriiPracy[]; total: number; strona: number; limit: number };
type RaportDziennyWiersz = {
  pracownikId: number;
  pracownik: string;
  sumaCzasuSekundy: number;
  sumaCzasu: string;
  ilosc: number;
  wydajnoscSrednia: number;
  liczbaBrakow: number;
};
type OdpowiedzRaportuDziennego = { data: string; dane: RaportDziennyWiersz[] };

type FormularzManualny = {
  zlecenieId: string;
  pracownikId: string;
  iloscWykonana: string;
  iloscBrakow: string;
  opisBrakow: string;
  czasStart: string;
  czasStop: string;
};

type FiltryHistoriiPracy = {
  pracownikId: string;
  maszynaId: string;
  klientId: string;
  produktId: string;
  zlecenieId: string;
  grupaProduktowId: string;
  dataOd: string;
  dataDo: string;
};

type DefinicjaKolumny = {
  key: string;
  label: string;
  width: number;
  sticky?: boolean;
  left?: number;
};

const domyslnyFormularzManualny: FormularzManualny = {
  zlecenieId: '',
  pracownikId: '',
  iloscWykonana: '',
  iloscBrakow: '0',
  opisBrakow: '',
  czasStart: '',
  czasStop: '',
};

const domyslneFiltry: FiltryHistoriiPracy = {
  pracownikId: '',
  maszynaId: '',
  klientId: '',
  produktId: '',
  zlecenieId: '',
  grupaProduktowId: '',
  dataOd: '',
  dataDo: '',
};

function formatujDateTime(wartosc: string | null) {
  if (!wartosc) return '-';
  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) return '-';
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'medium' }).format(data);
}

function formatujLiczbe(wartosc: number, miejsca = 2) {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: miejsca,
    maximumFractionDigits: miejsca,
  }).format(wartosc);
}

function naDateInput(data: Date) {
  return data.toISOString().slice(0, 10);
}

function naDateTimeLocal(data: Date) {
  const przesuniecie = data.getTimezoneOffset() * 60000;
  return new Date(data.getTime() - przesuniecie).toISOString().slice(0, 16);
}

function pobierzDatePliku() {
  const data = new Date();
  const rok = data.getFullYear();
  const miesiac = String(data.getMonth() + 1).padStart(2, '0');
  const dzien = String(data.getDate()).padStart(2, '0');

  return `${rok}-${miesiac}-${dzien}`;
}

function pobierzNazwaPracownika(pracownik: WierszHistoriiPracy['pracownik']) {
  if (!pracownik) return '-';
  return `${pracownik.imie} ${pracownik.nazwisko}`;
}

function ikonaBool(wartosc: boolean) {
  return wartosc ? '✓' : '✗';
}

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

  if (blad instanceof Error) {
    return blad.message;
  }

  return domyslnyKomunikat;
}

function StickyCell({
  children,
  left,
  width,
  isHeader = false,
  className = '',
}: {
  children: React.ReactNode;
  left: number;
  width: number;
  isHeader?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`sticky border-r border-obramowanie ${isHeader ? 'z-30 bg-slate-900' : 'z-20'} ${className}`}
      style={{ left, minWidth: width, width }}
    >
      {children}
    </div>
  );
}

export default function HistoriaPracy() {
  const { strona, iloscNaStrone, onZmianaStrony } = useTabelaDanych(50);
  const [wiersze, ustawWiersze] = useState<WierszHistoriiPracy[]>([]);
  const [lacznie, ustawLacznie] = useState(0);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [blad, ustawBlad] = useState('');
  const [filtry, ustawFiltry] = useState<FiltryHistoriiPracy>(domyslneFiltry);
  const [szukajZlecenia, ustawSzukajZlecenia] = useState('');
  const [szukajPracownika, ustawSzukajPracownika] = useState('');
  const [tylkoZBrakami, ustawTylkoZBrakami] = useState(false);
  const [tylkoOtwarte, ustawTylkoOtwarte] = useState(false);
  const [ukryjNieaktywnych, ustawUkryjNieaktywnych] = useState(true);
  const [czyModalManualny, setCzyModalManualny] = useState(false);
  const [czyModalRaportuDziennego, setCzyModalRaportuDziennego] = useState(false);
  const [czyModalAnalizySurowcow, setCzyModalAnalizySurowcow] = useState(false);
  const [czyModalAnalizyBrakow, setCzyModalAnalizyBrakow] = useState(false);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [formularzManualny, ustawFormularzManualny] = useState<FormularzManualny>(domyslnyFormularzManualny);
  const [dataRaportu, setDataRaportu] = useState(naDateInput(new Date()));
  const [raportDzienny, ustawRaportDzienny] = useState<RaportDziennyWiersz[]>([]);
  const [ladowanieRaportu, ustawLadowanieRaportu] = useState(false);
  const [klienci, ustawKlientow] = useState<OpcjaPodstawowa[]>([]);
  const [grupyProduktow, ustawGrupyProduktow] = useState<OpcjaPodstawowa[]>([]);
  const [produkty, ustawProdukty] = useState<OpcjaPodstawowa[]>([]);
  const [maszyny, ustawMaszyny] = useState<OpcjaPodstawowa[]>([]);
  const [pracownicy, ustawPracownikow] = useState<PracownikOpcja[]>([]);
  const [zlecenia, ustawZlecenia] = useState<ZlecenieOpcja[]>([]);

  const odroczoneSzukajZlecenia = useDeferredValue(szukajZlecenia.trim().toLowerCase());
  const odroczoneSzukajPracownika = useDeferredValue(szukajPracownika.trim().toLowerCase());

  useEffect(() => {
    let anulowano = false;

    async function pobierzDanePomocnicze() {
      try {
        const [klienciRes, grupyRes, produktyRes, maszynyRes, pracownicyRes, zleceniaRes] = await Promise.all([
          klientApi.get<{ dane: OpcjaPodstawowa[] }>('/klienci'),
          klientApi.get<{ dane: OpcjaPodstawowa[] }>('/grupy-produktow'),
          klientApi.get<{ dane: OpcjaPodstawowa[] }>('/produkty', {
            params: { strona: 1, iloscNaStrone: 200, sortPole: 'nazwa', sortKierunek: 'asc' },
          }),
          klientApi.get<{ dane: OpcjaPodstawowa[] }>('/maszyny', {
            params: { strona: 1, iloscNaStrone: 200, sortPole: 'nazwa', sortKierunek: 'asc' },
          }),
          klientApi.get<{ dane: PracownikOpcja[] }>('/pracownicy', {
            params: { strona: 1, iloscNaStrone: 200, sortPole: 'nazwisko', sortKierunek: 'asc' },
          }),
          klientApi.get<{ dane: ZlecenieOpcja[] }>('/zlecenia-produkcyjne', {
            params: {
              strona: 1,
              iloscNaStrone: 200,
              sortPole: 'utworzonyW',
              sortKierunek: 'desc',
              pokazNieaktywne: true,
              ukryjGotowe: false,
            },
          }),
        ]);

        if (anulowano) {
          return;
        }

        ustawKlientow(klienciRes.data.dane ?? []);
        ustawGrupyProduktow(grupyRes.data.dane ?? []);
        ustawProdukty(produktyRes.data.dane ?? []);
        ustawMaszyny(maszynyRes.data.dane ?? []);
        ustawPracownikow(pracownicyRes.data.dane ?? []);
        ustawZlecenia(zleceniaRes.data.dane ?? []);
      } catch {
        if (!anulowano) {
          ustawKlientow([]);
          ustawGrupyProduktow([]);
          ustawProdukty([]);
          ustawMaszyny([]);
          ustawPracownikow([]);
          ustawZlecenia([]);
        }
      }
    }

    void pobierzDanePomocnicze();

    return () => {
      anulowano = true;
    };
  }, []);

  useEffect(() => {
    let anulowano = false;

    async function pobierzHistorie() {
      ustawLadowanie(true);
      ustawBlad('');

      try {
        const odpowiedz = await klientApi.get<OdpowiedzHistoriiPracy>('/historia-pracy', {
          params: {
            page: strona,
            limit: iloscNaStrone,
            pracownikId: filtry.pracownikId || undefined,
            maszynaId: filtry.maszynaId || undefined,
            klientId: filtry.klientId || undefined,
            produktId: filtry.produktId || undefined,
            zlecenieId: filtry.zlecenieId || undefined,
            dataOd: filtry.dataOd || undefined,
            dataDo: filtry.dataDo || undefined,
            tylkoZBrakami,
            tylkoOtwarte,
            ukryjNieaktywnych,
          },
        });

        if (anulowano) {
          return;
        }

        ustawWiersze(odpowiedz.data.dane);
        ustawLacznie(odpowiedz.data.total);
      } catch (nowyBlad) {
        if (anulowano) {
          return;
        }

        ustawBlad(pobierzKomunikatBledu(nowyBlad, 'Nie udalo sie pobrac historii pracy.'));
        ustawWiersze([]);
        ustawLacznie(0);
      } finally {
        if (!anulowano) {
          ustawLadowanie(false);
        }
      }
    }

    void pobierzHistorie();

    return () => {
      anulowano = true;
    };
  }, [strona, iloscNaStrone, filtry, tylkoZBrakami, tylkoOtwarte, ukryjNieaktywnych]);

  const przefiltrowaneWiersze = useMemo(() => {
    return wiersze.filter((wiersz) => {
      const zgodneZlecenie =
        !odroczoneSzukajZlecenia ||
        wiersz.numerZlecenia.toLowerCase().includes(odroczoneSzukajZlecenia) ||
        (wiersz.zewnetrznyNumerZamowienia ?? '').toLowerCase().includes(odroczoneSzukajZlecenia);

      const zgodnyPracownik =
        !odroczoneSzukajPracownika ||
        pobierzNazwaPracownika(wiersz.pracownik).toLowerCase().includes(odroczoneSzukajPracownika);

      const zgodnaGrupa = !filtry.grupaProduktowId || String(wiersz.grupaProduktowId ?? '') === filtry.grupaProduktowId;

      return zgodneZlecenie && zgodnyPracownik && zgodnaGrupa;
    });
  }, [filtry.grupaProduktowId, odroczoneSzukajPracownika, odroczoneSzukajZlecenia, wiersze]);

  const analizaSurowcow = useMemo(() => {
    const agregaty = new Map<
      string,
      { klucz: string; klient: string; grupa: string; produkt: string; plan: number; wykonanie: number; roznica: number; wydajnosc: number }
    >();

    for (const wiersz of przefiltrowaneWiersze) {
      const klucz = `${wiersz.klient?.nazwa ?? 'Brak klienta'}::${wiersz.grupaProduktow?.nazwa ?? 'Bez grupy'}::${wiersz.produkt?.nazwa ?? 'Brak produktu'}`;
      const poprzedni = agregaty.get(klucz) ?? {
        klucz,
        klient: wiersz.klient?.nazwa ?? 'Brak klienta',
        grupa: wiersz.grupaProduktow?.nazwa ?? 'Bez grupy',
        produkt: wiersz.produkt?.nazwa ?? 'Brak produktu',
        plan: 0,
        wykonanie: 0,
        roznica: 0,
        wydajnosc: 0,
      };

      poprzedni.plan += wiersz.iloscPlan;
      poprzedni.wykonanie += wiersz.iloscWykonana;
      poprzedni.roznica = poprzedni.wykonanie - poprzedni.plan;
      poprzedni.wydajnosc = poprzedni.plan > 0 ? Number(((poprzedni.wykonanie / poprzedni.plan) * 100).toFixed(2)) : 0;
      agregaty.set(klucz, poprzedni);
    }

    return Array.from(agregaty.values()).sort((a, b) => b.wykonanie - a.wykonanie);
  }, [przefiltrowaneWiersze]);

  const analizaBrakow = useMemo(() => {
    return przefiltrowaneWiersze
      .filter((wiersz) => wiersz.braki > 0)
      .map((wiersz) => ({
        id: wiersz.id,
        numerZlecenia: wiersz.numerZlecenia,
        produkt: wiersz.produkt?.nazwa ?? '-',
        pracownik: pobierzNazwaPracownika(wiersz.pracownik),
        braki: wiersz.braki,
        iloscWykonana: wiersz.iloscWykonana,
        brakowosc: wiersz.iloscWykonana > 0 ? (wiersz.braki / wiersz.iloscWykonana) * 100 : 0,
        opisBrakow: wiersz.opisBrakow ?? '-',
      }))
      .sort((a, b) => b.brakowosc - a.brakowosc);
  }, [przefiltrowaneWiersze]);

  const tabelaAnalizySurowcow = useMemo<KolumnaTabeliDanych<(typeof analizaSurowcow)[number]>[]>(
    () => [
      { klucz: 'klient', naglowek: 'Klient' },
      { klucz: 'grupa', naglowek: 'Grupa produktów' },
      { klucz: 'produkt', naglowek: 'Produkt' },
      { klucz: 'plan', naglowek: 'Plan', renderuj: (wiersz) => formatujLiczbe(wiersz.plan, 0) },
      { klucz: 'wykonanie', naglowek: 'Wykonanie', renderuj: (wiersz) => formatujLiczbe(wiersz.wykonanie, 0) },
      {
        klucz: 'roznica',
        naglowek: 'Odchylenie',
        renderuj: (wiersz) => (
          <span className={wiersz.roznica >= 0 ? 'text-emerald-400' : 'text-red-300'}>{formatujLiczbe(wiersz.roznica, 0)}</span>
        ),
      },
      { klucz: 'wydajnosc', naglowek: 'Wydajność', renderuj: (wiersz) => `${formatujLiczbe(wiersz.wydajnosc)}%` },
    ],
    [analizaSurowcow]
  );

  const pobierzRaportDzienny = async () => {
    ustawLadowanieRaportu(true);

    try {
      const odpowiedz = await klientApi.get<OdpowiedzRaportuDziennego>('/historia-pracy/raport-dzienny', {
        params: { data: dataRaportu },
      });
      ustawRaportDzienny(odpowiedz.data.dane);
    } catch (nowyBlad) {
      ustawBlad(pobierzKomunikatBledu(nowyBlad, 'Nie udalo sie pobrac raportu dziennego.'));
      ustawRaportDzienny([]);
    } finally {
      ustawLadowanieRaportu(false);
    }
  };

  useEffect(() => {
    if (czyModalRaportuDziennego) {
      void pobierzRaportDzienny();
    }
  }, [czyModalRaportuDziennego, dataRaportu]);

  const eksportujRaportDoPdf = () => {
    const okno = window.open('', '_blank', 'width=1100,height=800');
    if (!okno) return;

    const wierszeHtml = raportDzienny
      .map(
        (wiersz) => `
          <tr>
            <td>${wiersz.pracownik}</td>
            <td>${wiersz.ilosc}</td>
            <td>${formatujLiczbe(wiersz.wydajnoscSrednia)}%</td>
            <td>${wiersz.sumaCzasu}</td>
            <td>${wiersz.liczbaBrakow}</td>
          </tr>
        `
      )
      .join('');

    okno.document.write(`
      <html><head><title>Raport dzienny ${dataRaportu}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
        th { background: #e2e8f0; }
      </style></head><body>
      <h1>Dzienny raport historii pracy</h1>
      <p>Data: ${dataRaportu}</p>
      <table>
        <thead><tr><th>Pracownik</th><th>Ilość</th><th>Średnia wydajność</th><th>Suma czasu</th><th>Braki</th></tr></thead>
        <tbody>${wierszeHtml}</tbody>
      </table></body></html>
    `);
    okno.document.close();
    okno.focus();
    okno.print();
  };

  const eksportujHistoriePracy = () => {
    const dane = przefiltrowaneWiersze.map((wiersz) => ({
      'Nr zlecenia': wiersz.numerZlecenia,
      Pracownik: pobierzNazwaPracownika(wiersz.pracownik),
      Maszyna: wiersz.maszynaOperacja.nazwa,
      'Ilość': wiersz.iloscWykonana,
      Czas: wiersz.formatowanyCzas,
      'Wydajność%': wiersz.wydajnoscProcent,
      Start: formatujDateTime(wiersz.start),
      Stop: formatujDateTime(wiersz.stop),
    }));

    const skoroszyt = XLSX.utils.book_new();
    const arkusz = XLSX.utils.json_to_sheet(dane);

    XLSX.utils.book_append_sheet(skoroszyt, arkusz, 'Historia pracy');
    XLSX.writeFile(skoroszyt, `historia_pracy_${pobierzDatePliku()}.xlsx`);
  };

  const opcjeKlientow = klienci.map((klient) => ({ wartosc: String(klient.id), etykieta: klient.nazwa }));
  const opcjeGrup = grupyProduktow.map((grupa) => ({ wartosc: String(grupa.id), etykieta: grupa.nazwa }));
  const opcjeProduktow = produkty.map((produkt) => ({ wartosc: String(produkt.id), etykieta: produkt.nazwa }));
  const opcjeMaszyn = maszyny.map((maszyna) => ({ wartosc: String(maszyna.id), etykieta: maszyna.nazwa }));
  const opcjePracownikow = pracownicy.map((pracownik) => ({
    wartosc: String(pracownik.id),
    etykieta: `${pracownik.imie} ${pracownik.nazwisko}`,
  }));
  const opcjeZlecen = zlecenia.map((zlecenie) => ({
    wartosc: String(zlecenie.id),
    etykieta: `${zlecenie.numer} / ${zlecenie.idProdio}${zlecenie.zewnetrznyNumer ? ` / ${zlecenie.zewnetrznyNumer}` : ''}`,
  }));

  const kolumny: DefinicjaKolumny[] = [
    { key: 'nrZlecenia', label: 'Nr zlecenia', width: 220, sticky: true, left: 0 },
    { key: 'zewNumer', label: 'Zew.nr zamówienia', width: 220, sticky: true, left: 220 },
    { key: 'idProdio', label: 'ID Prodio', width: 140 },
    { key: 'klient', label: 'Klient', width: 180 },
    { key: 'grupa', label: 'Grupa produktów', width: 180 },
    { key: 'produkt', label: 'Produkt', width: 180 },
    { key: 'panel', label: 'Panel meldunkowy', width: 170 },
    { key: 'maszyna', label: 'Maszyna/Operacja', width: 190 },
    { key: 'pracownik', label: 'Pracownik', width: 180 },
    { key: 'ilosc', label: 'Ilość', width: 140 },
    { key: 'czas', label: 'Czas', width: 130 },
    { key: 'czasBezPauz', label: 'Czas bez pauz', width: 130 },
    { key: 'pauza', label: 'Pauza', width: 120 },
    { key: 'powodyPrzerw', label: 'Powody przerw', width: 200 },
    { key: 'norma', label: 'Normatywny czas', width: 150 },
    { key: 'wydajnosc', label: 'Wydajność', width: 160 },
    { key: 'start', label: 'Start', width: 190 },
    { key: 'stop', label: 'Stop', width: 190 },
    { key: 'typOperacji', label: 'Typ operacji', width: 140 },
    { key: 'tagi', label: 'Tagi', width: 180 },
    { key: 'kosztMaszyny', label: 'Koszt maszyny (PLN)', width: 160 },
    { key: 'kosztPracownika', label: 'Koszt pracownika (PLN)', width: 170 },
    { key: 'maBraki', label: 'Ma braki', width: 110 },
    { key: 'braki', label: 'Braki', width: 90 },
    { key: 'opisBrakow', label: 'Opis braków', width: 220 },
    { key: 'operacjaKoncowa', label: 'Operacja końcowa', width: 130 },
    { key: 'produkcjaNaMagazyn', label: 'Produkcja na magazyn', width: 160 },
    { key: 'geoStart', label: 'Geolokalizacja start', width: 180 },
    { key: 'geoStop', label: 'Geolokalizacja stop', width: 180 },
    { key: 'dodaneRecznie', label: 'Dodane ręcznie', width: 130 },
    { key: 'utworzyl', label: 'Utworzył(a)', width: 180 },
  ] as const;

  const otworzModalManualny = () => {
    const teraz = new Date();
    const godzineTemu = new Date(teraz.getTime() - 60 * 60 * 1000);
    ustawFormularzManualny({
      ...domyslnyFormularzManualny,
      czasStart: naDateTimeLocal(godzineTemu),
      czasStop: naDateTimeLocal(teraz),
    });
    setCzyModalManualny(true);
  };

  const zapiszManualnie = async () => {
    ustawZapisywanie(true);
    ustawBlad('');

    try {
      await klientApi.post('/historia-pracy', {
        zlecenieId: formularzManualny.zlecenieId,
        pracownikId: formularzManualny.pracownikId || null,
        iloscWykonana: formularzManualny.iloscWykonana,
        iloscBrakow: formularzManualny.iloscBrakow,
        opisBrakow: formularzManualny.opisBrakow,
        czasStart: formularzManualny.czasStart,
        czasStop: formularzManualny.czasStop || null,
      });

      setCzyModalManualny(false);
      ustawFormularzManualny(domyslnyFormularzManualny);
      onZmianaStrony(1);
    } catch (nowyBlad) {
      ustawBlad(pobierzKomunikatBledu(nowyBlad, 'Nie udalo sie dodac manualnego wpisu.'));
    } finally {
      ustawZapisywanie(false);
    }
  };

  return (
    <div className='space-y-6 text-tekst-glowny'>
      <section className='rounded-3xl border border-obramowanie bg-tlo-karta p-6 shadow-xl shadow-black/10'>
        <div className='flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.3em] text-akcent'>Sprint 7</p>
            <h1 className='mt-2 text-3xl font-semibold'>Historia pracy</h1>
            <p className='mt-2 max-w-3xl text-sm text-tekst-drugorzedny'>
              Chronologiczny przegląd wydajności, kosztów, braków i aktywności operatorów dla zleceń produkcyjnych.
            </p>
          </div>

          <div className='flex flex-wrap gap-3'>
            <Przycisk wariant='drugorzedny' onClick={() => setCzyModalRaportuDziennego(true)}>
              <BarChart3 size={16} />
              DZIENNY RAPORT
            </Przycisk>
            <Przycisk wariant='drugorzedny' onClick={() => setCzyModalAnalizySurowcow(true)}>
              <Factory size={16} />
              ANALIZA ZUŻYCIA SUROWCÓW
            </Przycisk>
            <Przycisk wariant='drugorzedny' onClick={() => setCzyModalAnalizyBrakow(true)}>
              <ShieldAlert size={16} />
              ANALIZA BRAKÓW
            </Przycisk>
            <Przycisk onClick={otworzModalManualny}>
              <Plus size={16} />
              Dodaj manualnie
            </Przycisk>
          </div>
        </div>
      </section>

      <section className='rounded-3xl border border-obramowanie bg-tlo-karta p-6 shadow-xl shadow-black/10'>
        <div className='grid gap-4 xl:grid-cols-[1.2fr_1.2fr_1fr_1fr]'>
          <Pole
            etykieta='Nr zlecenia / zewnętrzny numer'
            value={szukajZlecenia}
            onChange={(event) => {
              ustawSzukajZlecenia(event.target.value);
              onZmianaStrony(1);
            }}
            placeholder='Szukaj po numerach'
            ikonaPrefix={<Search size={16} />}
          />
          <Pole
            etykieta='Pracownik'
            value={szukajPracownika}
            onChange={(event) => {
              ustawSzukajPracownika(event.target.value);
              onZmianaStrony(1);
            }}
            placeholder='Szukaj po pracowniku'
            ikonaPrefix={<Search size={16} />}
          />
          <Rozwijane
            etykieta='Klient'
            opcje={opcjeKlientow}
            wartosc={filtry.klientId}
            onZmiana={(wartosc) => {
              ustawFiltry((poprzednie) => ({ ...poprzednie, klientId: String(wartosc) }));
              onZmianaStrony(1);
            }}
            placeholder='Wszyscy klienci'
          />
          <Rozwijane
            etykieta='Grupa produktów'
            opcje={opcjeGrup}
            wartosc={filtry.grupaProduktowId}
            onZmiana={(wartosc) => {
              ustawFiltry((poprzednie) => ({ ...poprzednie, grupaProduktowId: String(wartosc) }));
              onZmianaStrony(1);
            }}
            placeholder='Wszystkie grupy'
          />
          <Rozwijane
            etykieta='Produkt'
            opcje={opcjeProduktow}
            wartosc={filtry.produktId}
            onZmiana={(wartosc) => {
              ustawFiltry((poprzednie) => ({ ...poprzednie, produktId: String(wartosc) }));
              onZmianaStrony(1);
            }}
            placeholder='Wszystkie produkty'
          />
          <Rozwijane
            etykieta='Maszyna'
            opcje={opcjeMaszyn}
            wartosc={filtry.maszynaId}
            onZmiana={(wartosc) => {
              ustawFiltry((poprzednie) => ({ ...poprzednie, maszynaId: String(wartosc) }));
              onZmianaStrony(1);
            }}
            placeholder='Wszystkie maszyny'
          />
          <Rozwijane
            etykieta='Pracownik'
            opcje={opcjePracownikow}
            wartosc={filtry.pracownikId}
            onZmiana={(wartosc) => {
              ustawFiltry((poprzednie) => ({ ...poprzednie, pracownikId: String(wartosc) }));
              onZmianaStrony(1);
            }}
            placeholder='Wszyscy pracownicy'
          />
          <Rozwijane
            etykieta='Zlecenie'
            opcje={opcjeZlecen}
            wartosc={filtry.zlecenieId}
            onZmiana={(wartosc) => {
              ustawFiltry((poprzednie) => ({ ...poprzednie, zlecenieId: String(wartosc) }));
              onZmianaStrony(1);
            }}
            placeholder='Wszystkie zlecenia'
          />
          <Pole
            etykieta='Data od'
            type='date'
            value={filtry.dataOd}
            onChange={(event) => {
              ustawFiltry((poprzednie) => ({ ...poprzednie, dataOd: event.target.value }));
              onZmianaStrony(1);
            }}
            ikonaPrefix={<CalendarDays size={16} />}
          />
          <Pole
            etykieta='Data do'
            type='date'
            value={filtry.dataDo}
            onChange={(event) => {
              ustawFiltry((poprzednie) => ({ ...poprzednie, dataDo: event.target.value }));
              onZmianaStrony(1);
            }}
            ikonaPrefix={<CalendarDays size={16} />}
          />
          <Przelacznik etykieta='Tylko z brakami' wartosc={tylkoZBrakami} onZmiana={(wartosc) => { ustawTylkoZBrakami(wartosc); onZmianaStrony(1); }} />
          <Przelacznik etykieta='Tylko otwarte' wartosc={tylkoOtwarte} onZmiana={(wartosc) => { ustawTylkoOtwarte(wartosc); onZmianaStrony(1); }} />
          <Przelacznik
            etykieta='Ukryj nieaktywnych pracowników'
            wartosc={ukryjNieaktywnych}
            onZmiana={(wartosc) => {
              ustawUkryjNieaktywnych(wartosc);
              onZmianaStrony(1);
            }}
          />
        </div>
      </section>

      {blad ? (
        <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div>
      ) : null}

      <section className='rounded-3xl border border-obramowanie bg-tlo-karta shadow-xl shadow-black/10'>
        <div className='flex items-center justify-between border-b border-obramowanie px-6 py-4'>
          <div>
            <h2 className='text-lg font-semibold'>Rejestr historii pracy</h2>
            <p className='text-sm text-tekst-drugorzedny'>
              Widocznych rekordów: {przefiltrowaneWiersze.length} z {lacznie}
            </p>
          </div>
          <div className='flex items-center gap-3'>
            <Przycisk type='button' wariant='drugorzedny' rozmiar='maly' onClick={eksportujHistoriePracy}>
              <Download size={16} />
              EKSPORT
            </Przycisk>
            <div className='rounded-full border border-obramowanie bg-tlo-glowne px-4 py-2 text-sm text-tekst-drugorzedny'>
              50 rekordów na stronę
            </div>
          </div>
        </div>

        <div className='overflow-x-auto'>
          <div className='min-w-max'>
            <div className='sticky top-0 z-30 flex border-b border-obramowanie bg-slate-900 text-sm font-medium text-slate-300'>
              {kolumny.map((kolumna) =>
                kolumna.sticky ? (
                  <StickyCell key={kolumna.key} left={kolumna.left ?? 0} width={kolumna.width} isHeader>
                    <div className='px-4 py-3'>{kolumna.label}</div>
                  </StickyCell>
                ) : (
                  <div key={kolumna.key} className='border-l border-obramowanie px-4 py-3' style={{ minWidth: kolumna.width, width: kolumna.width }}>
                    {kolumna.label}
                  </div>
                )
              )}
            </div>

            {ladowanie ? (
              Array.from({ length: 6 }, (_, indeks) => (
                <div key={indeks} className='flex border-b border-obramowanie bg-tlo-karta even:bg-tlo-glowne/70'>
                  {kolumny.map((kolumna) =>
                    kolumna.sticky ? (
                      <StickyCell key={kolumna.key} left={kolumna.left ?? 0} width={kolumna.width} className={indeks % 2 === 0 ? 'bg-tlo-karta' : 'bg-tlo-glowne/70'}>
                        <div className='px-4 py-4'><div className='h-4 animate-pulse rounded bg-obramowanie' /></div>
                      </StickyCell>
                    ) : (
                      <div key={kolumna.key} className='border-l border-obramowanie px-4 py-4' style={{ minWidth: kolumna.width, width: kolumna.width }}>
                        <div className='h-4 animate-pulse rounded bg-obramowanie' />
                      </div>
                    )
                  )}
                </div>
              ))
            ) : przefiltrowaneWiersze.length === 0 ? (
              <div className='px-6 py-16 text-center text-sm text-tekst-drugorzedny'>Brak danych dla wybranych filtrów.</div>
            ) : (
              przefiltrowaneWiersze.map((wiersz, indeks) => {
                const kolorWiersza = indeks % 2 === 0 ? 'bg-tlo-karta' : 'bg-tlo-glowne/70';
                const komorki: Record<string, React.ReactNode> = {
                  nrZlecenia: <div className='space-y-2'><a href='/zlecenia-produkcyjne' className='font-medium text-akcent hover:text-akcent-hover'>{wiersz.numerZlecenia}</a><div className='max-w-max'><OdznakaStatusu status={wiersz.statusZlecenia} typ='zlecenie' /></div></div>,
                  zewNumer: <a href='/zamowienia' className='font-medium text-akcent hover:text-akcent-hover'>{wiersz.zewnetrznyNumerZamowienia ?? '-'}</a>,
                  idProdio: wiersz.idProdio,
                  klient: wiersz.klient?.nazwa ?? '-',
                  grupa: wiersz.grupaProduktow?.nazwa ?? '-',
                  produkt: wiersz.produkt?.nazwa ?? '-',
                  panel: wiersz.panelMeldunkowy?.nazwa ?? '-',
                  maszyna: wiersz.maszynaOperacja.nazwa,
                  pracownik: <div><div>{pobierzNazwaPracownika(wiersz.pracownik)}</div>{wiersz.pracownik && !wiersz.pracownik.aktywny ? <div className='text-xs text-red-300'>Nieaktywny</div> : null}</div>,
                  ilosc: `${wiersz.iloscPlan} / ${wiersz.iloscWykonana}`,
                  czas: wiersz.formatowanyCzas,
                  czasBezPauz: wiersz.formatowanyCzasBezPauz,
                  pauza: wiersz.pauzaMinuty > 0 ? <span className='font-medium text-sky-400'>{wiersz.formatowanaPauza}</span> : wiersz.formatowanaPauza,
                  powodyPrzerw: wiersz.powodyPrzerw.length > 0 ? wiersz.powodyPrzerw.join(', ') : '-',
                  norma: wiersz.formatowanyNormatywnyCzas,
                  wydajnosc: <span className={wiersz.wydajnoscProcent >= 100 ? 'text-emerald-400' : 'text-red-300'}>{wiersz.wydajnoscTekst}</span>,
                  start: formatujDateTime(wiersz.start),
                  stop: formatujDateTime(wiersz.stop),
                  typOperacji: wiersz.typOperacji,
                  tagi: wiersz.tagi.length > 0 ? wiersz.tagi.join(', ') : '-',
                  kosztMaszyny: `${formatujLiczbe(wiersz.kosztMaszynyPln)} PLN`,
                  kosztPracownika: `${formatujLiczbe(wiersz.kosztPracownikaPln)} PLN`,
                  maBraki: ikonaBool(wiersz.maBraki),
                  braki: wiersz.braki,
                  opisBrakow: wiersz.opisBrakow ?? '-',
                  operacjaKoncowa: ikonaBool(wiersz.operacjaKoncowa),
                  produkcjaNaMagazyn: ikonaBool(wiersz.produkcjaNaMagazyn),
                  geoStart: wiersz.geolokalizacjaStart ?? '-',
                  geoStop: wiersz.geolokalizacjaStop ?? '-',
                  dodaneRecznie: ikonaBool(wiersz.dodaneRecznie),
                  utworzyl: wiersz.utworzyl ?? '-',
                };

                return (
                  <div key={wiersz.id} className={`flex border-b border-obramowanie ${kolorWiersza}`}>
                    {kolumny.map((kolumna) =>
                      kolumna.sticky ? (
                        <StickyCell key={kolumna.key} left={kolumna.left ?? 0} width={kolumna.width} className={kolorWiersza}>
                          <div className='px-4 py-4 text-sm text-tekst-glowny'>{komorki[kolumna.key]}</div>
                        </StickyCell>
                      ) : (
                        <div key={kolumna.key} className='border-l border-obramowanie px-4 py-4 text-sm text-tekst-glowny' style={{ minWidth: kolumna.width, width: kolumna.width }}>
                          {komorki[kolumna.key]}
                        </div>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className='flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm text-tekst-drugorzedny'>
          <span>Strona {strona} • rekordów: {lacznie}</span>
          <div className='flex items-center gap-2'>
            <Przycisk wariant='drugorzedny' rozmiar='maly' disabled={strona <= 1} onClick={() => onZmianaStrony(strona - 1)}>Poprzednia</Przycisk>
            <Przycisk wariant='drugorzedny' rozmiar='maly' disabled={strona * iloscNaStrone >= lacznie} onClick={() => onZmianaStrony(strona + 1)}>Następna</Przycisk>
          </div>
        </div>
      </section>

      <Modal czyOtwarty={czyModalManualny} onZamknij={() => !zapisywanie && setCzyModalManualny(false)} tytul='Dodaj manualny wpis historii pracy' rozmiar='duzy' akcje={<><Przycisk wariant='drugorzedny' onClick={() => setCzyModalManualny(false)} disabled={zapisywanie}>Anuluj</Przycisk><Przycisk onClick={() => void zapiszManualnie()} czyLaduje={zapisywanie}>Zapisz wpis</Przycisk></>}>
        <div className='grid gap-4 md:grid-cols-2'>
          <Rozwijane etykieta='Zlecenie' opcje={opcjeZlecen} wartosc={formularzManualny.zlecenieId} onZmiana={(wartosc) => ustawFormularzManualny((p) => ({ ...p, zlecenieId: String(wartosc) }))} placeholder='Wybierz zlecenie' />
          <Rozwijane etykieta='Pracownik' opcje={opcjePracownikow} wartosc={formularzManualny.pracownikId} onZmiana={(wartosc) => ustawFormularzManualny((p) => ({ ...p, pracownikId: String(wartosc) }))} placeholder='Wybierz pracownika' />
          <Pole etykieta='Ilość wykonana' type='number' min='0' value={formularzManualny.iloscWykonana} onChange={(event) => ustawFormularzManualny((p) => ({ ...p, iloscWykonana: event.target.value }))} />
          <Pole etykieta='Braki' type='number' min='0' value={formularzManualny.iloscBrakow} onChange={(event) => ustawFormularzManualny((p) => ({ ...p, iloscBrakow: event.target.value }))} />
          <Pole etykieta='Czas start' type='datetime-local' value={formularzManualny.czasStart} onChange={(event) => ustawFormularzManualny((p) => ({ ...p, czasStart: event.target.value }))} />
          <Pole etykieta='Czas stop' type='datetime-local' value={formularzManualny.czasStop} onChange={(event) => ustawFormularzManualny((p) => ({ ...p, czasStop: event.target.value }))} />
          <div className='md:col-span-2'>
            <label className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Opis braków</label>
            <textarea rows={4} value={formularzManualny.opisBrakow} onChange={(event) => ustawFormularzManualny((p) => ({ ...p, opisBrakow: event.target.value }))} className='w-full rounded-lg border border-obramowanie bg-tlo-glowne px-4 py-2.5 text-sm text-tekst-glowny outline-none transition-colors focus:border-akcent' placeholder='Opcjonalny opis braków lub uwag do wpisu' />
          </div>
        </div>
      </Modal>

      <Modal czyOtwarty={czyModalRaportuDziennego} onZamknij={() => setCzyModalRaportuDziennego(false)} tytul='Dzienny raport' rozmiar='duzy' akcje={<><Przycisk wariant='drugorzedny' onClick={() => void pobierzRaportDzienny()}>Odśwież</Przycisk><Przycisk onClick={eksportujRaportDoPdf}><FileDown size={16} />Eksport PDF</Przycisk></>}>
        <div className='space-y-5'>
          <div className='max-w-xs'><Pole etykieta='Data raportu' type='date' value={dataRaportu} onChange={(event) => setDataRaportu(event.target.value)} /></div>
          {ladowanieRaportu ? (
            <div className='rounded-2xl border border-obramowanie bg-tlo-glowne px-4 py-10 text-center text-tekst-drugorzedny'>Ładowanie raportu...</div>
          ) : raportDzienny.length === 0 ? (
            <div className='rounded-2xl border border-obramowanie bg-tlo-glowne px-4 py-10 text-center text-tekst-drugorzedny'>Brak danych dla wybranego dnia.</div>
          ) : (
            <div className='grid gap-4 md:grid-cols-2'>
              {raportDzienny.map((wiersz) => {
                const maksimum = Math.max(...raportDzienny.map((element) => Math.max(element.ilosc, element.wydajnoscSrednia)));
                const szerokoscIlosci = maksimum > 0 ? (wiersz.ilosc / maksimum) * 100 : 0;
                const szerokoscWydajnosci = maksimum > 0 ? (wiersz.wydajnoscSrednia / maksimum) * 100 : 0;
                return (
                  <article key={wiersz.pracownikId} className='rounded-2xl border border-obramowanie bg-tlo-glowne p-4'>
                    <div className='mb-3 flex items-center justify-between gap-3'><h3 className='font-medium'>{wiersz.pracownik}</h3><span className='text-sm text-tekst-drugorzedny'>{wiersz.sumaCzasu}</span></div>
                    <div className='space-y-3'>
                      <div><div className='mb-1 flex justify-between text-xs text-tekst-drugorzedny'><span>Ilość</span><span>{wiersz.ilosc}</span></div><div className='h-3 overflow-hidden rounded-full bg-slate-800'><div className='h-full rounded-full bg-akcent' style={{ width: `${szerokoscIlosci}%` }} /></div></div>
                      <div><div className='mb-1 flex justify-between text-xs text-tekst-drugorzedny'><span>Wydajność</span><span>{formatujLiczbe(wiersz.wydajnoscSrednia)}%</span></div><div className='h-3 overflow-hidden rounded-full bg-slate-800'><div className={`h-full rounded-full ${wiersz.wydajnoscSrednia >= 100 ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: `${Math.min(100, szerokoscWydajnosci)}%` }} /></div></div>
                      <div className='flex justify-between text-xs text-tekst-drugorzedny'><span>Braki: {wiersz.liczbaBrakow}</span><span>Przepracowano: {wiersz.sumaCzasu}</span></div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <Modal czyOtwarty={czyModalAnalizySurowcow} onZamknij={() => setCzyModalAnalizySurowcow(false)} tytul='Analiza zużycia surowców' rozmiar='duzy'>
        <TabelaDanych kolumny={tabelaAnalizySurowcow} dane={analizaSurowcow} stronaPaginacji={1} iloscNaStrone={analizaSurowcow.length || 1} lacznie={analizaSurowcow.length} />
      </Modal>

      <Modal czyOtwarty={czyModalAnalizyBrakow} onZamknij={() => setCzyModalAnalizyBrakow(false)} tytul='Analiza braków' rozmiar='duzy'>
        <div className='space-y-3'>
          {analizaBrakow.length === 0 ? (
            <div className='rounded-2xl border border-obramowanie bg-tlo-glowne px-4 py-10 text-center text-tekst-drugorzedny'>Brak wpisów z brakami dla aktywnych filtrów.</div>
          ) : (
            analizaBrakow.map((wiersz) => (
              <article key={wiersz.id} className='rounded-2xl border border-obramowanie bg-tlo-glowne p-4'>
                <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                  <div>
                    <h3 className='font-medium text-tekst-glowny'>{wiersz.numerZlecenia} • {wiersz.produkt}</h3>
                    <p className='mt-1 text-sm text-tekst-drugorzedny'>Pracownik: {wiersz.pracownik}</p>
                    <p className='mt-2 text-sm text-red-200'>Opis: {wiersz.opisBrakow}</p>
                  </div>
                  <div className='rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-right'>
                    <div className='text-xs uppercase tracking-[0.2em] text-red-200'>Brakowość</div>
                    <div className='mt-1 text-2xl font-semibold text-red-100'>{formatujLiczbe(wiersz.brakowosc)}%</div>
                    <div className='text-sm text-red-200'>{wiersz.braki} / {wiersz.iloscWykonana}</div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
