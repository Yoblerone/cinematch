import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cherry: {
          950: '#1a0608',
          900: '#2d0a0f',
          800: '#4a1219',
          700: '#6b1a22',
          600: '#8b2230',
        },
        burgundy: '#800020',
        brass: {
          DEFAULT: '#b8860b',
          light: '#d4a84b',
          dark: '#8b6914',
          muted: '#6b5a2d',
        },
        cream: {
          DEFAULT: '#e8e0d5',
          light: '#f2ebe0',
        },
        antique: '#f5f5dc',
        neon: {
          gold: '#ffd700',
          rose: '#ff6b9d',
          cyan: '#00f5ff',
          amber: '#ffbf00',
          green: '#39ff14',
          blue: '#00d4ff',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'brass': '0 0 20px rgba(184, 134, 11, 0.3)',
        'neon-glow': '0 0 30px rgba(255, 215, 0, 0.4)',
        'neon-rose': '0 0 20px rgba(255, 107, 157, 0.5)',
        'neon-green': '0 0 12px rgba(57, 255, 20, 0.7)',
        'neon-blue': '0 0 12px rgba(0, 212, 255, 0.7)',
        'projector': '0 0 60px 20px rgba(255, 215, 0, 0.15)',
      },
      keyframes: {
        shimmer: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'marquee-glimmer': {
          '0%, 100%': { opacity: '1', textShadow: '0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(255,215,0,0.3)' },
          '50%': { opacity: '1', textShadow: '0 0 30px rgba(255,215,0,0.9), 0 0 60px rgba(255,215,0,0.5), 0 0 80px rgba(255,191,0,0.3)' },
        },
        'step-dot-in': {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'marquee-glimmer': 'marquee-glimmer 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
