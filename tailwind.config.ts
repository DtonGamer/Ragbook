import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Spacing system based on 4px base unit (0.25rem)
      spacing: {
        '0': '0rem',
        '1': '0.25rem',  // 4px
        '2': '0.5rem',   // 8px
        '3': '0.75rem',  // 12px
        '4': '1rem',     // 16px
        '5': '1.25rem',  // 20px
        '6': '1.5rem',   // 24px
        '8': '2rem',     // 32px
        '12': '3rem',    // 48px
        '16': '4rem',    // 64px
        'xs': 'var(--spacing-xs)',
        'sm': 'var(--spacing-sm)',
        'md': 'var(--spacing-md)',
        'lg': 'var(--spacing-lg)',
        'xl': 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
      },

      // Typography scale
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }], // 10px
        'xs': ['0.75rem', { lineHeight: '1rem' }],       // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],      // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],   // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],    // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],       // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],  // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],    // 36px
      },

      // Font weights
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },

      colors: {
        // Primary colors
        primary: {
          50: 'hsl(263 70% 85%)',   // Backgrounds
          100: 'hsl(263 70% 80%)',
          200: 'hsl(263 70% 70%)',
          300: 'hsl(263 70% 60%)',
          400: 'hsl(263 70% 55%)',  // Hover states
          500: 'hsl(263 70% 50%)',  // Main brand color
          600: 'hsl(263 70% 45%)',  // Active states
          700: 'hsl(263 70% 35%)',
          800: 'hsl(263 70% 25%)',
          900: 'hsl(263 70% 15%)',  // Text on light backgrounds
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // Secondary colors
        secondary: {
          300: 'hsl(217 91% 65%)',  // Hover states
          400: 'hsl(217 91% 60%)',  // Complementary brand color
          500: 'hsl(217 91% 50%)',  // Active states
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        // Neutral colors
        neutral: {
          50: 'hsl(0 0% 98%)',   // Light backgrounds
          100: 'hsl(0 0% 95%)',  // Lighter backgrounds
          200: 'hsl(0 0% 90%)',  // Subtle borders
          300: 'hsl(0 0% 80%)',  // Light borders
          400: 'hsl(0 0% 65%)',  // Medium text
          500: 'hsl(0 0% 50%)',  // Placeholder text
          600: 'hsl(0 0% 40%)',  // Secondary text
          700: 'hsl(0 0% 25%)',  // Primary text on light
          800: 'hsl(0 0% 15%)',  // Dark text
          900: 'hsl(0 0% 10%)',  // Darker text
        },
        // Status colors
        success: {
          500: 'hsl(120 60% 40%)',  // Success states
        },
        warning: {
          500: 'hsl(45 100% 50%)',  // Warning states
        },
        error: {
          500: 'hsl(0 84.2% 45%)',  // Error states
        },
        info: {
          500: 'hsl(200 100% 45%)',  // Informational states
        },
        // Existing shadcn/ui colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        // Add animations from interaction specifications
        "bounce-slow": {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        "pulse-slow": {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        "scale-in": {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        "slide-in-up": {
          '0%': { transform: 'translateY(1rem)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // Add animations from interaction specifications
        "bounce-slow": "bounce-slow 1.4s infinite",
        "pulse-slow": "pulse-slow 2s infinite",
        "scale-in": "scale-in 0.2s ease-out",
        "slide-in-up": "slide-in-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
