// This file is kept for tooling compatibility. The authoritative config is tailwind.config.ts
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        colgate: {
          red: '#821C24',
          dark: '#6d1720',
        },
      },
    },
  },
  plugins: [],
}
