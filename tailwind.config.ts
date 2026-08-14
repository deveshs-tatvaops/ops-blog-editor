import type { Config } from 'tailwindcss';

/**
 * Design tokens lifted from the live ops.withtatva.ai landing page:
 * cream page ground, orange primary, deep-indigo contrast sections.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#FDF7F1',
          50: '#FFFCF9',
          100: '#FDF7F1',
          200: '#F8ECE1',
          300: '#F0E3D8',
        },
        brand: {
          50: '#FFF3EA',
          100: '#FFE3D0',
          200: '#FFC6A1',
          300: '#FFA76F',
          400: '#FF8A42',
          500: '#F26522',
          600: '#DE521A',
          700: '#B33F13',
          800: '#8A300F',
          900: '#66230B',
        },
        ink: {
          DEFAULT: '#1F2130',
          muted: '#6B6F80',
          faint: '#9AA0B0',
        },
        indigo950: '#141345',
        indigo900: '#1D1C5C',
        line: '#F0E3D8',
        ok: '#1F9D63',
        warn: '#D98A00',
        bad: '#D64545',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-poppins)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(95deg,#FF9A1F 0%,#F2451E 100%)',
        'logo-gradient':
          'linear-gradient(90deg,#F2451E 0%,#D62A6B 30%,#8B2BC4 60%,#2F6BFF 100%)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(31,33,48,.04), 0 8px 24px rgba(31,33,48,.06)',
        pop: '0 12px 40px rgba(31,33,48,.12)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
