/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Manrope"', '"Noto Sans SC"', 'sans-serif'],
        serif: ['"Cormorant Garamond"', '"Noto Serif SC"', 'serif'],
      },
      colors: {
        primary: {
          50: '#fef7e8',
          100: '#fdecc6',
          200: '#fbd98f',
          300: '#f9c457',
          400: '#f7b332',
          500: '#c9a961',
          600: '#d97706',
          700: '#b45309',
        },
        dark: {
          bg: '#12110f',
          card: '#1b1917',
          cardHover: '#24211e',
          border: '#2f2b28',
          divider: '#221f1c',
          muted: '#9f988f',
          text: '#f6f2ed',
          textSecondary: '#c8c1b8',
          textTertiary: '#e3ddd4',
        },
      },
      spacing: {
        '12': '12px',
        '14': '14px',
        '18': '18px',
        '22': '22px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
