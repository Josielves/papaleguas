/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#f7fbef',
          900: '#ffffff',
          800: '#f0f5e7',
          700: '#e6edda',
        },
        line: {
          700: '#dce5cf',
          600: '#c6d1b7',
        },
        amber: {
          400: '#d5ff4d',
          500: '#c4ff00',
          950: '#f2ffd0',
        },
        teal: {
          400: '#c4ff00',
          500: '#c4ff00',
          950: '#f2ffd0',
        },
        coral: {
          400: '#ff8a7d',
          500: '#ff6b5b',
          950: '#3a1512',
        },
        cream: {
          100: '#0b0f08',
        },
        mist: {
          300: '#252c21',
          400: '#5e6958',
          600: '#899482',
        },
      },
      fontFamily: {
        display: ['Bricolage Grotesque Variable', 'Bricolage Grotesque', 'system-ui', 'sans-serif'],
        body: ['Bricolage Grotesque Variable', 'Bricolage Grotesque', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: '12px',
        md: '16px',
        lg: '20px',
      },
    },
  },
  plugins: [],
}
