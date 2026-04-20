import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  History,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import { useAutentykacja } from '../hooki/useAutentykacja';
import klientApi from '../api/klient';

interface PozycjaMenu {
  nazwa: string;
  ikona: ReactNode;
  sciezka?: string;
  podmenu?: PozycjaMenu[];
}

const pozycjeMenu: PozycjaMenu[] = [
  { nazwa: 'Pulpit', ikona: <LayoutDashboard size={18} />, sciezka: '/' },
  { nazwa: 'Produkty', ikona: <Package size={18} />, sciezka: '/produkty' },
  { nazwa: 'Zamowienia', ikona: <ShoppingCart size={18} />, sciezka: '/zamowienia' },
  { nazwa: 'Zlecenia produkcyjne', ikona: <ClipboardList size={18} />, sciezka: '/zlecenia-produkcyjne' },
  { nazwa: 'Plan produkcji', ikona: <KanbanSquare size={18} />, sciezka: '/plan-produkcji' },
  { nazwa: 'Historia pracy', ikona: <History size={18} />, sciezka: '/historia-pracy' },
  { nazwa: 'Pracownicy', ikona: <Users size={18} />, sciezka: '/pracownicy' },
  {
    nazwa: 'Historia wejsc/wyjsc',
    ikona: <Clock size={18} />,
    podmenu: [
      { nazwa: 'Przeglad zdarzen', ikona: <Clock size={16} />, sciezka: '/historia-wejsc-wyjsc/przeglad-zdarzen' },
      { nazwa: 'Wejscia operatorow', ikona: <Clock size={16} />, sciezka: '/historia-wejsc-wyjsc/wejscia-operatorow' },
      { nazwa: 'Wyjscia operatorow', ikona: <Clock size={16} />, sciezka: '/historia-wejsc-wyjsc/wyjscia-operatorow' },
      { nazwa: 'Przerwy', ikona: <Clock size={16} />, sciezka: '/historia-wejsc-wyjsc/przerwy' },
      { nazwa: 'Raport czasu', ikona: <Clock size={16} />, sciezka: '/historia-wejsc-wyjsc/raport-czasu' },
      { nazwa: 'Karta pracy', ikona: <Clock size={16} />, sciezka: '/historia-wejsc-wyjsc/karta-pracy' },
    ],
  },
  {
    nazwa: 'Magazyn',
    ikona: <Warehouse size={18} />,
    podmenu: [
      { nazwa: 'Stany magazynowe', ikona: <Warehouse size={16} />, sciezka: '/magazyn/stany-magazynowe' },
      { nazwa: 'Zamowienia dostawcow', ikona: <Warehouse size={16} />, sciezka: '/magazyn/zamowienia-dostawcow' },
      { nazwa: 'Przyjecia magazynowe', ikona: <Warehouse size={16} />, sciezka: '/magazyn/przyjecia-magazynowe' },
      { nazwa: 'Wydania magazynowe', ikona: <Warehouse size={16} />, sciezka: '/magazyn/wydania-magazynowe' },
      { nazwa: 'Surowce', ikona: <Warehouse size={16} />, sciezka: '/magazyn/surowce' },
      { nazwa: 'Korekty/remanenty', ikona: <Warehouse size={16} />, sciezka: '/magazyn/korekty-remanenty' },
      { nazwa: 'Przeniesienia magazynowe', ikona: <Warehouse size={16} />, sciezka: '/magazyn/przeniesienia-magazynowe' },
      { nazwa: 'Magazyny', ikona: <Warehouse size={16} />, sciezka: '/magazyn/magazyny' },
    ],
  },
  { nazwa: 'Klienci', ikona: <Users size={18} />, sciezka: '/klienci' },
  { nazwa: 'Dostawcy', ikona: <Truck size={18} />, sciezka: '/dostawcy' },
  {
    nazwa: 'Ustawienia',
    ikona: <Settings size={18} />,
    podmenu: [
      { nazwa: 'Maszyny i operacje', ikona: <Settings size={16} />, sciezka: '/ustawienia/maszyny' },
      { nazwa: 'Panele meldunkowe', ikona: <Settings size={16} />, sciezka: '/ustawienia/panele-meldunkowe' },
      { nazwa: 'Uzytkownicy', ikona: <Settings size={16} />, sciezka: '/ustawienia/uzytkownicy' },
      { nazwa: 'Role i uprawnienia', ikona: <Settings size={16} />, sciezka: '/ustawienia/role-i-uprawnienia' },
      { nazwa: 'Integracje', ikona: <Settings size={16} />, sciezka: '/ustawienia/integracje' },
      { nazwa: 'Preferencje systemu', ikona: <Settings size={16} />, sciezka: '/ustawienia/preferencje-systemu' },
    ],
  },
];

