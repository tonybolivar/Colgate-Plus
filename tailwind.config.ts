import type { Config } from 'tailwindcss'

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
} satisfies Config
