import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { GripVertical, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import klientApi from '../../api/klient';
import Modal from '../../komponenty/ui/Modal';
import Pole from '../../komponenty/ui/Pole';
import Przycisk from '../../komponenty/ui/Przycisk';
import Przelacznik from '../../komponenty/ui/Przelacznik';
import Rozwijane from '../../komponenty/ui/Rozwijane';

interface Maszyna {
  id: number;
  nazwa: string;
  panelId: number | null;
  panel: {
    id: number;
    nazwa: string;
  } | null;
  kosztRbh: number;
  kosztUstawiania: number;
  waluta: string;
  aktywna: boolean;
  maszynaKoncowa: boolean;
  kolejnosc: number;
}

interface PanelMeldunkowy {
  id: number;
  nazwa: string;
}

interface OdpowiedzListy<T> {
  sukces: boolean;
  dane: T[];
  lacznie?: number;
  wiadomosc?: string;
}

interface FormularzMaszyny {
  nazwa: string;
  panelId: string;
  kosztRbh: string;
  kosztUstawiania: string;
  waluta: string;
  aktywna: boolean;
  maszynaKoncowa: boolean;
}

const DOMYSLNY_FORMULARZ: FormularzMaszyny = {
  nazwa: '',
  panelId: '',
  kosztRbh: '',
  kosztUstawiania: '',
  waluta: 'PLN',
  aktywna: true,
  maszynaKoncowa: false,
};

function mapujBlad(blad: unknown, domyslnyKomunikat: string): string {
  if (
    typeof blad === 'object' &&
    blad !== null &&
    'response' in blad &&
    typeof (blad as { response?: { data?: { wiadomosc?: unknown } } }).response?.data?.wiadomosc ===
      'string'
  ) {
    return (blad as { response: { data: { wiadomosc: string } } }).response.data.wiadomosc;
  }

  if (blad instanceof Error) {
    return blad.message;
  }

  return domyslnyKomunikat;
}

function uporzadkujMaszyny(maszyny: Maszyna[]) {
  return [...maszyny].sort((a, b) => a.kolejnosc - b.kolejnosc || a.id - b.id);
}

function formatujKoszt(wartosc: number, waluta: string) {
  return `${Number(wartosc ?? 0).toFixed(2)} ${waluta}`;
}

export default function Maszyny() {
  const navigate = useNavigate();
  const [maszyny, ustawMaszyny] = useState<Maszyna[]>([]);
  const [panele, ustawPanele] = useState<PanelMeldunkowy[]>([]);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [zapisywanieKolejnosci, ustawZapisywanieKolejnosci] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [czyModalOtwarty, ustawCzyModalOtwarty] = useState(false);
  const [edytowanaMaszyna, ustawEdytowanaMaszyne] = useState<Maszyna | null>(null);
  const [formularz, ustawFormularz] = useState<FormularzMaszyny>(DOMYSLNY_FORMULARZ);
  const [bledyFormularza, ustawBledyFormularza] = useState<Partial<Record<keyof FormularzMaszyny, string>>>({});

  const opcjePaneli = useMemo(
    () => [
      { wartosc: '', etykieta: 'Brak' },
      ...panele
        .map((panel) => ({ wartosc: String(panel.id), etykieta: panel.nazwa }))
        .sort((a, b) => a.etykieta.localeCompare(b.etykieta, 'pl')),
    ],
    [panele]
  );

  const opcjeWalut = useMemo(
    () => [
      { wartosc: 'PLN', etykieta: 'PLN' },
      { wartosc: 'EUR', etykieta: 'EUR' },
      { wartosc: 'USD', etykieta: 'USD' },
    ],
    []
  );

  const aktywneMaszyny = useMemo(() => maszyny.filter((maszyna) => maszyna.aktywna).length, [maszyny]);
  const maszynyKoncowe = useMemo(
    () => maszyny.filter((maszyna) => maszyna.maszynaKoncowa).length,
    [maszyny]
  );

  const pobierzDane = async () => {
    ustawLadowanie(true);
    ustawBlad('');

    try {
      const [odpowiedzMaszyn, odpowiedzPaneli] = await Promise.all([
        klientApi.get<OdpowiedzListy<Maszyna>>('/maszyny'),
        klientApi.get<OdpowiedzListy<PanelMeldunkowy>>('/panele-meldunkowe', {
          params: { iloscNaStrone: 50 },
        }),
      ]);

      ustawMaszyny(uporzadkujMaszyny(odpowiedzMaszyn.data.dane ?? []));
      ustawPanele(odpowiedzPaneli.data.dane ?? []);
    } catch (bladPobierania) {
      ustawBlad(mapujBlad(bladPobierania, 'Nie udalo sie pobrac listy maszyn i paneli meldunkowych.'));
      ustawMaszyny([]);
      ustawPanele([]);
    } finally {
      ustawLadowanie(false);
    }
  };

  useEffect(() => {
    void pobierzDane();
  }, []);

  const otworzDodawanie = () => {
    ustawEdytowanaMaszyne(null);
    ustawFormularz(DOMYSLNY_FORMULARZ);
    ustawBledyFormularza({});
    ustawCzyModalOtwarty(true);
  };

  const zamknijModal = () => {
    if (zapisywanie) {
      return;
    }

    ustawCzyModalOtwarty(false);
    ustawEdytowanaMaszyne(null);
    ustawFormularz(DOMYSLNY_FORMULARZ);
    ustawBledyFormularza({});
  };

  const ustawPoleFormularza = <K extends keyof FormularzMaszyny>(pole: K, wartosc: FormularzMaszyny[K]) => {
    ustawFormularz((poprzedni) => ({ ...poprzedni, [pole]: wartosc }));
    ustawBledyFormularza((poprzednie) => ({ ...poprzednie, [pole]: undefined }));
  };

  const walidujFormularz = () => {
    const noweBledy: Partial<Record<keyof FormularzMaszyny, string>> = {};

    if (!formularz.nazwa.trim()) {
      noweBledy.nazwa = 'Podaj nazwe maszyny.';
    }

    if (formularz.kosztRbh && Number(formularz.kosztRbh) < 0) {
      noweBledy.kosztRbh = 'Koszt RBH nie moze byc ujemny.';
    }

    if (formularz.kosztUstawiania && Number(formularz.kosztUstawiania) < 0) {
      noweBledy.kosztUstawiania = 'Koszt ustawiania nie moze byc ujemny.';
    }

    ustawBledyFormularza(noweBledy);
    return Object.keys(noweBledy).length === 0;
  };

  const zapiszMaszyne = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!walidujFormularz()) {
      return;
    }

    ustawZapisywanie(true);
    ustawBlad('');

    const payload = {
      nazwa: formularz.nazwa.trim(),
      panelId: formularz.panelId ? Number(formularz.panelId) : null,
      kosztRbh: formularz.kosztRbh ? Number(formularz.kosztRbh) : 0,
      kosztUstawiania: formularz.kosztUstawiania ? Number(formularz.kosztUstawiania) : 0,
      waluta: formularz.waluta,
      aktywna: formularz.aktywna,
      maszynaKoncowa: formularz.maszynaKoncowa,
    };

    try {
      if (edytowanaMaszyna) {
        await klientApi.put(`/maszyny/${edytowanaMaszyna.id}`, payload);
      } else {
        await klientApi.post('/maszyny', payload);
      }

      zamknijModal();
      await pobierzDane();
    } catch (bladZapisu) {
      ustawBlad(
        mapujBlad(
          bladZapisu,
          edytowanaMaszyna ? 'Nie udalo sie zapisac zmian maszyny.' : 'Nie udalo sie dodac maszyny.'
        )
      );
    } finally {
      ustawZapisywanie(false);
    }
  };

  const usunMaszyne = async (maszyna: Maszyna) => {
    const potwierdzone = window.confirm(`Usunac maszyne ${maszyna.nazwa}?`);

    if (!potwierdzone) {
      return;
    }

    ustawBlad('');

    try {
      await klientApi.delete(`/maszyny/${maszyna.id}`);
      await pobierzDane();
    } catch (bladUsuwania) {
      ustawBlad(mapujBlad(bladUsuwania, 'Nie udalo sie usunac maszyny.'));
    }
  };

  const zapiszNowaKolejnosc = async (uporzadkowaneMaszyny: Maszyna[]) => {
    const poprzednieMaszyny = maszyny;
    ustawMaszyny(uporzadkowaneMaszyny);
    ustawZapisywanieKolejnosci(true);
    ustawBlad('');

    try {
      const zmienioneMaszyny = uporzadkowaneMaszyny.filter(
        (maszyna) => poprzednieMaszyny.find((element) => element.id === maszyna.id)?.kolejnosc !== maszyna.kolejnosc
      );

      await Promise.all(
        zmienioneMaszyny.map((maszyna) =>
          klientApi.patch(`/maszyny/${maszyna.id}`, {
            kolejnosc: maszyna.kolejnosc,
          })
        )
      );

      ustawMaszyny(
        uporzadkowaneMaszyny.map((maszyna, indeks) => ({
          ...maszyna,
          kolejnosc: indeks + 1,
        }))
      );
    } catch (bladZapisu) {
      ustawMaszyny(poprzednieMaszyny);
      ustawBlad(mapujBlad(bladZapisu, 'Nie udalo sie zapisac nowej kolejnosci maszyn.'));
    } finally {
      ustawZapisywanieKolejnosci(false);
    }
  };

  const obsluzPrzenoszenie = (wynik: DropResult) => {
    if (!wynik.destination || wynik.destination.index === wynik.source.index || zapisywanieKolejnosci) {
      return;
    }

    const nowaLista = [...maszyny];
    const [przenoszonaMaszyna] = nowaLista.splice(wynik.source.index, 1);
    nowaLista.splice(wynik.destination.index, 0, przenoszonaMaszyna);

    const maszynyZNowaKolejnoscia = nowaLista.map((maszyna, indeks) => ({
      ...maszyna,
      kolejnosc: indeks + 1,
    }));

    void zapiszNowaKolejnosc(maszynyZNowaKolejnoscia);
  };

  return (
    <div className='space-y-6'>
      <section className='rounded-2xl border border-obramowanie bg-tlo-karta p-6 shadow-sm'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='space-y-2'>
            <div className='inline-flex items-center gap-2 rounded-full border border-obramowanie bg-tlo-glowne px-3 py-1 text-xs uppercase tracking-[0.22em] text-tekst-drugorzedny'>
              <Settings2 size={14} />
              Ustawienia MES
            </div>
            <div>
              <h1 className='text-3xl font-semibold text-tekst-glowny'>Maszyny i operacje</h1>
              <p className='mt-2 max-w-2xl text-sm text-tekst-drugorzedny'>
                Konfiguracja gniazd produkcyjnych, paneli meldunkowych oraz kolejnosci operacji w systemie MES.
              </p>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <div className='rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-2 text-sm text-tekst-drugorzedny'>
              Aktywne: <span className='font-semibold text-tekst-glowny'>{aktywneMaszyny}</span> / {maszyny.length}
            </div>
            <div className='rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-2 text-sm text-tekst-drugorzedny'>
              Koncowe: <span className='font-semibold text-tekst-glowny'>{maszynyKoncowe}</span>
            </div>
            <Przycisk onClick={otworzDodawanie}>
              <Plus size={16} />
              Dodaj maszyne
            </Przycisk>
          </div>
        </div>
      </section>

      {blad ? (
        <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300'>
          {blad}
        </div>
      ) : null}

      <section className='rounded-2xl border border-obramowanie bg-tlo-karta p-6 shadow-sm'>
        <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h2 className='text-lg font-semibold text-tekst-glowny'>Lista maszyn</h2>
            <p className='text-sm text-tekst-drugorzedny'>
              Przeciagaj wiersze, aby zmienic kolejnosc operacji.
            </p>
          </div>
          {zapisywanieKolejnosci ? (
            <div className='text-sm text-tekst-drugorzedny'>Zapisywanie kolejnosci...</div>
          ) : null}
        </div>

        {ladowanie ? (
          <div className='rounded-xl border border-obramowanie bg-tlo-glowne px-4 py-8 text-center text-sm text-tekst-drugorzedny'>
            Ladowanie maszyn...
          </div>
        ) : maszyny.length === 0 ? (
          <div className='rounded-xl border border-dashed border-obramowanie bg-tlo-glowne px-4 py-8 text-center text-sm text-tekst-drugorzedny'>
            Brak zdefiniowanych maszyn.
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <DragDropContext onDragEnd={obsluzPrzenoszenie}>
              <table className='min-w-full border-separate border-spacing-0'>
                <thead>
                  <tr className='text-left text-xs uppercase tracking-[0.18em] text-tekst-drugorzedny'>
                    <th className='border-b border-obramowanie px-3 py-3'>Uchwyt</th>
                    <th className='border-b border-obramowanie px-3 py-3'>Panel meldunkowy</th>
                    <th className='border-b border-obramowanie px-3 py-3'>Nazwa</th>
                    <th className='border-b border-obramowanie px-3 py-3'>Aktywna</th>
                    <th className='border-b border-obramowanie px-3 py-3'>Maszyna koncowa</th>
                    <th className='border-b border-obramowanie px-3 py-3'>Koszt RBH</th>
                    <th className='border-b border-obramowanie px-3 py-3'>Koszt ustawiania</th>
                    <th className='border-b border-obramowanie px-3 py-3'>Waluta</th>
                    <th className='border-b border-obramowanie px-3 py-3 text-right'>Akcje</th>
                  </tr>
                </thead>
                <Droppable droppableId='maszyny'>
                  {(provided) => (
                    <tbody ref={provided.innerRef} {...provided.droppableProps}>
                      {maszyny.map((maszyna, indeks) => (
                        <Draggable
                          key={maszyna.id}
                          draggableId={String(maszyna.id)}
                          index={indeks}
                          isDragDisabled={zapisywanieKolejnosci}
                        >
                          {(providedDraggable, snapshot) => (
                            <tr
                              ref={providedDraggable.innerRef}
                              {...providedDraggable.draggableProps}
                              className={`transition-colors ${
                                snapshot.isDragging ? 'bg-akcent/5' : 'bg-transparent'
                              }`}
                            >
                              <td className='border-b border-obramowanie px-3 py-3 align-middle'>
                                <button
                                  type='button'
                                  {...providedDraggable.dragHandleProps}
                                  className='rounded-md border border-obramowanie p-2 text-tekst-drugorzedny transition-colors hover:border-akcent hover:text-akcent'
                                  aria-label={`Przenies maszyne ${maszyna.nazwa}`}
                                >
                                  <GripVertical size={16} />
                                </button>
                              </td>
                              <td className='border-b border-obramowanie px-3 py-3 text-sm text-tekst-glowny'>
                                {maszyna.panel?.nazwa ?? '-'}
                              </td>
                              <td className='border-b border-obramowanie px-3 py-3'>
                                <div className='space-y-1'>
                                  <div className='font-medium text-tekst-glowny'>{maszyna.nazwa}</div>
                                  <div className='text-xs text-tekst-drugorzedny'>Pozycja: {maszyna.kolejnosc}</div>
                                </div>
                              </td>
                              <td className='border-b border-obramowanie px-3 py-3'>
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                    maszyna.aktywna
                                      ? 'bg-emerald-500/15 text-emerald-400'
                                      : 'bg-slate-500/15 text-slate-400'
                                  }`}
                                >
                                  {maszyna.aktywna ? 'Aktywna' : 'Nieaktywna'}
                                </span>
                              </td>
                              <td className='border-b border-obramowanie px-3 py-3'>
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                    maszyna.maszynaKoncowa
                                      ? 'bg-orange-500/15 text-orange-300'
                                      : 'bg-slate-500/15 text-slate-400'
                                  }`}
                                >
                                  {maszyna.maszynaKoncowa ? 'Tak' : 'Nie'}
                                </span>
                              </td>
                              <td className='border-b border-obramowanie px-3 py-3 text-sm text-tekst-glowny'>
                                {formatujKoszt(maszyna.kosztRbh, 'PLN')}
                              </td>
                              <td className='border-b border-obramowanie px-3 py-3 text-sm text-tekst-glowny'>
                                {formatujKoszt(maszyna.kosztUstawiania, 'PLN')}
                              </td>
                              <td className='border-b border-obramowanie px-3 py-3 text-sm text-tekst-glowny'>
                                {maszyna.waluta}
                              </td>
                              <td className='border-b border-obramowanie px-3 py-3'>
                                <div className='flex items-center justify-end gap-2'>
                                  <button
                                    type='button'
                                    onClick={() => navigate(`/ustawienia/maszyny/${maszyna.id}/edytuj`)}
                                    className='rounded-md border border-obramowanie p-2 text-tekst-drugorzedny transition-colors hover:border-akcent hover:text-akcent'
                                    aria-label={`Edytuj maszyne ${maszyna.nazwa}`}
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    type='button'
                                    onClick={() => void usunMaszyne(maszyna)}
                                    className='rounded-md border border-obramowanie p-2 text-tekst-drugorzedny transition-colors hover:border-red-500 hover:text-red-400'
                                    aria-label={`Usun maszyne ${maszyna.nazwa}`}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </tbody>
                  )}
                </Droppable>
              </table>
            </DragDropContext>
          </div>
        )}
      </section>

      <Modal
        czyOtwarty={czyModalOtwarty}
        onZamknij={zamknijModal}
        tytul={edytowanaMaszyna ? 'Edytuj maszyne' : 'Dodaj maszyne'}
        akcje={
          <>
            <Przycisk wariant='drugorzedny' onClick={zamknijModal} disabled={zapisywanie}>
              Anuluj
            </Przycisk>
            <Przycisk form='formularz-maszyny' type='submit' czyLaduje={zapisywanie}>
              {edytowanaMaszyna ? 'Zapisz zmiany' : 'Dodaj maszyne'}
            </Przycisk>
          </>
        }
      >
        <form id='formularz-maszyny' className='grid gap-4 md:grid-cols-2' onSubmit={zapiszMaszyne}>
          <div className='md:col-span-2'>
            <Pole
              etykieta='Nazwa'
              required
              value={formularz.nazwa}
              onChange={(event) => ustawPoleFormularza('nazwa', event.target.value)}
              bladOpisu={bledyFormularza.nazwa}
            />
          </div>
          <Rozwijane
            etykieta='Panel meldunkowy'
            wartosc={formularz.panelId}
            onZmiana={(wartosc) => ustawPoleFormularza('panelId', String(wartosc))}
            opcje={opcjePaneli}
          />
          <Rozwijane
            etykieta='Waluta'
            wartosc={formularz.waluta}
            onZmiana={(wartosc) => ustawPoleFormularza('waluta', String(wartosc))}
            opcje={opcjeWalut}
          />
          <Pole
            etykieta='Koszt RBH'
            type='number'
            min='0'
            step='0.01'
            value={formularz.kosztRbh}
            onChange={(event) => ustawPoleFormularza('kosztRbh', event.target.value)}
            bladOpisu={bledyFormularza.kosztRbh}
          />
          <Pole
            etykieta='Koszt ustawiania'
            type='number'
            min='0'
            step='0.01'
            value={formularz.kosztUstawiania}
            onChange={(event) => ustawPoleFormularza('kosztUstawiania', event.target.value)}
            bladOpisu={bledyFormularza.kosztUstawiania}
          />
          <div className='md:col-span-2 grid gap-4'>
            <Przelacznik
              etykieta='Maszyna aktywna'
              wartosc={formularz.aktywna}
              onZmiana={(wartosc) => ustawPoleFormularza('aktywna', wartosc)}
            />
            <Przelacznik
              etykieta='Maszyna koncowa'
              wartosc={formularz.maszynaKoncowa}
              onZmiana={(wartosc) => ustawPoleFormularza('maszynaKoncowa', wartosc)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
