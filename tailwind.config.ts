import type { Config } from 'tailwindcss';

// Paleta extraída del Excel — ver docs/01-analisis-excel.md §8.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        verde:    { DEFAULT: '#33A372', oscuro: '#30A472', claro: '#4BC490' },
        amarillo: { DEFAULT: '#F0D02B', suave: '#FDF3BA', medio: '#F2EDB9', oliva: '#DADC7C' },
        azul:     { DEFAULT: '#A5DAE6', claro: '#E4F3F8', medio: '#BEE4ED', fuerte: '#8ACCE0' },
        alerta:   '#F8D7A4',
        crema:    { DEFAULT: '#F4F2E9', calido: '#F1EDEA', arena: '#EDE5DF', borde: '#E3E3E3' },
        tinta:    { DEFAULT: '#1F1F1F', fuerte: '#1A1A1A', suave: '#6B6B63' },
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'Poppins', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
} satisfies Config;
