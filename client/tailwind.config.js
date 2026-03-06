/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // 启用基于 class 的 dark 模式
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans SC"', 'sans-serif'],
        serif: ['"Noto Serif SC"', 'serif'],
      },
      colors: {
        // 档案风格颜色 - 琥珀色系
        primary: {
          50: '#fef7e8',
          100: '#fdecc6',
          200: '#fbd98f',
          300: '#f9c457',
          400: '#f7b332',
          500: '#c9a961', // Archive Gold
          600: '#d97706', // Amber-600
          700: '#b45309',
        },
        // 柔和的淡灰色深色模式配色 - 更浅的色阶
        dark: {
          bg: '#2A2A2C',         // 主背景 - 更浅
          card: '#363638',       // 卡片背景 - 更浅
          cardHover: '#424244',  // 卡片悬停状态
          border: '#464648',     // 边框颜色 - 更浅
          divider: '#323234',    // 分隔线
          muted: '#98989D',      // 次要文字 - 更浅
          text: '#F8F8F8',       // 主要文字 - 更亮
          textSecondary: '#B8B8BD', // 次要文字 - 更浅
          textTertiary: '#D4D4D8',  // 三级文字 - 更浅
        },
      },
      spacing: {
        '12': '12px',
        '14': '14px',
        '18': '18px',
        '22': '22px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
