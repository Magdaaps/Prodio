interface PropsPrzycisku
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  wariant?: 'podstawowy' | 'drugorzedny' | 'niebezpieczny';
  rozmiar?: 'maly' | 'sredni' | 'duzy';
  czyLaduje?: boolean;
  children: React.ReactNode;
}

const klasyWariantu = {
  podstawowy: 'bg-akcent hover:bg-akcent-hover text-white',
  drugorzedny:
    'bg-tlo-karta hover:bg-obramowanie text-tekst-glowny border border-obramowanie',
  niebezpieczny: 'bg-red-600 hover:bg-red-700 text-white',
};

const klasyRozmiaru = {
  maly: 'px-3 py-1.5 text-xs',
  sredni: 'px-4 py-2 text-sm',
  duzy: 'px-6 py-3 text-base',
};

const klasyBazowe =
  'font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2';

export default function Przycisk({
  wariant = 'podstawowy',
  rozmiar = 'sredni',
  czyLaduje,
  children,
  className = '',
  disabled,
  ...props
}: PropsPrzycisku) {
  const klasy = [
    klasyBazowe,
    klasyWariantu[wariant],
    klasyRozmiaru[rozmiar],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={klasy}
      disabled={disabled || czyLaduje}
      {...props}
    >
      {czyLaduje && (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
      )}
      {children}
    </button>
  );
}
