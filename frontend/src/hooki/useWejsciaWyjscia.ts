import { useEffect, useState } from 'react';
import klientApi from '../api/klient';

export type TypPauzy = 'CZYSZCZENIE' | 'JEDZENIE' | 'TOALETA' | 'PRZERWA_REGULAMINOWA' | 'INNE';
export type TypAnalizyKalendarza = 'WEJSCIE' | 'WYJSCIE' | 'CZAS_PRACY';

export interface PracownikBasic {
  id: number;
  imie: string;
  nazwisko: string;
  aktywny: boolean;
  stanowisko?: string | null;
}

export interface OdpowiedzStronicowana<T> {
  dane: T[];
  total: number;
  strona: number;
  limit: number;
}

export interface RejestracjaCzasu {
  id: number;
  pracownikId: number;
  pracownik: PracownikBasic;
  wejscie: string;
  wyjscie: string | null;
  wejscieWyglad: string | null;
  wyjscieWyglad: string | null;
  zmiana: string | null;
  nadgodziny: number;
  nadgodzinyMinuty: number;
  czasPracyMinuty: number;
  czasBezPauzMinuty: number;
  czasPauzyMinuty: number;
  pauzaProcent: number;
}

export interface HistoriaPauzy {
  id: number;
  pracownikId: number;
  pracownik: PracownikBasic;
  powod: string | null;
  typPauzy: TypPauzy;
  czasStart: string;
  czasStop: string | null;
  geolokalizacja: string | null;
  ip: string | null;
  czasPauzySekundy: number;
  czasPauzyMinuty: number;
}

export interface DzienWolny {
  id: number;
  pracownikId: number;
  pracownik: PracownikBasic;
  data: string;
  dataStr: string;
  dzienTygodnia: string;
  przyczyna: string | null;
  zatwierdzony: boolean;
}

export interface DzienKartyPracy {
  data: string;
  dzien: number;
  wejscie: string | null;
  wejscieWyglad: string | null;
  wyjscie: string | null;
  wyjscieWyglad: string | null;
  czasPracyMinuty: number;
  czasWygladzonyMinuty: number;
  nadgodziny: number;
  nadgodzinyMinuty: number;
  zmiana: string | null;
  dzienWolny: boolean;
}

export interface KartaPracy {
  pracownik: PracownikBasic;
  dni: DzienKartyPracy[];
  sumy: {
    czasPracyMinuty: number;
    czasWygladzonyMinuty: number;
    nadgodziny: number;
    nadgodzinyMinuty: number;
    liczbaDniWolnych: number;
  };
  rok: number;
  miesiac: number;
}

export interface KalendarzWejscWyjsc {
  pracownicy: PracownikBasic[];
  dni: number[];
  macierz: Record<number, Record<number, string>>;
  rok: number;
  miesiac: number;
  typAnalizy: TypAnalizyKalendarza;
}

export interface FiltryRejestracji {
  page?: number;
  limit?: number;
  pracownikId?: string;
  dataOd?: string;
  dataDo?: string;
  zmiana?: string;
}

export interface FiltryPauz {
  page?: number;
  limit?: number;
  pracownikId?: string;
  typPauzy?: TypPauzy | '';
  dataOd?: string;
  dataDo?: string;
}

export interface FiltryDniWolnych {
  rok: number;
  miesiac: number;
}

export interface FiltryKartyPracy {
  pracownikId: string;
  rok: number;
  miesiac: number;
}

export interface FiltryKalendarza {
  rok: number;
  miesiac: number;
  typAnalizy: TypAnalizyKalendarza;
}

function wyczyscPuste<T extends object>(params: T) {
  return Object.fromEntries(
    Object.entries(params as Record<string, unknown>).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  );
}

export function useWejsciaWyjscia() {
  const [pracownicy, ustawPracownikow] = useState<PracownikBasic[]>([]);
  const [ladowaniePracownikow, ustawLadowaniePracownikow] = useState(true);

  useEffect(() => {
    let anulowano = false;

    async function pobierzPracownikow() {
      ustawLadowaniePracownikow(true);

      try {
        const odpowiedz = await klientApi.get<{
          dane: PracownikBasic[];
          lacznie: number;
          strona: number;
          iloscNaStrone: number;
        }>('/pracownicy', {
          params: {
            strona: 1,
            iloscNaStrone: 200,
            sortPole: 'nazwisko',
            sortKierunek: 'asc',
          },
        });

        if (!anulowano) {
          ustawPracownikow(odpowiedz.data.dane ?? []);
        }
      } catch {
        if (!anulowano) {
          ustawPracownikow([]);
        }
      } finally {
        if (!anulowano) {
          ustawLadowaniePracownikow(false);
        }
      }
    }

    void pobierzPracownikow();

    return () => {
      anulowano = true;
    };
  }, []);

  return {
    pracownicy,
    ladowaniePracownikow,
    pobierzRejestracje: async (filtry: FiltryRejestracji) => {
      const odpowiedz = await klientApi.get<OdpowiedzStronicowana<RejestracjaCzasu>>('/wejscia-wyjscia', {
        params: wyczyscPuste(filtry),
      });
      return odpowiedz.data;
    },
    pobierzPauzy: async (filtry: FiltryPauz) => {
      const odpowiedz = await klientApi.get<OdpowiedzStronicowana<HistoriaPauzy>>('/wejscia-wyjscia/pauzy', {
        params: wyczyscPuste(filtry),
      });
      return odpowiedz.data;
    },
    pobierzDniWolne: async (filtry: FiltryDniWolnych) => {
      const odpowiedz = await klientApi.get<DzienWolny[]>('/wejscia-wyjscia/dni-wolne', {
        params: wyczyscPuste(filtry),
      });
      return odpowiedz.data;
    },
    dodajDzienWolny: async (payload: { pracownikId: number; data: string; przyczyna: string }) => {
      const odpowiedz = await klientApi.post<DzienWolny>('/wejscia-wyjscia/dni-wolne', payload);
      return odpowiedz.data;
    },
    usunDzienWolny: async (id: number) => {
      await klientApi.delete(`/wejscia-wyjscia/dni-wolne/${id}`);
    },
    pobierzKartePracy: async (filtry: FiltryKartyPracy) => {
      const odpowiedz = await klientApi.get<KartaPracy>('/wejscia-wyjscia/karta-pracy', {
        params: wyczyscPuste(filtry),
      });
      return odpowiedz.data;
    },
    pobierzKalendarz: async (filtry: FiltryKalendarza) => {
      const odpowiedz = await klientApi.get<KalendarzWejscWyjsc>('/wejscia-wyjscia/kalendarz', {
        params: wyczyscPuste(filtry),
      });
      return odpowiedz.data;
    },
  };
}
