import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'tlo-glowne': '#1E2A3A',
        'tlo-karta': '#243447',
        'tlo-naglowek': '#1A2535',
        'akcent': '#F97316',
        'akcent-hover': '#EA6C0A',
        'tekst-glowny': '#F1F5F9',
        'tekst-drugorzedny': '#94A3B8',
        'obramowanie': '#334155'
      }
    }
  },
  plugins: []
} satisfies Config;
