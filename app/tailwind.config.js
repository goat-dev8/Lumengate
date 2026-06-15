/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Stripe-inspired tokens (DESIGN.md) */
        primary: {
          DEFAULT: '#007dfc',
          deep: '#012b54',
          press: '#012b54',
          soft: '#3d9bff',
        },
        ink: {
          DEFAULT: '#0d253d',
          secondary: '#273951',
          mute: '#64748b',
        },
        canvas: {
          DEFAULT: '#ffffff',
          soft: '#f6f9fc',
          cream: '#f5e9d4',
        },
        hairline: '#e3e8ee',
        'brand-dark': {
          900: '#1c1e54',
        },
        /* Legacy aliases — map to Stripe tokens */
        navy: {
          DEFAULT: '#0d253d',
          light: '#273951',
        },
        brand: {
          DEFAULT: '#007dfc',
          light: '#3d9bff',
        },
        accent: {
          DEFAULT: '#b9b9f9',
          muted: '#665efd',
        },
        slate: {
          ink: '#0d253d',
          muted: '#64748b',
          line: '#e3e8ee',
        },
        status: {
          ok: '#15803d',
          warn: '#b45309',
          err: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['"Inter Tight"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(13, 37, 61, 0.04), 0 4px 16px rgba(13, 37, 61, 0.06)',
        glow: '0 0 0 1px rgba(83, 58, 253, 0.12), 0 8px 32px rgba(83, 58, 253, 0.15)',
        'glow-lg': '0 0 0 1px rgba(83, 58, 253, 0.08), 0 20px 60px rgba(0, 55, 112, 0.12)',
      },
      animation: {
        'fade-up': 'fadeUp 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        'slide-in': 'slideIn 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
  safelist: [
    'bg-canvas-soft',
    'bg-brand-dark-900',
    'text-ink',
    'text-ink-mute',
    'text-primary-deep',
    'bg-primary',
    'bg-primary-press',
    'border-hairline',
    'divide-hairline',
    'hover:bg-canvas-soft',
  ],
};
