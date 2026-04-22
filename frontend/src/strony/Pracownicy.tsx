import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Barcode, Check, ImagePlus, Pencil, Plus, QrCode, Search, Trash2, Upload, X } from 'lucide-react';
import klientApi from '../api/klient';
import Pole from '../komponenty/ui/Pole';
import Przycisk from '../komponenty/ui/Przycisk';
import Przelacznik from '../komponenty/ui/Przelacznik';
import { useTabelaDanych } from '../hooki/useTabelaDanych';

interface Pracownik {
  id: number;
  imie: string;
  nazwisko: string;
  stanowisko: string | null;
  stawkaGodzinowa: number | string | null;
  pin: string | null;
  kodQr: string | null;
  telefon: string | null;
  dodatkoweInformacje: string | null;
  zdjecie: string | null;
  kolorAvatara: string | null;
  aktywny: boolean;
}

interface FormularzPracownika {
  imie: string;
  nazwisko: string;
  stanowisko: string;
  stawkaGodzinowa: string;
  pin: string;
  kodQr: string;
  telefon: string;
  dodatkoweInformacje: string;
  zdjecie: string;
  kolorAvatara: string;
  aktywny: boolean;
}

interface FiltryKolumn {
  nazwa: string;
  pin: string;
  kodQr: string;
  stanowisko: string;
  aktywny: 'wszyscy' | 'aktywni' | 'nieaktywni';
  stawka: string;
}

interface OdpowiedzListyPracownikow {
  sukces: boolean;
  dane: Pracownik[];
  lacznie: number;
  strona: number;
  iloscNaStrone: number;
  wiadomosc?: string;
}

const domyslnyFormularz: FormularzPracownika = {
  imie: '',
  nazwisko: '',
  stanowisko: '',
  stawkaGodzinowa: '',
  pin: '',
  kodQr: '',
  telefon: '',
  dodatkoweInformacje: '',
  zdjecie: '',
  kolorAvatara: '#2563eb',
  aktywny: true,
};

const domyslneFiltry: FiltryKolumn = {
  nazwa: '',
  pin: '',
  kodQr: '',
  stanowisko: '',
  aktywny: 'wszyscy',
  stawka: '',
};

const klasyInputaTabeli =
  'w-full min-w-[120px] rounded-xl border border-obramowanie bg-tlo-glowne px-3 py-2.5 text-sm text-tekst-glowny placeholder-tekst-drugorzedny transition-colors focus:border-akcent focus:outline-none';
const klasyPolaPanelu =
  'w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny placeholder-tekst-drugorzedny transition-colors focus:border-akcent focus:outline-none';
const klasyTextareaPanelu =
  'w-full rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-3 text-sm text-tekst-glowny placeholder-tekst-drugorzedny transition-colors focus:border-akcent focus:outline-none resize-y';

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

function pobierzInicjaly(pracownik: Pracownik) {
  const imie = typeof pracownik.imie === 'string' ? pracownik.imie : '';
  const nazwisko = typeof pracownik.nazwisko === 'string' ? pracownik.nazwisko : '';

  return `${imie.charAt(0)}${nazwisko.charAt(0)}`.toUpperCase() || '--';
}

function pobierzNazwePracownika(pracownik: Pracownik) {
  const imie = typeof pracownik.imie === 'string' ? pracownik.imie.trim() : '';
  const nazwisko = typeof pracownik.nazwisko === 'string' ? pracownik.nazwisko.trim() : '';
  const pelnaNazwa = `${imie} ${nazwisko}`.trim();

  return pelnaNazwa || `Pracownik #${pracownik.id}`;
}

function pobierzStawkeGodzinowa(stawkaGodzinowa: Pracownik['stawkaGodzinowa']) {
  if (stawkaGodzinowa === null || stawkaGodzinowa === undefined || stawkaGodzinowa === '') {
    return null;
  }

  if (typeof stawkaGodzinowa === 'number') {
    return Number.isFinite(stawkaGodzinowa) ? stawkaGodzinowa : null;
  }

  const sparsowana = Number(stawkaGodzinowa);
  return Number.isFinite(sparsowana) ? sparsowana : null;
}

function normalizujPracownika(dane: unknown): Pracownik {
  const rekord = typeof dane === 'object' && dane !== null ? (dane as Record<string, unknown>) : {};
  const identyfikator = Number(rekord.id);
  const aktywny =
    typeof rekord.aktywny === 'boolean'
      ? rekord.aktywny
      : typeof rekord.aktywny === 'string'
        ? rekord.aktywny === 'true'
        : Boolean(rekord.aktywny);

  return {
    id: Number.isFinite(identyfikator) ? identyfikator : 0,
    imie: typeof rekord.imie === 'string' ? rekord.imie : '',
    nazwisko: typeof rekord.nazwisko === 'string' ? rekord.nazwisko : '',
    stanowisko: typeof rekord.stanowisko === 'string' ? rekord.stanowisko : null,
    stawkaGodzinowa:
      typeof rekord.stawkaGodzinowa === 'string' || typeof rekord.stawkaGodzinowa === 'number'
        ? rekord.stawkaGodzinowa
        : null,
    pin: typeof rekord.pin === 'string' ? rekord.pin : null,
    kodQr: typeof rekord.kodQr === 'string' ? rekord.kodQr : null,
    telefon: typeof rekord.telefon === 'string' ? rekord.telefon : null,
    dodatkoweInformacje: typeof rekord.dodatkoweInformacje === 'string' ? rekord.dodatkoweInformacje : null,
    zdjecie: typeof rekord.zdjecie === 'string' ? rekord.zdjecie : null,
    kolorAvatara: typeof rekord.kolorAvatara === 'string' ? rekord.kolorAvatara : '#2563eb',
    aktywny,
  };
}

