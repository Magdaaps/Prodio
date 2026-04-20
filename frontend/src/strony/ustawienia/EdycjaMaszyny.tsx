import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import klientApi from '../../api/klient';
import Pole from '../../komponenty/ui/Pole';
import Przycisk from '../../komponenty/ui/Przycisk';
import Rozwijane from '../../komponenty/ui/Rozwijane';

interface Maszyna {
  id: number;
  nazwa: string;
  panelId: number | null;
  panel: { id: number; nazwa: string } | null;
  kosztRbh: number;
  kosztUstawiania: number;
  waluta: string;
  aktywna: boolean;
  maszynaKoncowa: boolean;
  kolejnosc: number;
  uwagi: string | null;
  iloscZmian: number;
  iloscGodzinDzien: number;
}

interface PanelMeldunkowy {
  id: number;
  nazwa: string;
}

interface OdpowiedzObiektu<T> {
  sukces: boolean;
  dane: T;
}

interface OdpowiedzListy<T> {
  sukces: boolean;
  dane: T[];
}

interface FormularzMaszyny {
  nazwa: string;
  panelId: string;
  aktywna: string;
  maszynaKoncowa: string;
  uwagi: string;
  kosztRbh: string;
  waluta: string;
  iloscZmian: string;
  iloscGodzinDzien: string;
  kosztUstawiania: string;
}

const DOMYSLNY_FORMULARZ: FormularzMaszyny = {
  nazwa: '',
  panelId: '',
  aktywna: 'true',
  maszynaKoncowa: 'false',
  uwagi: '',
  kosztRbh: '0',
  waluta: 'PLN',
  iloscZmian: '1',
  iloscGodzinDzien: '8',
  kosztUstawiania: '0',
};

function mapujMaszyneNaFormularz(maszyna: Maszyna): FormularzMaszyny {
  return {
    nazwa: maszyna.nazwa,
    panelId: maszyna.panelId !== null ? String(maszyna.panelId) : '',
    aktywna: String(maszyna.aktywna),
    maszynaKoncowa: String(maszyna.maszynaKoncowa),
    uwagi: maszyna.uwagi ?? '',
    kosztRbh: String(maszyna.kosztRbh ?? 0),
    waluta: maszyna.waluta || 'PLN',
    iloscZmian: String(maszyna.iloscZmian ?? 1),
    iloscGodzinDzien: String(maszyna.iloscGodzinDzien ?? 8),
    kosztUstawiania: String(maszyna.kosztUstawiania ?? 0),
  };
}

function mapujBlad(blad: unknown, domyslny: string): string {
  if (
    typeof blad === 'object' &&
    blad !== null &&
    'response' in blad &&
    typeof (blad as { response?: { data?: { wiadomosc?: unknown } } }).response?.data?.wiadomosc === 'string'
  ) {
    return (blad as { response: { data: { wiadomosc: string } } }).response.data.wiadomosc;
  }
  if (blad instanceof Error) return blad.message;
  return domyslny;
}

type ZakladkaId = 'podstawowe' | 'zaawansowane';

const klasyTextarea =
  'w-full rounded-lg border border-obramowanie bg-tlo-glowne px-4 py-2.5 text-sm text-tekst-glowny focus:border-akcent focus:outline-none resize-y min-h-[100px]';

