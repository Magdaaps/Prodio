export interface Uzytkownik {
  id: number;
  email: string;
  imie: string;
  nazwisko: string;
  rola: 'ADMIN' | 'MANAGER' | 'PRACOWNIK';
  aktywny: boolean;
}

export interface Klient {
  id: number;
  nazwa: string;
  ulica: string | null;
  miasto: string | null;
  kodPocztowy: string | null;
  wojewodztwo: string | null;
  kraj: string | null;
  email: string | null;
  telefon: string | null;
  nip: string | null;
  aktywny: boolean;
  dostepB2b: boolean;
  loginB2b: string | null;
  hasloB2b: string | null;
  utworzonyW: string;
}

export type StatusZamowienia =
  | 'NOWE'
  | 'W_REALIZACJI'
  | 'GOTOWE'
  | 'WYDANE'
  | 'ZAMKNIETE'
  | 'ANULOWANE'
  | 'WSTRZYMANE'
  | 'OCZEKUJE'
  | 'PRZETERMINOWANE';

export type StatusZlecenia = 'STOP' | 'W_TOKU' | 'PAUZA' | 'GOTOWE' | 'ANULOWANE';

export interface KolumnaTabeliDanych<T> {
  klucz: keyof T | string;
  naglowek: string;
  sortowalny?: boolean;
  szerokosc?: string;
  renderuj?: (wiersz: T) => React.ReactNode;
}

export interface PropsTabeliDanych<T> {
  kolumny: KolumnaTabeliDanych<T>[];
  dane: T[];
  ladowanie?: boolean;
  stronaPaginacji?: number;
  iloscNaStrone?: number;
  lacznie?: number;
  onZmianaStrony?: (strona: number) => void;
  onSortowanie?: (klucz: string, kierunek: 'asc' | 'desc') => void;
  wybraneDane?: T[];
  onWybierzWszystkie?: (zaznaczone: boolean) => void;
}

export interface OdpowiedzApi<T> {
  dane: T;
  wiadomosc?: string;
  sukces: boolean;
}
