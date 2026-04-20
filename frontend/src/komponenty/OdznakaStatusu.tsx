import { StatusZamowienia, StatusZlecenia } from '../typy/indeks';

const KOLORY_STATUSOW_ZAMOWIEN: Record<StatusZamowienia, string> = {
  NOWE: 'bg-blue-500',
  W_REALIZACJI: 'bg-orange-500',
  GOTOWE: 'bg-green-500',
  WYDANE: 'bg-teal-500',
  ZAMKNIETE: 'bg-gray-500',
  ANULOWANE: 'bg-red-500',
  WSTRZYMANE: 'bg-yellow-500',
  OCZEKUJE: 'bg-purple-500',
  PRZETERMINOWANE: 'bg-red-700',
};

const KOLORY_STATUSOW_ZLECEN: Record<StatusZlecenia, string> = {
  STOP: 'bg-gray-900',
  W_TOKU: 'bg-blue-500',
  PAUZA: 'bg-gray-500',
  GOTOWE: 'bg-green-500',
  ANULOWANE: 'bg-red-500',
};

const ETYKIETY_STATUSOW_ZAMOWIEN: Record<StatusZamowienia, string> = {
  NOWE: 'Nowe',
  W_REALIZACJI: 'W realizacji',
  GOTOWE: 'Gotowe',
  WYDANE: 'Wydane',
  ZAMKNIETE: 'Zamknięte',
  ANULOWANE: 'Anulowane',
  WSTRZYMANE: 'Wstrzymane',
  OCZEKUJE: 'Oczekuje',
  PRZETERMINOWANE: 'Przeterminowane',
};

const ETYKIETY_STATUSOW_ZLECEN: Record<StatusZlecenia, string> = {
  STOP: 'Stop',
  W_TOKU: 'W toku',
  PAUZA: 'Pauza',
  GOTOWE: 'Gotowe',
  ANULOWANE: 'Anulowane',
};

interface PropsOdznakiStatusu {
  status: StatusZamowienia | StatusZlecenia;
  typ: 'zamowienie' | 'zlecenie';
}

export default function OdznakaStatusu({ status, typ }: PropsOdznakiStatusu) {
  const kolorKlasy =
    typ === 'zamowienie'
      ? KOLORY_STATUSOW_ZAMOWIEN[status as StatusZamowienia]
      : KOLORY_STATUSOW_ZLECEN[status as StatusZlecenia];

  const etykieta =
    typ === 'zamowienie'
      ? ETYKIETY_STATUSOW_ZAMOWIEN[status as StatusZamowienia]
      : ETYKIETY_STATUSOW_ZLECEN[status as StatusZlecenia];

  return (
    <span className={`${kolorKlasy} text-white text-xs font-medium px-2 py-0.5 rounded-full`}>
      {etykieta}
    </span>
  );
}