function normalizujPracownikow(dane: unknown): Pracownik[] {
  return Array.isArray(dane) ? dane.map(normalizujPracownika) : [];
}

function mapujPracownikaNaFormularz(pracownik: Pracownik): FormularzPracownika {
  return {
    imie: pracownik.imie,
    nazwisko: pracownik.nazwisko,
    stanowisko: pracownik.stanowisko ?? '',
    stawkaGodzinowa:
      pobierzStawkeGodzinowa(pracownik.stawkaGodzinowa) !== null ? String(pobierzStawkeGodzinowa(pracownik.stawkaGodzinowa)) : '',
    pin: pracownik.pin ?? '',
    kodQr: pracownik.kodQr ?? '',
    telefon: pracownik.telefon ?? '',
    dodatkoweInformacje: pracownik.dodatkoweInformacje ?? '',
    zdjecie: pracownik.zdjecie ?? '',
    kolorAvatara: pracownik.kolorAvatara ?? '#2563eb',
    aktywny: pracownik.aktywny,
  };
}

export default function Pracownicy() {
  const { strona, iloscNaStrone, kluczSortowania, kierunekSortowania, onZmianaStrony, onSortowanie, resetujStrone } =
    useTabelaDanych(10);
  const [pracownicy, ustawPracownikow] = useState<Pracownik[]>([]);
  const [lacznie, ustawLacznie] = useState(0);
  const [ladowanie, ustawLadowanie] = useState(false);
  const [ladowaniePdf, ustawLadowaniePdf] = useState(false);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [szukanie, ustawSzukanie] = useState('');
  const [blad, ustawBlad] = useState('');
  const [czyPanelOtwarty, ustawCzyPanelOtwarty] = useState(false);
  const [powiekszoneZdjecie, ustawPowiekszoneZdjecie] = useState<{ src: string; alt: string } | null>(null);
  const [pokazNieaktywnych, ustawPokazNieaktywnych] = useState(true);
  const [edytowanyPracownik, ustawEdytowanegoPracownika] = useState<Pracownik | null>(null);
  const [formularz, ustawFormularz] = useState<FormularzPracownika>(domyslnyFormularz);
  const [filtryKolumn, ustawFiltryKolumn] = useState<FiltryKolumn>(domyslneFiltry);
  const [bledyFormularza, ustawBledyFormularza] = useState<Partial<Record<keyof FormularzPracownika, string>>>({});
  const odroczoneSzukanie = useDeferredValue(szukanie.trim());
  const inputPlikuRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let anulowano = false;

    async function pobierzPracownikow() {
      ustawLadowanie(true);
      ustawBlad('');

      try {
        const odpowiedz = await klientApi.get<OdpowiedzListyPracownikow>('/pracownicy', {
          params: {
            strona,
            iloscNaStrone,
            szukaj: odroczoneSzukanie,
            sortPole: kluczSortowania,
            sortKierunek: kierunekSortowania,
          },
        });

        if (anulowano) {
          return;
        }

        ustawPracownikow(normalizujPracownikow(odpowiedz.data.dane));
        ustawLacznie(odpowiedz.data.lacznie);
      } catch (nowyBlad) {
        if (anulowano) {
          return;
        }

        ustawBlad(pobierzKomunikatBledu(nowyBlad, 'Nie udalo sie pobrac pracownikow.'));
        ustawPracownikow([]);
        ustawLacznie(0);
      } finally {
        if (!anulowano) {
          ustawLadowanie(false);
        }
      }
    }

    void pobierzPracownikow();

    return () => {
      anulowano = true;
    };
  }, [strona, iloscNaStrone, odroczoneSzukanie, kluczSortowania, kierunekSortowania]);

  const ustawPoleFormularza = <K extends keyof FormularzPracownika>(pole: K, wartosc: FormularzPracownika[K]) => {
    ustawFormularz((poprzedni) => ({ ...poprzedni, [pole]: wartosc }));
    ustawBledyFormularza((poprzednie) => ({ ...poprzednie, [pole]: undefined }));
  };

  const otworzDodawanie = () => {
    ustawEdytowanegoPracownika(null);
    ustawFormularz(domyslnyFormularz);
    ustawBledyFormularza({});
    ustawCzyPanelOtwarty(true);
  };

  const otworzEdycje = (pracownik: Pracownik) => {
    ustawEdytowanegoPracownika(pracownik);
    ustawFormularz(mapujPracownikaNaFormularz(pracownik));
    ustawBledyFormularza({});
    ustawCzyPanelOtwarty(true);
  };

  const zamknijPanel = () => {
    if (zapisywanie) {
      return;
    }

    ustawCzyPanelOtwarty(false);
    ustawEdytowanegoPracownika(null);
    ustawFormularz(domyslnyFormularz);
    ustawBledyFormularza({});
  };

  const otworzPodgladZdjecia = (src: string, alt: string) => {
    ustawPowiekszoneZdjecie({ src, alt });
  };

  const zamknijPodgladZdjecia = () => {
    ustawPowiekszoneZdjecie(null);
  };

  const walidujFormularz = () => {
    const noweBledy: Partial<Record<keyof FormularzPracownika, string>> = {};

    if (!formularz.imie.trim()) {
      noweBledy.imie = 'Podaj imie.';
    }

    if (!formularz.nazwisko.trim()) {
      noweBledy.nazwisko = 'Podaj nazwisko.';
    }

    if (formularz.telefon && !/^[+\d\s-]{6,20}$/.test(formularz.telefon.trim())) {
      noweBledy.telefon = 'Podaj poprawny numer telefonu.';
    }

    if (formularz.stawkaGodzinowa && Number(formularz.stawkaGodzinowa) < 0) {
      noweBledy.stawkaGodzinowa = 'Stawka nie moze byc ujemna.';
    }

    if (formularz.pin && !/^\d{1,10}$/.test(formularz.pin)) {
      noweBledy.pin = 'PIN moze miec maksymalnie 10 cyfr.';
    }

    ustawBledyFormularza(noweBledy);
    return Object.keys(noweBledy).length === 0;
  };

  const odswiezListe = async () => {
    const odpowiedz = await klientApi.get<OdpowiedzListyPracownikow>('/pracownicy', {
      params: {
        strona,
        iloscNaStrone,
        szukaj: odroczoneSzukanie,
        sortPole: kluczSortowania,
        sortKierunek: kierunekSortowania,
      },
    });

    ustawPracownikow(normalizujPracownikow(odpowiedz.data.dane));
    ustawLacznie(odpowiedz.data.lacznie);
  };

  const zapiszPracownika = async () => {
    if (!walidujFormularz()) {
      return;
    }

    ustawZapisywanie(true);
    ustawBlad('');

    const payload = {
      imie: formularz.imie.trim(),
      nazwisko: formularz.nazwisko.trim(),
      stanowisko: formularz.stanowisko.trim() || undefined,
      stawkaGodzinowa: formularz.stawkaGodzinowa || undefined,
      pin: formularz.pin.trim() || undefined,
      kodQr: formularz.kodQr.trim() || undefined,
      telefon: formularz.telefon.trim() || undefined,
      dodatkoweInformacje: formularz.dodatkoweInformacje.trim() || undefined,
      zdjecie: formularz.zdjecie || undefined,
      kolorAvatara: formularz.kolorAvatara,
      aktywny: formularz.aktywny,
    };

    try {
      if (edytowanyPracownik) {
        await klientApi.put(`/pracownicy/${edytowanyPracownik.id}`, payload);
      } else {
        await klientApi.post('/pracownicy', payload);
      }

      zamknijPanel();
      resetujStrone();
      await odswiezListe();
    } catch (nowyBlad) {
      ustawBlad(
        pobierzKomunikatBledu(
          nowyBlad,
          edytowanyPracownik ? 'Nie udalo sie zapisac zmian pracownika.' : 'Nie udalo sie dodac pracownika.'
        )
      );
    } finally {
      ustawZapisywanie(false);
    }
  };

  const usunPracownika = async (pracownik: Pracownik) => {
    const czyPotwierdzone = window.confirm(
      `Usunac pracownika ${pracownik.imie} ${pracownik.nazwisko}? Tej operacji nie mozna cofnac.`
    );

    if (!czyPotwierdzone) {
      return;
    }

    ustawBlad('');

    try {
      await klientApi.delete(`/pracownicy/${pracownik.id}`);
      if (pracownicy.length === 1 && strona > 1) {
        onZmianaStrony(strona - 1);
        return;
      }

      if (edytowanyPracownik?.id === pracownik.id) {
        zamknijPanel();
      }

      await odswiezListe();
    } catch (nowyBlad) {
      ustawBlad(pobierzKomunikatBledu(nowyBlad, 'Nie udalo sie usunac pracownika.'));
    }
  };

  const przelaczAktywnosc = async (pracownik: Pracownik) => {
    ustawBlad('');

    try {
      await klientApi.put(`/pracownicy/${pracownik.id}`, {
        imie: pracownik.imie,
        nazwisko: pracownik.nazwisko,
        stanowisko: pracownik.stanowisko ?? undefined,
        stawkaGodzinowa: pobierzStawkeGodzinowa(pracownik.stawkaGodzinowa) ?? undefined,
        pin: pracownik.pin ?? undefined,
        kodQr: pracownik.kodQr ?? undefined,
        telefon: pracownik.telefon ?? undefined,
        dodatkoweInformacje: pracownik.dodatkoweInformacje ?? undefined,
        zdjecie: pracownik.zdjecie ?? undefined,
        kolorAvatara: pracownik.kolorAvatara ?? '#2563eb',
        aktywny: !pracownik.aktywny,
      });

      await odswiezListe();
    } catch (nowyBlad) {
      ustawBlad(pobierzKomunikatBledu(nowyBlad, 'Nie udalo sie zmienic statusu pracownika.'));
    }
  };

  const pobierzPdfQr = async () => {
    if (pracownicy.length === 0) {
      ustawBlad('Brak pracownikow do eksportu PDF.');
      return;
    }

    ustawLadowaniePdf(true);
    ustawBlad('');

    try {
      const [{ jsPDF }, { default: QRCode }] = await Promise.all([import('jspdf'), import('qrcode')]);
      const dokument = new jsPDF({
        format: 'a4',
        orientation: 'portrait',
        unit: 'mm',
      });

      const margines = 15;
      const kolumnyNaStronie = 2;
      const wierszeNaStronie = 3;
      const naStrone = kolumnyNaStronie * wierszeNaStronie;
      const szerokoscStrony = dokument.internal.pageSize.getWidth();
      const wysokoscStrony = dokument.internal.pageSize.getHeight();
      const szerokoscKomorki = (szerokoscStrony - margines * 2) / kolumnyNaStronie;
      const wysokoscKomorki = (wysokoscStrony - margines * 2) / wierszeNaStronie;
      const rozmiarQr = 55;

      for (let indeks = 0; indeks < pracownicy.length; indeks += 1) {
        if (indeks > 0 && indeks % naStrone === 0) {
          dokument.addPage();
        }

        const pracownik = pracownicy[indeks];
        const pozycjaNaStronie = indeks % naStrone;
        const kolumna = pozycjaNaStronie % kolumnyNaStronie;
        const wiersz = Math.floor(pozycjaNaStronie / kolumnyNaStronie);
        const startX = margines + kolumna * szerokoscKomorki;
        const startY = margines + wiersz * wysokoscKomorki;
        const srodekX = startX + szerokoscKomorki / 2;
        const qrDataUrl = await QRCode.toDataURL(String(pracownik.kodQr ?? pracownik.id), {
          width: 200,
          margin: 1,
        });

        dokument.addImage(qrDataUrl, 'PNG', srodekX - rozmiarQr / 2, startY + 6, rozmiarQr, rozmiarQr);

        dokument.setFont('helvetica', 'bold');
        dokument.setFontSize(10);
        dokument.setTextColor(15, 23, 42);
        dokument.text(pobierzNazwePracownika(pracownik), srodekX, startY + 67, { align: 'center' });

        dokument.setFont('helvetica', 'normal');
        dokument.setFontSize(8);
        dokument.setTextColor(107, 114, 128);
        dokument.text(pracownik.stanowisko || '-', srodekX, startY + 73, { align: 'center' });

        if (pracownik.pin) {
          dokument.setTextColor(71, 85, 105);
          dokument.text(`PIN: ${pracownik.pin}`, srodekX, startY + 79, { align: 'center' });
        }
      }

      dokument.save('pracownicy-qr.pdf');
    } catch (nowyBlad) {
      ustawBlad(pobierzKomunikatBledu(nowyBlad, 'Nie udalo sie wygenerowac PDF z kodami QR.'));
    } finally {
      ustawLadowaniePdf(false);
    }
  };

  const pobierzPdfKody = async () => {
    if (pracownicy.length === 0) {
      ustawBlad('Brak pracownikow do eksportu PDF.');
      return;
    }

    ustawLadowaniePdf(true);
    ustawBlad('');

    try {
      const [{ jsPDF }, { default: JsBarcode }] = await Promise.all([import('jspdf'), import('jsbarcode')]);
      const dokument = new jsPDF({
        format: 'a4',
        orientation: 'portrait',
        unit: 'mm',
      });

      const margines = 15;
      const kolumnyNaStronie = 2;
      const wierszeNaStronie = 3;
      const naStrone = kolumnyNaStronie * wierszeNaStronie;
      const szerokoscStrony = dokument.internal.pageSize.getWidth();
      const wysokoscStrony = dokument.internal.pageSize.getHeight();
      const szerokoscKomorki = (szerokoscStrony - margines * 2) / kolumnyNaStronie;
      const wysokoscKomorki = (wysokoscStrony - margines * 2) / wierszeNaStronie;
      const szerokoscKodu = 80;
      const wysokoscKodu = 22;

      for (let indeks = 0; indeks < pracownicy.length; indeks += 1) {
        if (indeks > 0 && indeks % naStrone === 0) {
          dokument.addPage();
        }

        const pracownik = pracownicy[indeks];
        const pozycjaNaStronie = indeks % naStrone;
        const kolumna = pozycjaNaStronie % kolumnyNaStronie;
        const wiersz = Math.floor(pozycjaNaStronie / kolumnyNaStronie);
        const startX = margines + kolumna * szerokoscKomorki;
        const startY = margines + wiersz * wysokoscKomorki;
        const srodekX = startX + szerokoscKomorki / 2;
        const canvas = document.createElement('canvas');

        JsBarcode(canvas, String(pracownik.kodQr ?? pracownik.id), {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
        });

        const kodDataUrl = canvas.toDataURL('image/png');

        dokument.addImage(kodDataUrl, 'PNG', srodekX - szerokoscKodu / 2, startY + 18, szerokoscKodu, wysokoscKodu);

        dokument.setFont('helvetica', 'bold');
        dokument.setFontSize(10);
        dokument.setTextColor(15, 23, 42);
        dokument.text(pobierzNazwePracownika(pracownik), srodekX, startY + 46, { align: 'center' });

        dokument.setFont('helvetica', 'normal');
        dokument.setFontSize(8);
        dokument.setTextColor(71, 85, 105);
        dokument.text(`Numer: ${pracownik.kodQr ?? pracownik.id}`, srodekX, startY + 52, { align: 'center' });
      }

      dokument.save('pracownicy-kody-kreskowe.pdf');
    } catch (nowyBlad) {
      ustawBlad(pobierzKomunikatBledu(nowyBlad, 'Nie udalo sie wygenerowac PDF z kodami kreskowymi.'));
    } finally {
      ustawLadowaniePdf(false);
    }
  };

  const wczytajZdjecie = (event: ChangeEvent<HTMLInputElement>) => {
    const plik = event.target.files?.[0];

    if (!plik) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        ustawPoleFormularza('zdjecie', reader.result);
      }
    };
    reader.readAsDataURL(plik);
    event.target.value = '';
  };

  const liczbaDostepnych = useMemo(() => pracownicy.filter((pracownik) => pracownik.aktywny).length, [pracownicy]);

  const przefiltrowaniPracownicy = useMemo(() => {
    return pracownicy.filter((pracownik) => {
      const nazwa = pobierzNazwePracownika(pracownik).toLowerCase();
      const stanowisko = (pracownik.stanowisko ?? '').toLowerCase();
      const pin = (pracownik.pin ?? '').toLowerCase();
      const kodQr = (pracownik.kodQr ?? '').toLowerCase();
      const stawka = pobierzStawkeGodzinowa(pracownik.stawkaGodzinowa);

      if (!pokazNieaktywnych && !pracownik.aktywny) {
        return false;
      }

      if (filtryKolumn.nazwa && !nazwa.includes(filtryKolumn.nazwa.trim().toLowerCase())) {
        return false;
      }

      if (filtryKolumn.pin && !pin.includes(filtryKolumn.pin.trim().toLowerCase())) {
        return false;
      }

      if (filtryKolumn.kodQr && !kodQr.includes(filtryKolumn.kodQr.trim().toLowerCase())) {
        return false;
      }

      if (filtryKolumn.stanowisko && !stanowisko.includes(filtryKolumn.stanowisko.trim().toLowerCase())) {
        return false;
      }

      if (filtryKolumn.aktywny === 'aktywni' && !pracownik.aktywny) {
        return false;
      }

      if (filtryKolumn.aktywny === 'nieaktywni' && pracownik.aktywny) {
        return false;
      }

      if (filtryKolumn.stawka && !(stawka !== null && String(stawka).includes(filtryKolumn.stawka.trim()))) {
        return false;
      }

      return true;
    });
  }, [filtryKolumn, pokazNieaktywnych, pracownicy]);

  return (
    <div className='space-y-6'>
      <div className='rounded-[28px] border border-obramowanie bg-tlo-karta shadow-sm'>
        <div className='flex flex-col gap-6 border-b border-obramowanie px-6 py-6 xl:flex-row xl:items-start xl:justify-between'>
          <div>
            <h1 className='text-3xl font-semibold text-tekst-glowny'>Pracownicy</h1>
            <p className='mt-1 text-sm font-medium text-orange-300'>Pozostali dostepni pracownicy: {liczbaDostepnych}</p>
          </div>

          <div className='flex w-full flex-col gap-3 xl:w-auto xl:min-w-[360px]'>
            <Pole
              etykieta='Szukaj na liscie'
              placeholder='Imie, nazwisko, stanowisko, PIN, QR / RFID'
              value={szukanie}
              onChange={(event) => {
                ustawSzukanie(event.target.value);
                resetujStrone();
              }}
              ikonaPrefix={<Search size={16} />}
            />
            <div className='flex flex-wrap gap-3'>
              <Przycisk wariant='drugorzedny' onClick={() => void pobierzPdfQr()} disabled={ladowaniePdf}>
                <QrCode size={16} />
                Generuj kody QR
              </Przycisk>

              <Przycisk wariant='drugorzedny' onClick={() => void pobierzPdfKody()} disabled={ladowaniePdf}>
                <Barcode size={16} />
                Generuj kody kreskowe
              </Przycisk>

              <Przycisk onClick={otworzDodawanie}>
                <Plus size={16} />
                Dodaj pracownika
              </Przycisk>
            </div>
          </div>
        </div>

        <div className='flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex flex-wrap items-center gap-4 text-sm text-tekst-drugorzedny'>
            <span>Eksport:</span>
            <button type='button' className='font-semibold text-tekst-glowny transition-colors hover:text-akcent'>CSV</button>
            <button type='button' className='font-semibold text-tekst-glowny transition-colors hover:text-akcent'>XLSX</button>
            <button type='button' onClick={() => void pobierzPdfQr()} className='font-semibold text-tekst-glowny transition-colors hover:text-akcent'>
              Generuj kody QR
            </button>
            <button type='button' onClick={() => void pobierzPdfKody()} className='font-semibold text-tekst-glowny transition-colors hover:text-akcent'>
              Generuj kody kreskowe
            </button>
          </div>

          <div className='flex flex-wrap items-center gap-4 text-sm text-tekst-drugorzedny'>
            <Przelacznik wartosc={pokazNieaktywnych} onZmiana={ustawPokazNieaktywnych} etykieta='Wyswietl nieaktywne' />
            <span>Elementow na stronie: {iloscNaStrone}</span>
            <span>
              {przefiltrowaniPracownicy.length === 0 ? 0 : (strona - 1) * iloscNaStrone + 1} - {Math.min(strona * iloscNaStrone, lacznie)} z {lacznie}
            </span>
          </div>
        </div>
      </div>

      {blad ? (
        <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300'>{blad}</div>
      ) : null}

      <div className='overflow-hidden rounded-[28px] border border-obramowanie bg-tlo-karta shadow-sm'>
        <div className='overflow-x-auto'>
          <table className='min-w-[1280px] w-full border-collapse text-left text-sm text-tekst-glowny'>
            <thead className='bg-tlo-naglowek'>
              <tr>
                {['Dodatkowe oznaczenie', 'Zdjecie', 'Imie i nazwisko', 'PIN', 'QR / RFID', 'Stanowisko', 'Aktywny', 'Cena za godzine pracy', 'Akcje'].map((naglowek) => (
                  <th key={naglowek} className='border-b border-r border-obramowanie px-4 py-4 font-semibold text-tekst-glowny last:border-r-0'>
                    <button
                      type='button'
                      className='transition-colors hover:text-akcent'
                      onClick={() => {
                        const mapaSortowania: Record<string, string> = {
                          'Imie i nazwisko': 'imie',
                          PIN: 'pin',
                          'QR / RFID': 'kodQr',
                          Stanowisko: 'stanowisko',
                          Aktywny: 'aktywny',
                          'Cena za godzine pracy': 'stawkaGodzinowa',
                        };
                        const klucz = mapaSortowania[naglowek];
                        if (!klucz) {
                          return;
                        }

                        onSortowanie(klucz, kluczSortowania === klucz && kierunekSortowania === 'asc' ? 'desc' : 'asc');
                      }}
                    >
                      {naglowek}
                    </button>
                  </th>
                ))}
              </tr>
              <tr className='bg-tlo-karta'>
                <th className='border-b border-r border-obramowanie px-3 py-3' />
                <th className='border-b border-r border-obramowanie px-3 py-3' />
                <th className='border-b border-r border-obramowanie px-3 py-3'>
                  <input
                    value={filtryKolumn.nazwa}
                    onChange={(event) => ustawFiltryKolumn((prev) => ({ ...prev, nazwa: event.target.value }))}
                    placeholder='Szukaj'
                    className={klasyInputaTabeli}
                  />
                </th>
                <th className='border-b border-r border-obramowanie px-3 py-3'>
                  <input
                    value={filtryKolumn.pin}
                    onChange={(event) => ustawFiltryKolumn((prev) => ({ ...prev, pin: event.target.value }))}
                    placeholder='Szukaj'
                    className={klasyInputaTabeli}
                  />
                </th>
                <th className='border-b border-r border-obramowanie px-3 py-3'>
                  <input
                    value={filtryKolumn.kodQr}
                    onChange={(event) => ustawFiltryKolumn((prev) => ({ ...prev, kodQr: event.target.value }))}
                    placeholder='Szukaj'
                    className={klasyInputaTabeli}
                  />
                </th>
                <th className='border-b border-r border-obramowanie px-3 py-3'>
                  <input
                    value={filtryKolumn.stanowisko}
                    onChange={(event) => ustawFiltryKolumn((prev) => ({ ...prev, stanowisko: event.target.value }))}
                    placeholder='Szukaj'
                    className={klasyInputaTabeli}
                  />
                </th>
                <th className='border-b border-r border-obramowanie px-3 py-3'>
                  <select
                    value={filtryKolumn.aktywny}
                    onChange={(event) => ustawFiltryKolumn((prev) => ({ ...prev, aktywny: event.target.value as FiltryKolumn['aktywny'] }))}
                    className={klasyInputaTabeli}
                  >
                    <option value='wszyscy'>Wszyscy</option>
                    <option value='aktywni'>Tak</option>
                    <option value='nieaktywni'>Nie</option>
                  </select>
                </th>
                <th className='border-b border-r border-obramowanie px-3 py-3'>
                  <input
                    value={filtryKolumn.stawka}
                    onChange={(event) => ustawFiltryKolumn((prev) => ({ ...prev, stawka: event.target.value }))}
                    placeholder='Szukaj'
                    className={klasyInputaTabeli}
                  />
                </th>
                <th className='border-b px-3 py-3' />
              </tr>
            </thead>

            <tbody>
              {ladowanie ? (
                Array.from({ length: 6 }, (_, indeks) => (
                  <tr key={`skeleton-${indeks}`} className='odd:bg-tlo-glowne even:bg-tlo-karta/50'>
                    {Array.from({ length: 9 }, (_, kolumna) => (
                      <td key={`skeleton-${indeks}-${kolumna}`} className='border-b border-r border-obramowanie px-4 py-4 last:border-r-0'>
                        <div className='h-9 animate-pulse rounded-xl bg-obramowanie' />
                      </td>
                    ))}
                  </tr>
                ))
              ) : przefiltrowaniPracownicy.length === 0 ? (
                <tr>
                  <td colSpan={9} className='px-6 py-16 text-center text-sm text-tekst-drugorzedny'>
                    Brak pracownikow spelniajacych wybrane filtry.
                  </td>
                </tr>
              ) : (
                przefiltrowaniPracownicy.map((pracownik) => {
                  const stawka = pobierzStawkeGodzinowa(pracownik.stawkaGodzinowa);

                  return (
                    <tr key={pracownik.id} className='odd:bg-tlo-glowne even:bg-tlo-karta/50'>
                      <td className='border-b border-r border-obramowanie px-4 py-3 text-center'>
                        <div
                          className='mx-auto flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm'
                          style={{ backgroundColor: pracownik.kolorAvatara ?? '#2563eb' }}
                        >
                          {pobierzInicjaly(pracownik)}
                        </div>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 text-center'>
                        {pracownik.zdjecie ? (
                          <button
                            type='button'
                            onClick={() => otworzPodgladZdjecia(pracownik.zdjecie as string, pobierzNazwePracownika(pracownik))}
                            className='mx-auto block rounded-xl transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-akcent'
                            aria-label={`Powieksz zdjecie pracownika ${pobierzNazwePracownika(pracownik)}`}
                          >
                            <img src={pracownik.zdjecie} alt={pobierzNazwePracownika(pracownik)} className='h-12 w-12 rounded-xl object-cover' />
                          </button>
                        ) : (
                          <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-obramowanie text-tekst-drugorzedny'>
                            <ImagePlus size={18} />
                          </div>
                        )}
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3'>
                        <div className='font-medium text-tekst-glowny'>{pobierzNazwePracownika(pracownik)}</div>
                        <div className='mt-1 text-xs text-tekst-drugorzedny'>{pracownik.telefon ?? 'Brak telefonu'}</div>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3'>{pracownik.pin ?? '-'}</td>
                      <td className='border-b border-r border-obramowanie px-4 py-3'>{pracownik.kodQr ?? '-'}</td>
                      <td className='border-b border-r border-obramowanie px-4 py-3'>{pracownik.stanowisko || '-'}</td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 text-center'>
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                            pracownik.aktywny ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-slate-100'
                          }`}
                        >
                          {pracownik.aktywny ? <Check size={16} /> : <X size={16} />}
                        </span>
                      </td>
                      <td className='border-b border-r border-obramowanie px-4 py-3 text-right'>{stawka !== null ? stawka.toFixed(2) : '-'}</td>
                      <td className='border-b px-4 py-3'>
                        <div className='flex items-center justify-center gap-3 text-akcent'>
                          <button type='button' onClick={() => otworzEdycje(pracownik)} className='transition-colors hover:text-akcent-hover' aria-label='Edytuj pracownika'>
                            <Pencil size={16} />
                          </button>
                          <button
                            type='button'
                            onClick={() => void przelaczAktywnosc(pracownik)}
                            className={`transition-colors ${pracownik.aktywny ? 'text-orange-300 hover:text-orange-200' : 'text-emerald-300 hover:text-emerald-200'}`}
                            aria-label={pracownik.aktywny ? 'Oznacz jako nieaktywny' : 'Oznacz jako aktywny'}
                          >
                            {pracownik.aktywny ? <X size={16} /> : <Check size={16} />}
                          </button>
                          <button type='button' onClick={() => void usunPracownika(pracownik)} className='text-red-400 transition-colors hover:text-red-300' aria-label='Usun pracownika'>
                            <Trash2 size={16} />
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

        <div className='flex flex-wrap items-center justify-between gap-3 border-t border-obramowanie px-6 py-4 text-sm text-tekst-drugorzedny'>
          <span>
            Strona {strona} z {Math.max(1, Math.ceil(lacznie / iloscNaStrone))}
          </span>

          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => onZmianaStrony(strona - 1)}
              disabled={strona <= 1}
              className='rounded-lg border border-obramowanie px-3 py-2 transition-colors hover:border-akcent hover:text-akcent disabled:cursor-not-allowed disabled:opacity-50'
            >
              Poprzednia
            </button>
            <button
              type='button'
              onClick={() => onZmianaStrony(strona + 1)}
              disabled={strona >= Math.max(1, Math.ceil(lacznie / iloscNaStrone))}
              className='rounded-lg border border-obramowanie px-3 py-2 transition-colors hover:border-akcent hover:text-akcent disabled:cursor-not-allowed disabled:opacity-50'
            >
              Nastepna
            </button>
          </div>
        </div>
      </div>

      {czyPanelOtwarty ? (
        <div className='fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-sm'>
          <button type='button' className='flex-1 cursor-default' onClick={zamknijPanel} aria-label='Zamknij panel pracownika' />

          <aside className='relative flex h-full w-full max-w-[760px] flex-col border-l border-obramowanie bg-tlo-karta shadow-2xl'>
            <div className='flex items-center justify-between border-b border-obramowanie px-6 py-5'>
              <h2 className='text-[2rem] font-semibold text-tekst-glowny'>
                {edytowanyPracownik ? `Pracownik: ${pobierzNazwePracownika(edytowanyPracownik)}` : 'Nowy pracownik'}
              </h2>

              <div className='flex items-center gap-4 text-tekst-drugorzedny'>
                {edytowanyPracownik ? (
                  <button type='button' onClick={() => void usunPracownika(edytowanyPracownik)} className='transition-colors hover:text-red-400' aria-label='Usun pracownika'>
                    <Trash2 size={18} />
                  </button>
                ) : null}
                <button type='button' onClick={zamknijPanel} className='transition-colors hover:text-tekst-glowny' aria-label='Zamknij panel'>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className='flex-1 overflow-y-auto px-6 py-6'>
              <div className='space-y-5'>
                <div className='rounded-2xl border border-obramowanie bg-tlo-glowne/40 px-4 py-4'>
                  <Przelacznik etykieta='Aktywny' wartosc={formularz.aktywny} onZmiana={(wartosc) => ustawPoleFormularza('aktywny', wartosc)} />
                </div>

                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <Pole
                    etykieta='Imie*'
                    value={formularz.imie}
                    onChange={(event) => ustawPoleFormularza('imie', event.target.value)}
                    bladOpisu={bledyFormularza.imie}
                  />
                  <Pole
                    etykieta='Nazwisko*'
                    value={formularz.nazwisko}
                    onChange={(event) => ustawPoleFormularza('nazwisko', event.target.value)}
                    bladOpisu={bledyFormularza.nazwisko}
                  />
                </div>

                <label className='block'>
                  <span className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>PIN*</span>
                  <input value={formularz.pin} onChange={(event) => ustawPoleFormularza('pin', event.target.value)} className={klasyPolaPanelu} />
                  {bledyFormularza.pin ? <p className='mt-1 text-xs text-red-400'>{bledyFormularza.pin}</p> : null}
                </label>

                <label className='block'>
                  <span className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Stanowisko</span>
                  <input value={formularz.stanowisko} onChange={(event) => ustawPoleFormularza('stanowisko', event.target.value)} className={klasyPolaPanelu} />
                </label>

                <label className='block'>
                  <span className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Cena za godzine pracy</span>
                  <input
                    type='number'
                    min='0'
                    step='0.01'
                    value={formularz.stawkaGodzinowa}
                    onChange={(event) => ustawPoleFormularza('stawkaGodzinowa', event.target.value)}
                    className={klasyPolaPanelu}
                  />
                  {bledyFormularza.stawkaGodzinowa ? <p className='mt-1 text-xs text-red-400'>{bledyFormularza.stawkaGodzinowa}</p> : null}
                </label>

                <label className='block'>
                  <span className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Telefon</span>
                  <input value={formularz.telefon} onChange={(event) => ustawPoleFormularza('telefon', event.target.value)} className={klasyPolaPanelu} />
                  {bledyFormularza.telefon ? <p className='mt-1 text-xs text-red-400'>{bledyFormularza.telefon}</p> : null}
                </label>

                <label className='block'>
                  <span className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>QR / RFID</span>
                  <input value={formularz.kodQr} onChange={(event) => ustawPoleFormularza('kodQr', event.target.value)} className={klasyPolaPanelu} />
                </label>

                <label className='block'>
                  <span className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Dodatkowe informacje</span>
                  <textarea
                    rows={3}
                    value={formularz.dodatkoweInformacje}
                    onChange={(event) => ustawPoleFormularza('dodatkoweInformacje', event.target.value)}
                    className={klasyTextareaPanelu}
                  />
                </label>

                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium text-tekst-drugorzedny'>Zdjecie</span>
                    <div className='flex items-center gap-3'>
                      <button type='button' onClick={() => inputPlikuRef.current?.click()} className='text-tekst-drugorzedny transition-colors hover:text-akcent' aria-label='Dodaj zdjecie'>
                        <Upload size={18} />
                      </button>
                      {formularz.zdjecie ? (
                        <button type='button' onClick={() => ustawPoleFormularza('zdjecie', '')} className='text-red-400 transition-colors hover:text-red-300' aria-label='Usun zdjecie'>
                          <Trash2 size={18} />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <input ref={inputPlikuRef} type='file' accept='image/*' className='hidden' onChange={wczytajZdjecie} />

                  <button
                    type='button'
                    onClick={() => {
                      if (formularz.zdjecie) {
                        otworzPodgladZdjecia(formularz.zdjecie, edytowanyPracownik ? pobierzNazwePracownika(edytowanyPracownik) : 'Nowe zdjecie pracownika');
                        return;
                      }

                      inputPlikuRef.current?.click();
                    }}
                    className='flex min-h-[108px] w-full items-center justify-center rounded-2xl border border-dashed border-obramowanie bg-tlo-glowne/30 p-4 transition-colors hover:border-akcent'
                  >
                    {formularz.zdjecie ? (
                      <img src={formularz.zdjecie} alt='Podglad zdjecia pracownika' className='max-h-40 rounded-xl object-cover' />
                    ) : (
                      <div className='flex flex-col items-center gap-3 text-sm text-tekst-drugorzedny'>
                        <ImagePlus size={22} />
                        <span>Dodaj zdjecie pracownika</span>
                      </div>
                    )}
                  </button>
                </div>

                <label className='block'>
                  <span className='mb-1.5 block text-sm font-medium text-tekst-drugorzedny'>Kolor oznaczenia</span>
                  <input
                    type='color'
                    value={formularz.kolorAvatara}
                    onChange={(event) => ustawPoleFormularza('kolorAvatara', event.target.value)}
                    className='h-14 w-full cursor-pointer rounded-xl border border-obramowanie bg-tlo-glowne px-2 py-2'
                  />
                </label>
              </div>
            </div>

            <div className='border-t border-obramowanie px-6 py-4'>
              <div className='flex justify-center'>
                <Przycisk onClick={() => void zapiszPracownika()} czyLaduje={zapisywanie} className='min-w-[140px] justify-center rounded-full px-8'>
                  ZAPISZ
                </Przycisk>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {powiekszoneZdjecie ? (
        <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm'>
          <button type='button' className='absolute inset-0 cursor-default' onClick={zamknijPodgladZdjecia} aria-label='Zamknij podglad zdjecia' />
          <div className='relative z-10 w-full max-w-4xl rounded-[28px] border border-obramowanie bg-tlo-karta p-4 shadow-2xl'>
            <div className='mb-4 flex items-center justify-between gap-4'>
              <h3 className='truncate text-lg font-semibold text-tekst-glowny'>{powiekszoneZdjecie.alt}</h3>
              <button
                type='button'
                onClick={zamknijPodgladZdjecia}
                className='rounded-full p-2 text-tekst-drugorzedny transition-colors hover:bg-tlo-glowne hover:text-tekst-glowny'
                aria-label='Zamknij powiekszenie zdjecia'
              >
                <X size={18} />
              </button>
            </div>
            <div className='flex max-h-[80vh] items-center justify-center overflow-hidden rounded-[24px] bg-tlo-glowne/60 p-4'>
              <img src={powiekszoneZdjecie.src} alt={powiekszoneZdjecie.alt} className='max-h-[72vh] w-auto max-w-full rounded-2xl object-contain' />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
