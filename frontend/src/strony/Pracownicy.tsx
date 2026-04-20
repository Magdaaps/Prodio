import { useDeferredValue, useEffect, useState } from 'react';
import { Barcode, Pencil, Plus, QrCode, Search, Trash2 } from 'lucide-react';
import klientApi from '../api/klient';
import TabelaDanych from '../komponenty/TabelaDanych';
import Modal from '../komponenty/ui/Modal';
import Pole from '../komponenty/ui/Pole';
import Przycisk from '../komponenty/ui/Przycisk';
import Przelacznik from '../komponenty/ui/Przelacznik';
import { useTabelaDanych } from '../hooki/useTabelaDanych';
import type { KolumnaTabeliDanych } from '../typy/indeks';

interface Pracownik {
  id: number;
  imie: string;
  nazwisko: string;
  stanowisko: string | null;
  stawkaGodzinowa: number | string | null;
  pin: string | null;
  kolorAvatara: string | null;
  aktywny: boolean;
}

interface FormularzPracownika {
  imie: string;
  nazwisko: string;
  stanowisko: string;
  stawkaGodzinowa: string;
  pin: string;
  kolorAvatara: string;
  aktywny: boolean;
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
  kolorAvatara: '#2563eb',
  aktywny: true,
};

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
  const [czyModalOtwarty, ustawCzyModalOtwarty] = useState(false);
  const [edytowanyPracownik, ustawEdytowanegoPracownika] = useState<Pracownik | null>(null);
  const [formularz, ustawFormularz] = useState<FormularzPracownika>(domyslnyFormularz);
  const [bledyFormularza, ustawBledyFormularza] = useState<Partial<Record<keyof FormularzPracownika, string>>>({});
  const odroczoneSzukanie = useDeferredValue(szukanie.trim());

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

        ustawBlad(pobierzKomunikatBledu(nowyBlad, 'Nie udało się pobrać pracowników.'));
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

  const otworzModalDodawania = () => {
    ustawEdytowanegoPracownika(null);
    ustawFormularz(domyslnyFormularz);
    ustawBledyFormularza({});
    ustawCzyModalOtwarty(true);
  };

  const otworzModalEdycji = (pracownik: Pracownik) => {
    ustawEdytowanegoPracownika(pracownik);
    ustawFormularz(mapujPracownikaNaFormularz(pracownik));
    ustawBledyFormularza({});
    ustawCzyModalOtwarty(true);
  };

  const zamknijModal = () => {
    if (zapisywanie) {
      return;
    }

    ustawCzyModalOtwarty(false);
    ustawEdytowanegoPracownika(null);
    ustawFormularz(domyslnyFormularz);
    ustawBledyFormularza({});
  };

  const ustawPoleFormularza = <K extends keyof FormularzPracownika>(pole: K, wartosc: FormularzPracownika[K]) => {
    ustawFormularz((poprzedni) => ({ ...poprzedni, [pole]: wartosc }));
    ustawBledyFormularza((poprzednie) => ({ ...poprzednie, [pole]: undefined }));
  };

  const walidujFormularz = () => {
    const noweBledy: Partial<Record<keyof FormularzPracownika, string>> = {};

    if (!formularz.imie.trim()) {
      noweBledy.imie = 'Podaj imię.';
    }

    if (!formularz.nazwisko.trim()) {
      noweBledy.nazwisko = 'Podaj nazwisko.';
    }

    if (formularz.stawkaGodzinowa && Number(formularz.stawkaGodzinowa) < 0) {
      noweBledy.stawkaGodzinowa = 'Stawka nie może być ujemna.';
    }

    if (formularz.pin && !/^\d{4,10}$/.test(formularz.pin)) {
      noweBledy.pin = 'PIN musi mieć od 4 do 10 cyfr.';
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
      kolorAvatara: formularz.kolorAvatara,
      aktywny: formularz.aktywny,
    };

    try {
      if (edytowanyPracownik) {
        await klientApi.put(`/pracownicy/${edytowanyPracownik.id}`, payload);
      } else {
        await klientApi.post('/pracownicy', payload);
      }

      zamknijModal();
      resetujStrone();
      await odswiezListe();
    } catch (nowyBlad) {
      ustawBlad(
        pobierzKomunikatBledu(
          nowyBlad,
          edytowanyPracownik ? 'Nie udało się zapisać zmian pracownika.' : 'Nie udało się dodać pracownika.'
        )
      );
    } finally {
      ustawZapisywanie(false);
    }
  };

  const usunPracownika = async (pracownik: Pracownik) => {
    const czyPotwierdzone = window.confirm(
      `Usunąć pracownika ${pracownik.imie} ${pracownik.nazwisko}? Tej operacji nie można cofnąć.`
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

      await odswiezListe();
    } catch (nowyBlad) {
      ustawBlad(pobierzKomunikatBledu(nowyBlad, 'Nie udało się usunąć pracownika.'));
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
        const qrDataUrl = await QRCode.toDataURL(String(pracownik.id), {
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

        JsBarcode(canvas, String(pracownik.id), {
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
        dokument.text(`Numer: ${pracownik.id}`, srodekX, startY + 52, { align: 'center' });
      }

      dokument.save('pracownicy-kody-kreskowe.pdf');
    } catch (nowyBlad) {
      ustawBlad(pobierzKomunikatBledu(nowyBlad, 'Nie udalo sie wygenerowac PDF z kodami kreskowymi.'));
    } finally {
      ustawLadowaniePdf(false);
    }
  };

  const kolumny: KolumnaTabeliDanych<Pracownik>[] = [
    {
      klucz: 'id',
      naglowek: 'ID',
      sortowalny: true,
      szerokosc: '80px',
    },
    {
      klucz: 'imie',
      naglowek: 'Imię / nazwisko',
      sortowalny: true,
      renderuj: (pracownik) => (
        <div className='flex items-center gap-3'>
          <div
            className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white'
            style={{ backgroundColor: pracownik.kolorAvatara ?? '#2563eb' }}
          >
            {pobierzInicjaly(pracownik)}
          </div>
          <div className='min-w-0'>
            <p className='font-medium text-tekst-glowny'>
              {pobierzNazwePracownika(pracownik)}
            </p>
            <p className='truncate text-xs text-tekst-drugorzedny'>PIN: {pracownik.pin ?? 'brak'}</p>
          </div>
        </div>
      ),
    },
    {
      klucz: 'nazwisko',
      naglowek: 'Nazwisko',
      sortowalny: true,
    },
    {
      klucz: 'stanowisko',
      naglowek: 'Stanowisko',
      sortowalny: true,
      renderuj: (pracownik) => pracownik.stanowisko || '-',
    },
    {
      klucz: 'stawkaGodzinowa',
      naglowek: 'Stawka godzinowa (PLN/h)',
      sortowalny: true,
      renderuj: (pracownik) => {
        const stawka = pobierzStawkeGodzinowa(pracownik.stawkaGodzinowa);
        return stawka !== null ? `${stawka.toFixed(2)} PLN/h` : '-';
      },
    },
    {
      klucz: 'aktywny',
      naglowek: 'Aktywny',
      sortowalny: true,
      renderuj: (pracownik) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
            pracownik.aktywny ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'
          }`}
        >
          {pracownik.aktywny ? 'Aktywny' : 'Nieaktywny'}
        </span>
      ),
    },
    {
      klucz: 'akcje',
      naglowek: 'Akcje',
      szerokosc: '180px',
      renderuj: (pracownik) => (
        <div className='flex items-center gap-2'>
          <Przycisk wariant='drugorzedny' rozmiar='maly' onClick={() => otworzModalEdycji(pracownik)}>
            <Pencil size={14} />
            Edytuj
          </Przycisk>
          <Przycisk wariant='niebezpieczny' rozmiar='maly' onClick={() => void usunPracownika(pracownik)}>
            <Trash2 size={14} />
            Usuń
          </Przycisk>
        </div>
      ),
    },
  ];

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 rounded-2xl border border-obramowanie bg-tlo-karta p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-tekst-glowny'>Pracownicy</h1>
          <p className='mt-1 text-sm text-tekst-drugorzedny'>
            Ewidencja operatorów i pracowników produkcji w systemie MES.
          </p>
        </div>

        <div className='flex w-full flex-col gap-3 sm:flex-row lg:w-auto'>
          <div className='w-full sm:min-w-[320px]'>
            <Pole
              etykieta='Szukaj po imieniu lub nazwisku'
              placeholder='Np. Jan Kowalski'
              value={szukanie}
              onChange={(event) => {
                ustawSzukanie(event.target.value);
                resetujStrone();
              }}
              ikonaPrefix={<Search size={16} />}
            />
          </div>

          <Przycisk className='self-end' wariant='drugorzedny' onClick={() => void pobierzPdfQr()} disabled={ladowaniePdf}>
            <QrCode size={16} />
            Pobierz QR PDF
          </Przycisk>

          <Przycisk className='self-end' wariant='drugorzedny' onClick={() => void pobierzPdfKody()} disabled={ladowaniePdf}>
            <Barcode size={16} />
            Pobierz Kody PDF
          </Przycisk>

          <Przycisk className='self-end' onClick={otworzModalDodawania}>
            <Plus size={16} />
            Dodaj pracownika
          </Przycisk>
        </div>
      </div>

      {blad ? (
        <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300'>{blad}</div>
      ) : null}

      <TabelaDanych
        kolumny={kolumny}
        dane={pracownicy}
        ladowanie={ladowanie}
        stronaPaginacji={strona}
        iloscNaStrone={iloscNaStrone}
        lacznie={lacznie}
        onZmianaStrony={onZmianaStrony}
        onSortowanie={onSortowanie}
      />

      <Modal
        czyOtwarty={czyModalOtwarty}
        onZamknij={zamknijModal}
        tytul={edytowanyPracownik ? 'Edytuj pracownika' : 'Dodaj pracownika'}
        rozmiar='sredni'
        akcje={
          <>
            <Przycisk wariant='drugorzedny' onClick={zamknijModal} disabled={zapisywanie}>
              Anuluj
            </Przycisk>
            <Przycisk onClick={() => void zapiszPracownika()} czyLaduje={zapisywanie}>
              {edytowanyPracownik ? 'Zapisz zmiany' : 'Dodaj pracownika'}
            </Przycisk>
          </>
        }
      >
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <Pole
            etykieta='Imię'
            value={formularz.imie}
            onChange={(event) => ustawPoleFormularza('imie', event.target.value)}
            bladOpisu={bledyFormularza.imie}
          />
          <Pole
            etykieta='Nazwisko'
            value={formularz.nazwisko}
            onChange={(event) => ustawPoleFormularza('nazwisko', event.target.value)}
            bladOpisu={bledyFormularza.nazwisko}
          />
          <Pole
            etykieta='Stanowisko'
            value={formularz.stanowisko}
            onChange={(event) => ustawPoleFormularza('stanowisko', event.target.value)}
          />
          <Pole
            etykieta='Stawka godzinowa'
            type='number'
            min='0'
            step='0.01'
            value={formularz.stawkaGodzinowa}
            onChange={(event) => ustawPoleFormularza('stawkaGodzinowa', event.target.value)}
            bladOpisu={bledyFormularza.stawkaGodzinowa}
          />
          <Pole
            etykieta='PIN'
            value={formularz.pin}
            onChange={(event) => ustawPoleFormularza('pin', event.target.value)}
            bladOpisu={bledyFormularza.pin}
          />
          <Pole
            etykieta='Kolor avatara'
            type='color'
            value={formularz.kolorAvatara}
            onChange={(event) => ustawPoleFormularza('kolorAvatara', event.target.value)}
            className='h-11 cursor-pointer px-2'
          />
          <div className='md:col-span-2'>
            <Przelacznik
              etykieta='Pracownik aktywny'
              wartosc={formularz.aktywny}
              onZmiana={(wartosc) => ustawPoleFormularza('aktywny', wartosc)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
