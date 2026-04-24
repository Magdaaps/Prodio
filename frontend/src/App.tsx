import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAutentykacja } from './hooki/useAutentykacja';
import PasekBoczny from './komponenty/PasekBoczny';

const Logowanie = lazy(() => import('./strony/Logowanie'));
const Pulpit = lazy(() => import('./strony/Pulpit'));
const Klienci = lazy(() => import('./strony/Klienci'));
const Dostawcy = lazy(() => import('./strony/Dostawcy'));
const Pracownicy = lazy(() => import('./strony/Pracownicy'));
const Produkty = lazy(() => import('./strony/Produkty'));
const FormularzProduktu = lazy(() => import('./strony/FormularzProduktu'));
const Zamowienia = lazy(() => import('./strony/Zamowienia'));
const ZamowienieZgrupowane = lazy(() => import('./strony/ZamowienieZgrupowane'));
const SzczegolyZamowienia = lazy(() => import('./strony/SzczegolyZamowienia'));
const PlanProdukcji = lazy(() => import('./strony/PlanProdukcji'));
const ZleceniaProdukcyjne = lazy(() => import('./strony/ZleceniaProdukcyjne'));
const SzczegolyZleceniaProdukcyjnego = lazy(() => import('./strony/SzczegolyZleceniaProdukcyjnego'));
const HistoriaPracy = lazy(() => import('./strony/HistoriaPracy'));
const HistoriaWejscWyjsc = lazy(() => import('./strony/HistoriaWejscWyjsc'));
const StanyMagazynowe = lazy(() => import('./strony/magazyn/StanyMagazynowe'));
const Transakcje = lazy(() => import('./strony/magazyn/Transakcje'));
const ZamowieniaDostawcow = lazy(() => import('./strony/magazyn/ZamowieniaDostawcow'));
const Magazyny = lazy(() => import('./strony/magazyn/Magazyny'));
const Uzytkownicy = lazy(() => import('./strony/ustawienia/Uzytkownicy'));
const RoleIUprawnienia = lazy(() => import('./strony/ustawienia/RoleIUprawnienia'));
const PlaceholderUstawien = lazy(() => import('./strony/ustawienia/PlaceholderUstawien'));
const Maszyny = lazy(() => import('./strony/ustawienia/Maszyny'));
const EdycjaMaszyny = lazy(() => import('./strony/ustawienia/EdycjaMaszyny'));
const PaneleMeldunkowe = lazy(() => import('./strony/ustawienia/PaneleMeldunkowe'));
const Checkin = lazy(() => import('./strony/Checkin'));
const PanelProdukcja = lazy(() => import('./strony/PanelProdukcja'));
const PanelPakowanie = lazy(() => import('./strony/PanelPakowanie'));
const PanelOperacjiTablet = lazy(() => import('./strony/PanelOperacjiTablet'));

const FallbackLadowania = (
  <div className='flex h-screen items-center justify-center text-sm text-slate-400'>
    Ładowanie...
  </div>
);

