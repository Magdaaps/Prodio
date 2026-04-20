import React, { useState } from 'react';
import { useAutentykacja } from '../hooki/useAutentykacja';

export default function Logowanie() {
  const [email, ustawEmail] = useState('');
  const [haslo, ustawHaslo] = useState('');
  const [blad, ustawBlad] = useState('');
  const [czyLaduje, ustawCzyLaduje] = useState(false);
  const { zaloguj } = useAutentykacja();

  const obsluzZaloguj = async (e: React.FormEvent) => {
    e.preventDefault();
    ustawBlad('');
    ustawCzyLaduje(true);

    try {
      await zaloguj(email, haslo);
      window.location.href = '/';
    } catch {
      ustawBlad('Nieprawidłowy email lub hasło. Spróbuj ponownie.');
    } finally {
      ustawCzyLaduje(false);
    }
  };

  return (
    <div className='min-h-screen bg-tlo-glowne flex items-center justify-center p-4'>
      <div className='w-full max-w-md'>
        <div className='bg-tlo-karta rounded-2xl shadow-2xl p-8'>
          <div className='text-center mb-8'>
            <h1 className='text-3xl font-bold text-tekst-glowny'>
              <span className='text-akcent'>Prodio</span> MES
            </h1>
            <p className='text-tekst-drugorzedny mt-2 text-sm'>System zarządzania produkcją</p>
          </div>

          <form onSubmit={obsluzZaloguj} className='space-y-5'>
            {blad && (
              <div className='bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm'>
                {blad}
              </div>
            )}

            <div>
              <label className='block text-tekst-drugorzedny text-sm font-medium mb-1.5'>
                Email
              </label>
              <input
                type='email'
                value={email}
                onChange={(e) => ustawEmail(e.target.value)}
                placeholder='admin@prodio.pl'
                required
                className='w-full bg-tlo-glowne border border-obramowanie rounded-lg px-4 py-2.5 text-tekst-glowny placeholder-tekst-drugorzedny focus:outline-none focus:border-akcent transition-colors'
              />
            </div>

            <div>
              <label className='block text-tekst-drugorzedny text-sm font-medium mb-1.5'>
                Hasło
              </label>
              <input
                type='password'
                value={haslo}
                onChange={(e) => ustawHaslo(e.target.value)}
                placeholder='••••••••'
                required
                className='w-full bg-tlo-glowne border border-obramowanie rounded-lg px-4 py-2.5 text-tekst-glowny placeholder-tekst-drugorzedny focus:outline-none focus:border-akcent transition-colors'
              />
            </div>

            <button
              type='submit'
              disabled={czyLaduje}
              className='w-full bg-akcent hover:bg-akcent-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2'
            >
              {czyLaduje ? (
                <>
                  <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                  Logowanie...
                </>
              ) : (
                'Zaloguj się'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
