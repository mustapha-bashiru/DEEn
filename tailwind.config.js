/**
 * Tailwind configuration, ported verbatim from the inline `tailwind.config` that
 * previously lived in a <script> tag in index.html alongside the Play CDN.
 *
 * The colour tokens that reference CSS variables (`scholar.gold`, `scholar.accent`)
 * are resolved at runtime from index.css, which is what lets the palette switch
 * between the Sunni and Shia themes.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './index.tsx', './App.tsx', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neutral: {
          dark: '#121212',
          card: '#1F1F1F',
          inner: '#262626',
          border: 'rgba(255,255,255,0.06)',
        },
        scholar: {
          gold: 'var(--primary-color)',
          accent: 'var(--accent-color)',
          green: '#10B981',
          white: '#FFFFFF',
          muted: '#737373',
          navy: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        arabic: ['Noto Sans Arabic', 'Amiri', 'serif'],
      },
    },
  },
  plugins: [],
};
