import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: '#4A90D9',
        success: '#5CB85C',
        warning: '#F0AD4E',
        danger: '#D9534F',
        background: '#F5F5F5',
        surface: '#FFFFFF',
        'text-primary': '#333333',
        'text-secondary': '#666666',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      spacing: {
        // Kiosk uses larger spacing for elderly-friendly touch targets
        // Minimum 80px touch targets (unit-10 = 80px)
        'unit-1': '8px',
        'unit-2': '16px',
        'unit-3': '24px',
        'unit-4': '32px',
        'unit-5': '40px',
        'unit-6': '48px',
        'unit-8': '64px',
        'unit-10': '80px', // Minimum touch target
        'unit-12': '96px',
        'unit-16': '128px',
      },
      borderRadius: {
        card: '16px',
        button: '12px',
      },
      boxShadow: {
        card: '0 4px 12px rgba(0,0,0,0.15)',
      },
      fontSize: {
        // Larger font sizes for elderly readability
        base: ['1.25rem', { lineHeight: '1.5' }], // 20px base
        lg: ['1.5rem', { lineHeight: '1.4' }], // 24px
        xl: ['1.75rem', { lineHeight: '1.3' }], // 28px
        '2xl': ['2rem', { lineHeight: '1.3' }], // 32px
        '3xl': ['2.5rem', { lineHeight: '1.2' }], // 40px
        '4xl': ['3rem', { lineHeight: '1.2' }], // 48px
      },
    },
  },
  plugins: [],
} satisfies Config
