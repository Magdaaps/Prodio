import React from 'react';

interface PropsPola extends React.InputHTMLAttributes<HTMLInputElement> {
  etykieta?: string;
  bladOpisu?: string;
  ikonaPrefix?: React.ReactNode;
  ikonaSuffix?: React.ReactNode;
}

export default function Pole({
  etykieta,
  bladOpisu,
  ikonaPrefix,
  ikonaSuffix,
  className,
  ...reszta
}: PropsPola) {
  const klasyInputa = [
    'w-full bg-tlo-glowne border rounded-lg py-2.5 text-tekst-glowny text-sm placeholder-tekst-drugorzedny focus:outline-none transition-colors',
    bladOpisu ? 'border-red-500 focus:border-red-500' : 'border-obramowanie focus:border-akcent',
    ikonaPrefix ? 'pl-10 pr-4' : 'px-4',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      {etykieta ? (
        <label className="text-tekst-drugorzedny text-sm font-medium mb-1.5 block">
          {etykieta}
        </label>
      ) : null}

      <div className="relative">
        {ikonaPrefix ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-tekst-drugorzedny">
            {ikonaPrefix}
          </div>
        ) : null}

        <input className={klasyInputa} {...reszta} />

        {ikonaSuffix ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-tekst-drugorzedny">
            {ikonaSuffix}
          </div>
        ) : null}
      </div>

      {bladOpisu ? <p className="text-red-400 text-xs mt-1">{bladOpisu}</p> : null}
    </div>
  );
}
