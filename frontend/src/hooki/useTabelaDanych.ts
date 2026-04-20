import { useState, useCallback } from 'react';

interface StanTabeliDanych {
  strona: number;
  iloscNaStrone: number;
  kluczSortowania: string;
  kierunekSortowania: 'asc' | 'desc';
}

interface WynikTabeliDanych {
  strona: number;
  iloscNaStrone: number;
  kluczSortowania: string;
  kierunekSortowania: 'asc' | 'desc';
  onZmianaStrony: (nowaStrona: number) => void;
  onSortowanie: (klucz: string, kierunek: 'asc' | 'desc') => void;
  resetujStrone: () => void;
}

export function useTabelaDanych(
  domyslnaIloscNaStrone = 20
): WynikTabeliDanych {
  const [stan, ustawStan] = useState<StanTabeliDanych>({
    strona: 1,
    iloscNaStrone: domyslnaIloscNaStrone,
    kluczSortowania: 'id',
    kierunekSortowania: 'desc'
  });

  const onZmianaStrony = useCallback((nowaStrona: number) => {
    ustawStan((poprzedni) => ({ ...poprzedni, strona: nowaStrona }));
  }, []);

  const onSortowanie = useCallback((klucz: string, kierunek: 'asc' | 'desc') => {
    ustawStan((poprzedni) => ({
      ...poprzedni,
      kluczSortowania: klucz,
      kierunekSortowania: kierunek,
      strona: 1
    }));
  }, []);

  const resetujStrone = useCallback(() => {
    ustawStan((poprzedni) => ({ ...poprzedni, strona: 1 }));
  }, []);

  return {
    ...stan,
    onZmianaStrony,
    onSortowanie,
    resetujStrone
  };
}
