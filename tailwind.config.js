/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b1120',
          900: '#121a2e',
          800: '#1b2540',
          700: '#24304f',
        },
        line: {
          700: '#2a3655',
          600: '#384365',
        },
        amber: {
          400: '#ffc24d',
          500: '#f5a623',
          950: '#3a2a0c',
        },
        teal: {
          400: '#2dd9b5',
          500: '#17b494',
          950: '#0b2e28',
        },
        coral: {
          400: '#ff8a7d',
          500: '#ff6b5b',
          950: '#3a1512',
        },
        cream: {
          100: '#f4f1ea',
        },
        mist: {
          300: '#b7c0d8',
          400: '#8b95af',
          600: '#5b6684',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: '10px',
        md: '16px',
        lg: '24px',
      },
    },
  },
  plugins: [],
}
