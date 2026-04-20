import { useEffect, useMemo, useState } from 'react';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import klientApi from '../api/klient';
import Modal from '../komponenty/ui/Modal';
import Pole from '../komponenty/ui/Pole';
import Przycisk from '../komponenty/ui/Przycisk';
import Przelacznik from '../komponenty/ui/Przelacznik';
import Rozwijane from '../komponenty/ui/Rozwijane';

type Dostawca = {
  id: number;
  nazwa: string;
  ulica: string | null;
  kodPocztowy: string | null;
  miasto: string | null;
  kraj: string | null;
  email: string | null;
  telefon: string | null;
  nip: string | null;
  osobaKontaktowa: string | null;
  aktywny: boolean;
  liczbaZamowien: number;
  liczbaSurowcow: number;
};

type SurowiecDostawcy = {
  id: number;
  cenaZakupu: number;
  waluta: string;
  surowiec: {
    id: number;
    nazwa: string;
    jednostka: string;
  };
};

type ZamowienieDostawcy = {
  id: number;
  numer: string;
  status: string;
  dataZlozenia: string;
  dataDostawy: string | null;
};

type FormularzDostawcy = {
  nazwa: string;
  osobaKontaktowa: string;
  email: string;
  telefon: string;
  nip: string;
  ulica: string;
  kodPocztowy: string;
  miasto: string;
  kraj: string;
  aktywny: boolean;
};

const pustyFormularz: FormularzDostawcy = {
  nazwa: '',
  osobaKontaktowa: '',
  email: '',
  telefon: '',
  nip: '',
  ulica: '',
  kodPocztowy: '',
  miasto: '',
  kraj: 'Polska',
  aktywny: true,
};

function formatujDate(wartosc: string | null) {
  if (!wartosc) return '--';
  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) return '--';
  return new Intl.DateTimeFormat('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(data);
}

function pobierzKomunikatBledu(blad: unknown, domyslny: string) {
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

  return domyslny;
}

function mapujNaFormularz(dostawca: Dostawca): FormularzDostawcy {
  return {
    nazwa: dostawca.nazwa,
    osobaKontaktowa: dostawca.osobaKontaktowa ?? '',
    email: dostawca.email ?? '',
    telefon: dostawca.telefon ?? '',
    nip: dostawca.nip ?? '',
    ulica: dostawca.ulica ?? '',
    kodPocztowy: dostawca.kodPocztowy ?? '',
    miasto: dostawca.miasto ?? '',
    kraj: dostawca.kraj ?? 'Polska',
    aktywny: dostawca.aktywny,
  };
}