const klasyAktywne = 'bg-akcent/10 text-akcent font-medium border-l-2 border-akcent';
const klasyNieaktywne = 'text-tekst-drugorzedny hover:bg-tlo-karta hover:text-tekst-glowny';

export default function PasekBoczny() {
  const { pathname } = useLocation();
  const { wyloguj } = useAutentykacja();
  const [otwartePodmenu, ustawOtwartePodmenu] = useState<string[]>([]);
  const [liczbaZaleglychZamowien, ustawLiczbeZaleglychZamowien] = useState(0);

  useEffect(() => {
    let anulowano = false;

    async function pobierzLiczbeZaleglych() {
      try {
        const odpowiedz = await klientApi.get<{ sukces: boolean; dane: { liczba: number } }>('/zamowienia/zalegle/liczba');
        if (!anulowano) {
          ustawLiczbeZaleglychZamowien(odpowiedz.data.dane.liczba ?? 0);
        }
      } catch {
        if (!anulowano) {
          ustawLiczbeZaleglychZamowien(0);
        }
      }
    }

    void pobierzLiczbeZaleglych();
    const interwal = window.setInterval(() => {
      void pobierzLiczbeZaleglych();
    }, 180000);

    return () => {
      anulowano = true;
      window.clearInterval(interwal);
    };
  }, []);

  const przelaczPodmenu = (nazwa: string) => {
    ustawOtwartePodmenu((poprzednie) =>
      poprzednie.includes(nazwa)
        ? poprzednie.filter((element) => element !== nazwa)
        : [...poprzednie, nazwa]
    );
  };

  const czyAktywna = (sciezka?: string) => Boolean(sciezka) && pathname === sciezka;

  return (
    <nav className='w-[240px] min-w-[240px] bg-tlo-naglowek border-r border-obramowanie h-screen flex flex-col overflow-y-auto'>
      <div className='border-b border-obramowanie px-5 py-4'>
        <h1 className='text-xl font-semibold text-tekst-glowny'>
          <span className='text-akcent'>Prodio</span> MES
        </h1>
      </div>

      <div className='flex-1 py-4'>
        {pozycjeMenu.map((pozycja) => {
          const maPodmenu = Boolean(pozycja.podmenu?.length);
          const podmenuAktywne = Boolean(pozycja.podmenu?.some((element) => czyAktywna(element.sciezka)));
          const otwarte = otwartePodmenu.includes(pozycja.nazwa) || podmenuAktywne;
          const klasyBazowe =
            'flex items-center gap-3 px-4 py-3 border-l-2 border-transparent transition-colors duration-200';

          if (!maPodmenu && pozycja.sciezka) {
            return (
              <Link
                key={pozycja.nazwa}
                to={pozycja.sciezka}
                className={`${klasyBazowe} ${czyAktywna(pozycja.sciezka) ? klasyAktywne : klasyNieaktywne}`}
              >
                {pozycja.ikona}
                <span className='flex flex-1 items-center justify-between gap-3'>
                  <span>{pozycja.nazwa}</span>
                  {pozycja.nazwa === 'Zamowienia' && liczbaZaleglychZamowien > 0 ? (
                    <span className='inline-flex min-w-6 items-center justify-center rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300'>
                      {liczbaZaleglychZamowien}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          }

          return (
            <div key={pozycja.nazwa}>
              <button
                type='button'
                onClick={() => przelaczPodmenu(pozycja.nazwa)}
                className={`${klasyBazowe} w-full justify-between ${
                  podmenuAktywne ? klasyAktywne : klasyNieaktywne
                }`}
              >
                <span className='flex items-center gap-3'>
                  {pozycja.ikona}
                  <span>{pozycja.nazwa}</span>
                </span>
                {otwarte ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>

              {otwarte && (
                <div className='mt-1 space-y-1 pb-2'>
                  {pozycja.podmenu?.map((element) => (
                    <Link
                      key={element.nazwa}
                      to={element.sciezka || '#'}
                      className={`ml-4 flex items-center gap-3 px-4 py-2.5 border-l-2 border-transparent transition-colors duration-200 ${
                        czyAktywna(element.sciezka) ? klasyAktywne : klasyNieaktywne
                      }`}
                    >
                      {element.ikona}
                      <span className='text-sm'>{element.nazwa}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className='border-t border-obramowanie p-4'>
        <button
          type='button'
          onClick={wyloguj}
          className='flex w-full items-center gap-3 rounded-md px-4 py-3 text-red-500 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-400'
        >
          <LogOut size={18} />
          <span>Wyloguj</span>
        </button>
      </div>
    </nav>
  );
}
