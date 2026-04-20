import { useEffect } from 'react';

interface PropsModalu {
  czyOtwarty: boolean;
  onZamknij: () => void;
  tytul: string;
  children: React.ReactNode;
  akcje?: React.ReactNode;
  rozmiar?: 'maly' | 'sredni' | 'duzy' | 'bardzoDuzy';
}

const klasySzerokosci = {
  maly: 'max-w-sm',
  sredni: 'max-w-lg',
  duzy: 'max-w-2xl',
  bardzoDuzy: 'max-w-7xl',
};

export default function Modal({
  czyOtwarty,
  onZamknij,
  tytul,
  children,
  akcje,
  rozmiar = 'sredni',
}: PropsModalu) {
  useEffect(() => {
    if (!czyOtwarty) {
      return;
    }

    document.body.classList.add('overflow-hidden');

    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [czyOtwarty]);

  useEffect(() => {
    const obsluzKlawisz = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && czyOtwarty) {
        onZamknij();
      }
    };

    window.addEventListener('keydown', obsluzKlawisz);

    return () => {
      window.removeEventListener('keydown', obsluzKlawisz);
    };
  }, [czyOtwarty, onZamknij]);

  if (!czyOtwarty) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onZamknij}
      />

      <div
        className={[
          'relative w-full bg-tlo-karta rounded-2xl shadow-2xl border border-obramowanie max-h-[90vh] flex flex-col',
          klasySzerokosci[rozmiar],
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="flex items-center justify-between p-6 border-b border-obramowanie">
          <h2 className="text-lg font-semibold text-tekst-glowny">{tytul}</h2>

          <button
            type="button"
            onClick={onZamknij}
            className="text-tekst-drugorzedny hover:text-tekst-glowny transition-colors"
            aria-label="Zamknij modal"
          >
            x
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1">{children}</div>

        {akcje ? (
          <div className="flex justify-end gap-3 p-6 border-t border-obramowanie">
            {akcje}
          </div>
        ) : null}
      </div>
    </div>
  );
}