export default function EdycjaMaszyny() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [maszyna, ustawMaszyne] = useState<Maszyna | null>(null);
  const [panele, ustawPanele] = useState<PanelMeldunkowy[]>([]);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [sukces, ustawSukces] = useState('');
  const [zakladka, ustawZakladke] = useState<ZakladkaId>('podstawowe');
  const [formularz, ustawFormularz] = useState<FormularzMaszyny>(DOMYSLNY_FORMULARZ);
  const [bledyFormularza, ustawBledyFormularza] = useState<Partial<Record<keyof FormularzMaszyny, string>>>({});

  const opcjePaneli = useMemo(
    () =>
      panele
        .map((p) => ({ wartosc: String(p.id), etykieta: p.nazwa }))
        .sort((a, b) => a.etykieta.localeCompare(b.etykieta, 'pl')),
    [panele]
  );

  const opcjeAktywne = [
    { wartosc: 'true', etykieta: 'Tak' },
    { wartosc: 'false', etykieta: 'Nie' },
  ];

  const opcjeWalut = useMemo(
    () => [
      { wartosc: 'PLN', etykieta: 'PLN' },
      { wartosc: 'EUR', etykieta: 'EUR' },
      { wartosc: 'USD', etykieta: 'USD' },
    ],
    []
  );

  const opcjeZmian = useMemo(
    () => [
      { wartosc: '1', etykieta: '1' },
      { wartosc: '2', etykieta: '2' },
      { wartosc: '3', etykieta: '3' },
    ],
    []
  );

  const opcjeGodzin = useMemo(
    () => [
      { wartosc: '8', etykieta: '8' },
      { wartosc: '10', etykieta: '10' },
      { wartosc: '12', etykieta: '12' },
    ],
    []
  );

  useEffect(() => {
    if (!id) return;
    void pobierzDane(parseInt(id));
  }, [id]);

  const pobierzDane = async (maszynaId: number) => {
    ustawLadowanie(true);
    ustawBlad('');
    try {
      const [odpMaszyny, odpPaneli] = await Promise.all([
        klientApi.get<OdpowiedzObiektu<Maszyna>>(`/maszyny/${maszynaId}`),
        klientApi.get<OdpowiedzListy<PanelMeldunkowy>>('/panele-meldunkowe', {
          params: { iloscNaStrone: 50 },
        }),
      ]);
      ustawMaszyne(odpMaszyny.data.dane);
      ustawFormularz(mapujMaszyneNaFormularz(odpMaszyny.data.dane));
      ustawPanele(odpPaneli.data.dane ?? []);
    } catch (err) {
      ustawBlad(mapujBlad(err, 'Nie udalo sie pobrac danych maszyny.'));
    } finally {
      ustawLadowanie(false);
    }
  };

  const ustawPoleFormularza = <K extends keyof FormularzMaszyny>(
    pole: K,
    wartosc: FormularzMaszyny[K]
  ) => {
    ustawFormularz((p) => ({ ...p, [pole]: wartosc }));
    ustawBledyFormularza((p) => ({ ...p, [pole]: undefined }));
    ustawSukces('');
  };

  const waliduj = () => {
    const bledy: Partial<Record<keyof FormularzMaszyny, string>> = {};
    if (!formularz.nazwa.trim()) bledy.nazwa = 'Podaj nazwe maszyny.';
    if (formularz.kosztRbh && Number(formularz.kosztRbh) < 0) bledy.kosztRbh = 'Koszt nie moze byc ujemny.';
    if (formularz.kosztUstawiania && Number(formularz.kosztUstawiania) < 0)
      bledy.kosztUstawiania = 'Koszt nie moze byc ujemny.';
    ustawBledyFormularza(bledy);
    return Object.keys(bledy).length === 0;
  };

  const zapisz = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!waliduj() || !id) return;
    ustawZapisywanie(true);
    ustawBlad('');
    ustawSukces('');
    const payload = {
      nazwa: formularz.nazwa.trim(),
      panelId: formularz.panelId ? Number(formularz.panelId) : null,
      aktywna: formularz.aktywna === 'true',
      maszynaKoncowa: formularz.maszynaKoncowa === 'true',
      uwagi: formularz.uwagi.trim() || null,
      kosztRbh: formularz.kosztRbh ? Number(formularz.kosztRbh) : 0,
      waluta: formularz.waluta,
      iloscZmian: Number(formularz.iloscZmian),
      iloscGodzinDzien: Number(formularz.iloscGodzinDzien),
      kosztUstawiania: formularz.kosztUstawiania ? Number(formularz.kosztUstawiania) : 0,
    };
    try {
      const odp = await klientApi.put<OdpowiedzObiektu<Maszyna>>(`/maszyny/${id}`, payload);
      ustawMaszyne(odp.data.dane);
      ustawSukces('Zmiany zostaly zapisane.');
    } catch (err) {
      ustawBlad(mapujBlad(err, 'Nie udalo sie zapisac zmian.'));
    } finally {
      ustawZapisywanie(false);
    }
  };

  if (ladowanie) {
    return (
      <div className='flex items-center justify-center py-24 text-tekst-drugorzedny text-sm'>
        Ladowanie danych maszyny...
      </div>
    );
  }

  if (!maszyna) {
    return (
      <div className='flex items-center justify-center py-24 text-red-400 text-sm'>
        Nie znaleziono maszyny.
      </div>
    );
  }

  const zakladki: { id: ZakladkaId; etykieta: string }[] = [
    { id: 'podstawowe', etykieta: 'PODSTAWOWE' },
    { id: 'zaawansowane', etykieta: 'ZAAWANSOWANE (OPCJONALNIE)' },
  ];

  return (
    <div>
      <div className='rounded-2xl border border-obramowanie bg-tlo-karta shadow-sm'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-obramowanie'>
          <h1 className='text-base font-semibold text-tekst-glowny'>Edytuj {maszyna.nazwa}</h1>
          <Przycisk wariant='drugorzedny' onClick={() => navigate('/ustawienia/maszyny')}>
            Wroc
          </Przycisk>
        </div>

        <div className='flex border-b border-obramowanie px-6'>
          {zakladki.map((z) => (
            <button
              key={z.id}
              type='button'
              onClick={() => ustawZakladke(z.id)}
              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${
                zakladka === z.id
                  ? 'border-akcent text-akcent'
                  : 'border-transparent text-tekst-drugorzedny hover:text-tekst-glowny'
              }`}
            >
              {z.etykieta}
            </button>
          ))}
        </div>


        <form onSubmit={zapisz}>
          <div className='p-6'>
            {blad ? (
              <div className='mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300'>
                {blad}
              </div>
            ) : null}
            {sukces ? (
              <div className='mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400'>
                {sukces}
              </div>
            ) : null}

            {zakladka === 'podstawowe' && (
              <div className='space-y-4'>
                <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
                  <div>
                    <label className='text-tekst-drugorzedny text-sm font-medium mb-1.5 block'>
                      Wybierz panel meldunkowy
                    </label>
                    <div className='relative'>
                      <select
                        className='w-full bg-tlo-glowne border border-obramowanie rounded-lg px-4 py-2.5 text-sm text-tekst-glowny focus:outline-none focus:border-akcent transition-colors appearance-none cursor-pointer pr-8'
                        value={formularz.panelId}
                        onChange={(e) => ustawPoleFormularza('panelId', e.target.value)}
                      >
                        <option value=''>Brak</option>
                        {opcjePaneli.map((o) => (
                          <option key={o.wartosc} value={o.wartosc}>
                            {o.etykieta}
                          </option>
                        ))}
                      </select>
                      {formularz.panelId ? (
                        <button
                          type='button'
                          onClick={() => ustawPoleFormularza('panelId', '')}
                          className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-red-400 hover:text-red-300 transition-colors'
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>


                  <Pole
                    etykieta='Nazwa *'
                    required
                    value={formularz.nazwa}
                    onChange={(e) => ustawPoleFormularza('nazwa', e.target.value)}
                    bladOpisu={bledyFormularza.nazwa}
                  />
                  <Rozwijane
                    etykieta='Aktywne *'
                    wartosc={formularz.aktywna}
                    onZmiana={(v) => ustawPoleFormularza('aktywna', String(v))}
                    opcje={opcjeAktywne}
                  />
                  <Rozwijane
                    etykieta='Maszyna koncowa'
                    wartosc={formularz.maszynaKoncowa}
                    onZmiana={(v) => ustawPoleFormularza('maszynaKoncowa', String(v))}
                    opcje={opcjeAktywne}
                  />
                </div>
                <div>
                  <label className='text-tekst-drugorzedny text-sm font-medium mb-1.5 block'>Uwagi</label>
                  <textarea
                    className={klasyTextarea}
                    value={formularz.uwagi}
                    onChange={(e) => ustawPoleFormularza('uwagi', e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            )}


            {zakladka === 'zaawansowane' && (
              <div className='space-y-4'>
                <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
                  <Pole etykieta='Koszt RBH' type='number' min='0' step='0.01'
                    value={formularz.kosztRbh} onChange={(e) => ustawPoleFormularza('kosztRbh', e.target.value)}
                    bladOpisu={bledyFormularza.kosztRbh} />
                  <Rozwijane etykieta='Waluty' wartosc={formularz.waluta}
                    onZmiana={(v) => ustawPoleFormularza('waluta', String(v))} opcje={opcjeWalut} />
                  <Rozwijane etykieta='Ilosc zmian' wartosc={formularz.iloscZmian}
                    onZmiana={(v) => ustawPoleFormularza('iloscZmian', String(v))} opcje={opcjeZmian} />
                  <Rozwijane etykieta='Ilosc godzin/dzien' wartosc={formularz.iloscGodzinDzien}
                    onZmiana={(v) => ustawPoleFormularza('iloscGodzinDzien', String(v))} opcje={opcjeGodzin} />
                </div>
                <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
                  <Pole etykieta='Koszt ustawiania RBH' type='number' min='0' step='0.01'
                    value={formularz.kosztUstawiania}
                    onChange={(e) => ustawPoleFormularza('kosztUstawiania', e.target.value)}
                    bladOpisu={bledyFormularza.kosztUstawiania} />
                </div>
              </div>
            )}
          </div>
          <div className='px-6 pb-6'>
            <Przycisk type='submit' czyLaduje={zapisywanie}>Zaktualizuj</Przycisk>
          </div>
        </form>
      </div>
    </div>
  );
}