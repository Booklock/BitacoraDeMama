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
        // Acentos de estado. Los del Excel (#DADC7C, #F2EDB9…) se conservan
        // como relleno suave, pero no se distinguen entre sí: comprado y
        // pendiente quedan a ΔE 8.4 en visión normal, por debajo del umbral
        // de 15. Estos tonos sí pasan la validación y van como punto sólido
        // junto a la etiqueta de texto, que nunca falta.
        estado: {
          comprado:  '#2E8B63',
          pendiente: '#A8760A',
          deseo:     '#A84A8F',
          apartado:  '#3D7FD1',
        },
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'Poppins', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
} satisfies Config;
