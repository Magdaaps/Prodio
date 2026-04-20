import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import klientApi from '../../api/klient';
import Rozwijane from '../../komponenty/ui/Rozwijane';

type RolaUzytkownika = 'ADMIN' | 'MANAGER' | 'PRACOWNIK';

type Uzytkownik = {
  id: number;
  email: string;
  imie: string;
  nazwisko: string;
  rola: RolaUzytkownika;
};

const etykietyRol: Record<RolaUzytkownika, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  PRACOWNIK: 'Pracownik',
};

export default function RoleIUprawnienia() {
  const [uzytkownicy, ustawUzytkownikow] = useState<Uzytkownik[]>([]);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [blad, ustawBlad] = useState('');

  useEffect(() => {
    let anulowano = false;

    async function pobierzUzytkownikow() {
      ustawLadowanie(true);
      ustawBlad('');
      try {
        const odpowiedz = await klientApi.get<{ sukces: boolean; dane: Uzytkownik[] }>('/uzytkownicy', {
          params: { strona: 1, iloscNaStrone: 100, sortPole: 'rola', sortKierunek: 'asc' },
        });
        if (!anulowano) {
          ustawUzytkownikow(odpowiedz.data.dane);
        }
      } catch {
        if (!anulowano) {
          ustawBlad('Nie udalo sie pobrac listy uzytkownikow.');
          ustawUzytkownikow([]);
        }
      } finally {
        if (!anulowano) {
          ustawLadowanie(false);
        }
      }
    }

    void pobierzUzytkownikow();
    return () => {
      anulowano = true;
    };
  }, []);

  const grupy = useMemo(() => {
    return (['ADMIN', 'MANAGER', 'PRACOWNIK'] as RolaUzytkownika[]).map((rola) => ({
      rola,
      etykieta: etykietyRol[rola],
      uzytkownicy: uzytkownicy.filter((uzytkownik) => uzytkownik.rola === rola),
    }));
  }, [uzytkownicy]);

  const zmienRole = async (uzytkownikId: number, rola: RolaUzytkownika) => {
    try {
      await klientApi.put(`/uzytkownicy/${uzytkownikId}`, { rola });
      ustawUzytkownikow((prev) => prev.map((item) => (item.id === uzytkownikId ? { ...item, rola } : item)));
    } catch {
      ustawBlad('Nie udalo sie zaktualizowac roli uzytkownika.');
    }
  };

  return (
    <div className='space-y-6 text-slate-100'>
      <section className='rounded-[28px] border border-slate-700 bg-gradient-to-br from-[#1E2A3A] via-[#182230] to-[#0f1724] p-6 shadow-2xl shadow-black/20'>
        <div className='flex items-start gap-4'>
          <div className='rounded-2xl border border-orange-400/20 bg-orange-400/10 p-3 text-orange-200'>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className='text-3xl font-semibold'>Role i uprawnienia</h1>
            <p className='mt-2 max-w-3xl text-sm text-slate-400'>
              Grupowanie uzytkownikow wedlug roli oraz szybka zmiana poziomu dostepu.
            </p>
          </div>
        </div>
      </section>

      {blad ? <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>{blad}</div> : null}

      <section className='grid gap-4 xl:grid-cols-3'>
        {grupy.map((grupa) => (
          <article key={grupa.rola} className='rounded-[28px] border border-slate-700 bg-slate-900/70 p-5 shadow-xl shadow-black/20'>
            <div className='mb-4 flex items-center justify-between gap-3'>
              <div>
                <h2 className='text-lg font-semibold text-slate-100'>{grupa.etykieta}</h2>
                <p className='text-sm text-slate-400'>Uzytkownicy: {grupa.uzytkownicy.length}</p>
              </div>
              <span className='rounded-full bg-orange-400/10 px-3 py-1 text-xs font-medium text-orange-200'>{grupa.rola}</span>
            </div>

            <div className='space-y-3'>
              {ladowanie ? (
                <div className='rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-400'>Ladowanie uzytkownikow...</div>
              ) : grupa.uzytkownicy.length === 0 ? (
                <div className='rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-400'>Brak uzytkownikow w tej roli.</div>
              ) : (
                grupa.uzytkownicy.map((uzytkownik) => (
                  <div key={uzytkownik.id} className='rounded-2xl border border-slate-700 bg-slate-950/40 p-4'>
                    <div className='mb-3'>
                      <div className='font-medium text-slate-100'>{uzytkownik.imie} {uzytkownik.nazwisko}</div>
                      <div className='text-sm text-slate-400'>{uzytkownik.email}</div>
                    </div>
                    <Rozwijane
                      etykieta='Zmien role'
                      wartosc={uzytkownik.rola}
                      onZmiana={(wartosc) => void zmienRole(uzytkownik.id, wartosc as RolaUzytkownika)}
                      opcje={[
                        { wartosc: 'ADMIN', etykieta: 'Administrator' },
                        { wartosc: 'MANAGER', etykieta: 'Manager' },
                        { wartosc: 'PRACOWNIK', etykieta: 'Pracownik' },
                      ]}
                    />
                  </div>
                ))
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
