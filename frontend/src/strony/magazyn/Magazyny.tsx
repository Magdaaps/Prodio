import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import klientApi from '../../api/klient';
import Modal from '../../komponenty/ui/Modal';
import Pole from '../../komponenty/ui/Pole';
import Przycisk from '../../komponenty/ui/Przycisk';
import Przelacznik from '../../komponenty/ui/Przelacznik';
import type { MagazynDto, OdpowiedzApi } from './StanyMagazynowe';

const KLASY_KARTY = 'rounded-[28px] border border-slate-700 bg-[#1E2A3A] shadow-xl shadow-black/20';

export default function Magazyny() {
  const [magazyny, ustawMagazyny] = useState<MagazynDto[]>([]);
  const [ladowanie, ustawLadowanie] = useState(false);
  const [blad, ustawBlad] = useState('');
  const [czyModal, ustawCzyModal] = useState(false);
  const [nazwa, ustawNazwe] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);

  const pobierzMagazyny = async () => {
    ustawLadowanie(true);
    ustawBlad('');
    try {
      const odpowiedz = await klientApi.get<OdpowiedzApi<MagazynDto[]>>('/magazyn/magazyny');
      ustawMagazyny(odpowiedz.data.dane);
    } catch {
      ustawBlad('Nie udalo sie pobrac magazynow.');
    } finally {
      ustawLadowanie(false);
    }
  };

  useEffect(() => {
    void pobierzMagazyny();
  }, []);

  const dodaj = async () => {
    if (!nazwa.trim()) {
      ustawBlad('Podaj nazwe magazynu.');
      return;
    }
    ustawZapisywanie(true);
    try {
      await klientApi.post('/magazyn/magazyny', { nazwa: nazwa.trim() });
      ustawNazwe('');
      ustawCzyModal(false);
      await pobierzMagazyny();
    } catch {
      ustawBlad('Nie udalo sie dodac magazynu.');
    } finally {
      ustawZapisywanie(false);
    }
  };

  const aktualizuj = async (id: number, payload: { nazwa?: string; aktywny?: boolean }) => {
    try {
      await klientApi.patch(`/magazyn/magazyny/${id}`, payload);
      await pobierzMagazyny();
    } catch {
      ustawBlad('Nie udalo sie zapisac zmian magazynu.');
    }
  };

  const usun = async (id: number) => {
    if (!window.confirm('Usunac magazyn?')) return;
    try {
      await klientApi.delete(`/magazyn/magazyny/${id}`);
      await pobierzMagazyny();
    } catch {
      ustawBlad('Nie mozna usunac magazynu z transakcjami.');
      window.alert('Nie mozna usunac magazynu z transakcjami.');
    }
  };

  return (
    <div className='space-y-6 text-slate-100'>
      <section className={`${KLASY_KARTY} bg-gradient-to-br from-[#1E2A3A] via-[#182230] to-[#0f1724] p-6`}>
        <div className='flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between'>
          <div>
            <div className='mb-3 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-200'>Sprint 9</div>
            <h1 className='text-3xl font-semibold'>Magazyny</h1>
            <p className='mt-2 max-w-3xl text-sm text-slate-400'>Proste zarzadzanie lista magazynow i ich aktywnoscia.</p>
          </div>
          <Przycisk onClick={() => ustawCzyModal(true)}>
            <Plus size={16} />
            Dodaj magazyn
          </Przycisk>
        </div>
      </section>

      {blad ? <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}

      <section className={`${KLASY_KARTY} p-4`}>
        <div className='overflow-x-auto rounded-[24px] border border-slate-700 bg-slate-950/40'>
          <table className='min-w-[900px] w-full text-sm'>
            <thead className='bg-slate-950/80 text-slate-300'><tr>{['Nazwa', 'Aktywny', 'Liczba transakcji', 'Akcje'].map((label) => <th key={label} className='px-4 py-3 text-left font-medium'>{label}</th>)}</tr></thead>
            <tbody>
              {ladowanie ? <tr><td colSpan={4} className='px-4 py-10 text-center text-slate-400'>Ladowanie magazynow...</td></tr> : magazyny.length === 0 ? <tr><td colSpan={4} className='px-4 py-10 text-center text-slate-400'>Brak magazynow.</td></tr> : magazyny.map((item) => (
                <tr key={item.id} className='border-t border-slate-800 odd:bg-slate-900/20'>
                  <td className='px-4 py-3'>
                    <input defaultValue={item.nazwa} onBlur={(event) => { if (event.target.value !== item.nazwa) void aktualizuj(item.id, { nazwa: event.target.value }); }} className='w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-400' />
                  </td>
                  <td className='px-4 py-3'>
                    <Przelacznik wartosc={item.aktywny} onZmiana={(wartosc) => void aktualizuj(item.id, { aktywny: wartosc })} etykieta={item.aktywny ? 'Tak' : 'Nie'} />
                  </td>
                  <td className='px-4 py-3'>{item.liczbaTransakcji}</td>
                  <td className='px-4 py-3'>
                    <button type='button' onClick={() => void usun(item.id)} className='rounded-xl bg-red-500/10 px-3 py-2 text-red-200 hover:bg-red-500/20'>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        czyOtwarty={czyModal}
        onZamknij={() => !zapisywanie && ustawCzyModal(false)}
        tytul='Dodaj magazyn'
        akcje={
          <>
            <Przycisk wariant='drugorzedny' onClick={() => ustawCzyModal(false)} disabled={zapisywanie}>Anuluj</Przycisk>
            <Przycisk onClick={() => void dodaj()} czyLaduje={zapisywanie}>Zapisz</Przycisk>
          </>
        }
      >
        <Pole etykieta='Nazwa' value={nazwa} onChange={(event) => ustawNazwe(event.target.value)} placeholder='Np. Magazyn glowny' />
      </Modal>
    </div>
  );
}
