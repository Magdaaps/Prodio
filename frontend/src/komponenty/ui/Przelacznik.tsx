interface PropsPrzelacznika {
  wartosc: boolean;
  onZmiana: (wartosc: boolean) => void;
  etykieta?: string;
  wylaczony?: boolean;
}

export default function Przelacznik({
  wartosc,
  onZmiana,
  etykieta,
  wylaczony,
}: PropsPrzelacznika) {
  const przelacz = () => {
    if (wylaczony) {
      return;
    }

    onZmiana(!wartosc);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={wartosc}
        onClick={przelacz}
        disabled={wylaczony}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          wartosc ? 'bg-akcent' : 'bg-obramowanie'
        } ${wylaczony ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
            wartosc ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      {etykieta ? (
        <span
          className="text-sm text-tekst-glowny"
          onClick={przelacz}
        >
          {etykieta}
        </span>
      ) : null}
    </div>
  );
}
