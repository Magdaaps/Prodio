export interface OpcjaRozwijanego {
  wartosc: string | number;
  etykieta: string;
}

export interface PropsRozwijanego {
  opcje: OpcjaRozwijanego[];
  wartosc: string | number | undefined;
  onZmiana: (wartosc: string | number) => void;
  etykieta?: string;
  bladOpisu?: string;
  placeholder?: string;
  wylaczone?: boolean;
  className?: string;
}

export default function Rozwijane({
  opcje,
  wartosc,
  onZmiana,
  etykieta,
  bladOpisu,
  placeholder,
  wylaczone,
  className,
}: PropsRozwijanego) {
  return (
    <div className={className}>
      {etykieta ? (
        <label className="text-tekst-drugorzedny text-sm font-medium mb-1.5 block">
          {etykieta}
        </label>
      ) : null}
      <select
        className={`w-full bg-tlo-glowne border rounded-lg px-4 py-2.5 text-sm text-tekst-glowny focus:outline-none transition-colors appearance-none cursor-pointer ${
          bladOpisu ? 'border-red-500' : 'border-obramowanie focus:border-akcent'
        } disabled:opacity-60 disabled:cursor-not-allowed`}
        value={wartosc ?? ''}
        onChange={(e) => onZmiana(e.target.value)}
        disabled={wylaczone}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {opcje.map((opcja) => (
          <option key={opcja.wartosc} value={opcja.wartosc}>
            {opcja.etykieta}
          </option>
        ))}
      </select>
      {bladOpisu ? <p className="text-red-400 text-xs mt-1">{bladOpisu}</p> : null}
    </div>
  );
}