export default function Dostawcy() {
  const [dostawcy, ustawDostawcow] = useState<Dostawca[]>([]);
  const [wybranyDostawcaId, ustawWybranyDostawcaId] = useState<number | null>(null);
  const [surowce, ustawSurowce] = useState<SurowiecDostawcy[]>([]);
  const [zamowienia, ustawZamowienia] = useState<ZamowienieDostawcy[]>([]);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [ladowanieSzczegolow, ustawLadowanieSzczegolow] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [szukaj, ustawSzukaj] = useState('');
  const [filtrAktywnosci, ustawFiltrAktywnosci] = useState('WSZYSCY');
  const [czyModal, ustawCzyModal] = useState(false);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [edytowany, ustawEdytowany] = useState<Dostawca | null>(null);
  const [formularz, ustawFormularz] = useState<FormularzDostawcy>(pustyFormularz);

  const pobierzDostawcow = async () => {
    ustawLadowanie(true);
    ustawBlad('');
    try {
      const odpowiedz = await klientApi.get<{ sukces: boolean; dane: Dostawca[] }>('/dostawcy', {
        params: {
          page: 1,
          limit: 100,
          szukaj: szukaj || undefined,
          aktywny:
            filtrAktywnosci === 'AKTYWNI' ? true : filtrAktywnosci === 'NIEAKTYWNI' ? false : undefined,
        },
      });
      ustawDostawcow(odpowiedz.data.dane);
      if (!wybranyDostawcaId && odpowiedz.data.dane[0]) {
        ustawWybranyDostawcaId(odpowiedz.data.dane[0].id);
      }
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie pobrac listy dostawcow.'));
      ustawDostawcow([]);
    } finally {
      ustawLadowanie(false);
    }
  };

  useEffect(() => {
    void pobierzDostawcow();
  }, [filtrAktywnosci, szukaj]);

  useEffect(() => {
    if (!wybranyDostawcaId) {
      ustawSurowce([]);
      ustawZamowienia([]);
      return;
    }

    let anulowano = false;

    async function pobierzSzczegoly() {
      ustawLadowanieSzczegolow(true);
      try {
        const [surowceRes, zamowieniaRes] = await Promise.all([
          klientApi.get<{ sukces: boolean; dane: SurowiecDostawcy[] }>(`/dostawcy/${wybranyDostawcaId}/surowce`),
          klientApi.get<{ sukces: boolean; dane: ZamowienieDostawcy[] }>('/magazyn/zamowienia-dostawcow', {
            params: { page: 1, limit: 20, dostawcaId: wybranyDostawcaId },
          }),
        ]);

        if (!anulowano) {
          ustawSurowce(surowceRes.data.dane);
          ustawZamowienia(zamowieniaRes.data.dane);
        }
      } catch {
        if (!anulowano) {
          ustawSurowce([]);
          ustawZamowienia([]);
        }
      } finally {
        if (!anulowano) {
          ustawLadowanieSzczegolow(false);
        }
      }
    }

    void pobierzSzczegoly();
    return () => {
      anulowano = true;
    };
  }, [wybranyDostawcaId]);

  const wybranyDostawca = useMemo(
    () => dostawcy.find((dostawca) => dostawca.id === wybranyDostawcaId) ?? null,
    [dostawcy, wybranyDostawcaId]
  );

  const otworzDodawanie = () => {
    ustawEdytowany(null);
    ustawFormularz(pustyFormularz);
    ustawCzyModal(true);
  };

  const otworzEdycje = (dostawca: Dostawca) => {
    ustawEdytowany(dostawca);
    ustawFormularz(mapujNaFormularz(dostawca));
    ustawCzyModal(true);
  };

  const zapisz = async () => {
    if (!formularz.nazwa.trim()) {
      ustawBlad('Nazwa dostawcy jest wymagana.');
      return;
    }

    ustawZapisywanie(true);
    ustawBlad('');
    try {
      if (edytowany) {
        await klientApi.patch(`/dostawcy/${edytowany.id}`, formularz);
      } else {
        await klientApi.post('/dostawcy', formularz);
      }
      ustawCzyModal(false);
      await pobierzDostawcow();
    } catch (error) {
      ustawBlad(
        pobierzKomunikatBledu(
          error,
          edytowany ? 'Nie udalo sie zapisac dostawcy.' : 'Nie udalo sie dodac dostawcy.'
        )
      );
    } finally {
      ustawZapisywanie(false);
    }
  };

  const usun = async (dostawca: Dostawca) => {
    if (!window.confirm(`Usunac dostawce ${dostawca.nazwa}?`)) return;
    try {
      await klientApi.delete(`/dostawcy/${dostawca.id}`);
      if (wybranyDostawcaId === dostawca.id) {
        ustawWybranyDostawcaId(null);
      }
      await pobierzDostawcow();
    } catch (error) {
      ustawBlad(pobierzKomunikatBledu(error, 'Nie udalo sie usunac dostawcy.'));
    }
  };

  return (
    <div className='space-y-6 text-slate-100'>
      <section className='rounded-[28px] border border-slate-700 bg-gradient-to-br from-[#1E2A3A] via-[#182230] to-[#0f1724] p-6 shadow-2xl shadow-black/20'>
        <div className='flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between'>
          <div>
            <div className='mb-3 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-200'>
              Sprint 10
            </div>
            <h1 className='text-3xl font-semibold'>Dostawcy</h1>
            <p className='mt-2 max-w-3xl text-sm text-slate-400'>
              Baza dostawcow z widokiem kontaktu, powiazanych surowcow i historii zamowien.
            </p>
          </div>
          <Przycisk onClick={otworzDodawanie}>
            <Plus size={16} />
            Dodaj dostawce
          </Przycisk>
        </div>
      </section>

      {blad ? <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}

      <section className='grid gap-6 xl:grid-cols-[1.2fr_0.8fr]'>
        <div className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
          <div className='mb-4 grid gap-4 md:grid-cols-[1fr_240px_auto]'>
            <Pole etykieta='Szukaj' value={szukaj} onChange={(event) => ustawSzukaj(event.target.value)} placeholder='Nazwa, email, telefon, kontakt' />
            <Rozwijane
              etykieta='Status'
              wartosc={filtrAktywnosci}
              onZmiana={(wartosc) => ustawFiltrAktywnosci(String(wartosc))}
              opcje={[
                { wartosc: 'WSZYSCY', etykieta: 'Wszyscy' },
                { wartosc: 'AKTYWNI', etykieta: 'Aktywni' },
                { wartosc: 'NIEAKTYWNI', etykieta: 'Nieaktywni' },
              ]}
            />
            <div className='flex items-end'>
              <div className='rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-slate-300'>
                Rekordy: <span className='font-semibold text-orange-200'>{dostawcy.length}</span>
              </div>
            </div>
          </div>

          <div className='overflow-x-auto rounded-3xl border border-slate-700 bg-slate-950/40'>
            <table className='min-w-[1080px] w-full text-sm'>
              <thead className='bg-slate-950/80 text-slate-300'>
                <tr>
                  {['Dostawca', 'Kontakt', 'Miasto', 'Surowce', 'Zamowienia', 'Status', 'Akcje'].map((label) => (
                    <th key={label} className='px-4 py-3 text-left font-medium'>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ladowanie ? (
                  <tr><td colSpan={7} className='px-4 py-10 text-center text-slate-400'>Ladowanie dostawcow...</td></tr>
                ) : dostawcy.length === 0 ? (
                  <tr><td colSpan={7} className='px-4 py-10 text-center text-slate-400'>Brak dostawcow dla wybranych filtrow.</td></tr>
                ) : (
                  dostawcy.map((dostawca) => (
                    <tr key={dostawca.id} className={`border-t border-slate-800 odd:bg-slate-900/20 ${wybranyDostawcaId === dostawca.id ? 'bg-orange-400/10' : ''}`}>
                      <td className='px-4 py-3'>
                        <button type='button' onClick={() => ustawWybranyDostawcaId(dostawca.id)} className='text-left'>
                          <div className='font-semibold text-orange-200'>{dostawca.nazwa}</div>
                          <div className='text-xs text-slate-400'>{dostawca.nip ?? 'Brak NIP'}</div>
                        </button>
                      </td>
                      <td className='px-4 py-3'>
                        <div>{dostawca.osobaKontaktowa ?? '--'}</div>
                        <div className='text-xs text-slate-400'>{dostawca.email ?? dostawca.telefon ?? '--'}</div>
                      </td>
                      <td className='px-4 py-3'>{dostawca.miasto ?? '--'}</td>
                      <td className='px-4 py-3'>{dostawca.liczbaSurowcow}</td>
                      <td className='px-4 py-3'>{dostawca.liczbaZamowien}</td>
                      <td className='px-4 py-3'>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${dostawca.aktywny ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'}`}>
                          {dostawca.aktywny ? 'Aktywny' : 'Nieaktywny'}
                        </span>
                      </td>
                      <td className='px-4 py-3'>
                        <div className='flex gap-2'>
                          <button type='button' onClick={() => otworzEdycje(dostawca)} className='rounded-xl bg-slate-800 px-2.5 py-2 text-sky-200 hover:bg-slate-700'>
                            <Pencil size={16} />
                          </button>
                          <button type='button' onClick={() => void usun(dostawca)} className='rounded-xl bg-red-500/10 px-2.5 py-2 text-red-200 hover:bg-red-500/20'>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className='space-y-6'>
          <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
            <div className='mb-4 flex items-center gap-3'>
              <div className='rounded-2xl border border-orange-400/20 bg-orange-400/10 p-3 text-orange-200'>
                <Building2 size={20} />
              </div>
              <div>
                <h2 className='text-lg font-semibold text-slate-100'>Szczegoly dostawcy</h2>
                <p className='text-sm text-slate-400'>Kontakt i dane podstawowe.</p>
              </div>
            </div>

            {!wybranyDostawca ? (
              <div className='rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-400'>
                Wybierz dostawce z tabeli po lewej stronie.
              </div>
            ) : (
              <div className='space-y-4 text-sm'>
                <div>
                  <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>Nazwa</p>
                  <p className='mt-1 text-base font-semibold text-slate-100'>{wybranyDostawca.nazwa}</p>
                </div>
                <div>
                  <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>Osoba kontaktowa</p>
                  <p className='mt-1 text-slate-200'>{wybranyDostawca.osobaKontaktowa ?? '--'}</p>
                </div>
                <div>
                  <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>Email</p>
                  <p className='mt-1 text-slate-200'>{wybranyDostawca.email ?? '--'}</p>
                </div>
                <div>
                  <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>Telefon</p>
                  <p className='mt-1 text-slate-200'>{wybranyDostawca.telefon ?? '--'}</p>
                </div>
                <div>
                  <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>Adres</p>
                  <p className='mt-1 text-slate-200'>
                    {[wybranyDostawca.ulica, wybranyDostawca.kodPocztowy, wybranyDostawca.miasto, wybranyDostawca.kraj].filter(Boolean).join(', ') || '--'}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
            <h2 className='text-lg font-semibold text-slate-100'>Powiazane surowce</h2>
            <div className='mt-4 space-y-3'>
              {ladowanieSzczegolow ? (
                <div className='rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-400'>Ladowanie surowcow...</div>
              ) : surowce.length === 0 ? (
                <div className='rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-400'>Brak powiazanych surowcow.</div>
              ) : (
                surowce.map((rekord) => (
                  <div key={rekord.id} className='rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3'>
                    <div className='font-medium text-slate-100'>{rekord.surowiec.nazwa}</div>
                    <div className='mt-1 text-sm text-slate-400'>{rekord.cenaZakupu.toFixed(2)} {rekord.waluta} / {rekord.surowiec.jednostka}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
            <h2 className='text-lg font-semibold text-slate-100'>Historia zamowien</h2>
            <div className='mt-4 space-y-3'>
              {ladowanieSzczegolow ? (
                <div className='rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-400'>Ladowanie zamowien...</div>
              ) : zamowienia.length === 0 ? (
                <div className='rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-400'>Brak zamowien dla dostawcy.</div>
              ) : (
                zamowienia.map((zamowienie) => (
                  <div key={zamowienie.id} className='rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3'>
                    <div className='flex items-center justify-between gap-3'>
                      <div className='font-medium text-slate-100'>{zamowienie.numer}</div>
                      <span className='inline-flex rounded-full bg-sky-500/15 px-3 py-1 text-xs font-medium text-sky-300'>{zamowienie.status}</span>
                    </div>
                    <div className='mt-2 text-sm text-slate-400'>Zlozone: {formatujDate(zamowienie.dataZlozenia)} • Dostawa: {formatujDate(zamowienie.dataDostawy)}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </section>

      <Modal
        czyOtwarty={czyModal}
        onZamknij={() => !zapisywanie && ustawCzyModal(false)}
        tytul={edytowany ? 'Edytuj dostawce' : 'Dodaj dostawce'}
        rozmiar='duzy'
        akcje={
          <>
            <Przycisk wariant='drugorzedny' onClick={() => ustawCzyModal(false)} disabled={zapisywanie}>Anuluj</Przycisk>
            <Przycisk onClick={() => void zapisz()} czyLaduje={zapisywanie}>Zapisz</Przycisk>
          </>
        }
      >
        <div className='grid gap-4 md:grid-cols-2'>
          <Pole etykieta='Nazwa*' value={formularz.nazwa} onChange={(event) => ustawFormularz((prev) => ({ ...prev, nazwa: event.target.value }))} />
          <Pole etykieta='Osoba kontaktowa' value={formularz.osobaKontaktowa} onChange={(event) => ustawFormularz((prev) => ({ ...prev, osobaKontaktowa: event.target.value }))} />
          <Pole etykieta='Email' value={formularz.email} onChange={(event) => ustawFormularz((prev) => ({ ...prev, email: event.target.value }))} />
          <Pole etykieta='Telefon' value={formularz.telefon} onChange={(event) => ustawFormularz((prev) => ({ ...prev, telefon: event.target.value }))} />
          <Pole etykieta='NIP' value={formularz.nip} onChange={(event) => ustawFormularz((prev) => ({ ...prev, nip: event.target.value }))} />
          <Pole etykieta='Ulica' value={formularz.ulica} onChange={(event) => ustawFormularz((prev) => ({ ...prev, ulica: event.target.value }))} />
          <Pole etykieta='Kod pocztowy' value={formularz.kodPocztowy} onChange={(event) => ustawFormularz((prev) => ({ ...prev, kodPocztowy: event.target.value }))} />
          <Pole etykieta='Miasto' value={formularz.miasto} onChange={(event) => ustawFormularz((prev) => ({ ...prev, miasto: event.target.value }))} />
          <Pole etykieta='Kraj' value={formularz.kraj} onChange={(event) => ustawFormularz((prev) => ({ ...prev, kraj: event.target.value }))} />
          <div className='rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3'>
            <Przelacznik wartosc={formularz.aktywny} onZmiana={(wartosc) => ustawFormularz((prev) => ({ ...prev, aktywny: wartosc }))} etykieta='Dostawca aktywny' />
          </div>
        </div>
      </Modal>
    </div>
  );
}