function App() {
  const czyCheckin = window.location.pathname.startsWith('/checkin');
  const czyPanelTabletowy =
    window.location.pathname.startsWith('/panel-produkcja') ||
    window.location.pathname.startsWith('/panel-pakowanie');
  const { uzytkownik, ladowanie } = useAutentykacja();

  if (czyCheckin || czyPanelTabletowy) {
    return (
      <BrowserRouter>
        <Suspense fallback={FallbackLadowania}>
          <Routes>
            <Route path='/checkin' element={<Checkin />} />
            <Route path='/panel-produkcja' element={<PanelProdukcja />} />
            <Route path='/panel-produkcja/zlecenie/:id' element={<PanelOperacjiTablet typ='PRODUKCJA' />} />
            <Route path='/panel-pakowanie' element={<PanelPakowanie />} />
            <Route path='/panel-pakowanie/zlecenie/:id' element={<PanelOperacjiTablet typ='PAKOWANIE' />} />
            <Route path='*' element={<Navigate to={czyCheckin ? '/checkin' : '/panel-produkcja'} replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  if (ladowanie) {
    return (
      <div className='flex items-center justify-center h-screen bg-tlo-glowne text-tekst-glowny'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-akcent mx-auto mb-4'></div>
          <p className='text-tekst-drugorzedny'>Ładowanie...</p>
        </div>
      </div>
    );
  }

  if (!uzytkownik) {
    return (
      <BrowserRouter>
        <Suspense fallback={FallbackLadowania}>
          <Routes>
            <Route path='/logowanie' element={<Logowanie />} />
            <Route path='*' element={<Navigate to='/logowanie' />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className='flex h-screen bg-tlo-glowne text-tekst-glowny overflow-hidden'>
        <PasekBoczny />
        <main className='flex-1 overflow-auto p-6'>
          <Suspense fallback={FallbackLadowania}>
          <Routes>
            <Route path='/' element={<Pulpit />} />
            <Route path='/produkty' element={<Produkty />} />
            <Route path='/produkty/nowy' element={<FormularzProduktu />} />
            <Route path='/produkty/:id/edytuj' element={<FormularzProduktu />} />
            <Route path='/zamowienia' element={<Zamowienia />} />
            <Route path='/zamowienia/zgrupowane' element={<ZamowienieZgrupowane />} />
            <Route path='/zamowienia/:id' element={<SzczegolyZamowienia />} />
            <Route path='/zlecenia-produkcyjne' element={<ZleceniaProdukcyjne />} />
            <Route path='/zlecenia-produkcyjne/:id' element={<SzczegolyZleceniaProdukcyjnego />} />
            <Route path='/plan-produkcji' element={<PlanProdukcji />} />
            <Route path='/historia-pracy' element={<HistoriaPracy />} />
            <Route path='/historia-wejsc-wyjsc' element={<Navigate to='/historia-wejsc-wyjsc/przeglad-zdarzen' replace />} />
            <Route path='/historia-wejsc-wyjsc/przeglad-zdarzen' element={<HistoriaWejscWyjsc widok='PRZEGLAD_ZDARZEN' />} />
            <Route path='/historia-wejsc-wyjsc/wejscia-operatorow' element={<HistoriaWejscWyjsc widok='WEJSCIA_OPERATOROW' />} />
            <Route path='/historia-wejsc-wyjsc/wyjscia-operatorow' element={<HistoriaWejscWyjsc widok='WYJSCIA_OPERATOROW' />} />
            <Route path='/historia-wejsc-wyjsc/przerwy' element={<HistoriaWejscWyjsc widok='PRZERWY' />} />
            <Route path='/historia-wejsc-wyjsc/raport-czasu' element={<HistoriaWejscWyjsc widok='RAPORT_CZASU' />} />
            <Route path='/historia-wejsc-wyjsc/karta-pracy' element={<HistoriaWejscWyjsc widok='KARTA_PRACY' />} />
            <Route path='/magazyn/stany-magazynowe' element={<StanyMagazynowe />} />
            <Route path='/magazyn/surowce' element={<StanyMagazynowe />} />
            <Route path='/magazyn/transakcje' element={<Transakcje />} />
            <Route path='/magazyn/przyjecia-magazynowe' element={<Transakcje />} />
            <Route path='/magazyn/wydania-magazynowe' element={<Transakcje />} />
            <Route path='/magazyn/korekty-remanenty' element={<Transakcje />} />
            <Route path='/magazyn/przeniesienia-magazynowe' element={<Transakcje />} />
            <Route path='/magazyn/zamowienia-dostawcow' element={<ZamowieniaDostawcow />} />
            <Route path='/magazyn/magazyny' element={<Magazyny />} />
            <Route path='/klienci' element={<Klienci />} />
            <Route path='/dostawcy' element={<Dostawcy />} />
            <Route path='/pracownicy' element={<Pracownicy />} />
            <Route path='/ustawienia/maszyny' element={<Maszyny />} />
            <Route path='/ustawienia/maszyny/:id/edytuj' element={<EdycjaMaszyny />} />
            <Route path='/ustawienia/panele-meldunkowe' element={<PaneleMeldunkowe />} />
            <Route path='/ustawienia/uzytkownicy' element={<Uzytkownicy />} />
            <Route path='/ustawienia/role-i-uprawnienia' element={<RoleIUprawnienia />} />
            <Route path='/ustawienia/integracje' element={<PlaceholderUstawien tytul='Integracje' opis='Miejsce na polaczenia z systemami zewnetrznymi, API i automatyzacje wymiany danych.' />} />
            <Route path='/ustawienia/preferencje-systemu' element={<PlaceholderUstawien tytul='Preferencje systemu' opis='Docelowo konfiguracja zachowania systemu, domyslnych ustawien i opcji lokalnych.' />} />
            <Route path='/logowanie' element={<Navigate to='/' />} />
            <Route path='*' element={<Navigate to='/' replace />} />
          </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
