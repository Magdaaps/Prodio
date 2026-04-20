import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Uzytkownik } from '../typy/indeks';
import klientApi from '../api/klient';

export function useAutentykacja() {
  const [uzytkownik, ustawUzytkownik] = useState<Uzytkownik | null>(null);
  const [ladowanie, ustawLadowanie] = useState(true);

  const pobierzUzytkownika = useCallback(async () => {
    try {
      const odpowiedz = await axios.get<{ sukces: boolean; dane: Uzytkownik }>(
        '/api/autentykacja/mnie',
        { withCredentials: true }
      );
      ustawUzytkownik(odpowiedz.data.dane);
    } catch {
      ustawUzytkownik(null);
    } finally {
      ustawLadowanie(false);
    }
  }, []);

  useEffect(() => {
    pobierzUzytkownika();
  }, [pobierzUzytkownika]);

  const zaloguj = async (email: string, haslo: string) => {
    const odpowiedz = await klientApi.post<{ sukces: boolean; dane: Uzytkownik }>(
      '/autentykacja/zaloguj',
      { email, haslo }
    );
    ustawUzytkownik(odpowiedz.data.dane);
    return odpowiedz.data.dane;
  };

  const wyloguj = async () => {
    await klientApi.post('/autentykacja/wyloguj');
    ustawUzytkownik(null);
    window.location.href = '/logowanie';
  };

  return { uzytkownik, ladowanie, zaloguj, wyloguj };
}
