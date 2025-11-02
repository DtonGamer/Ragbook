// Design Tokens for RAG Book Application
// Based on UX Research Report

// Color Tokens
export const colorTokens = {
  // Primary Colors
  primary: {
    50: 'hsl(263 70% 95%)',   // Lightest
    100: 'hsl(263 70% 85%)',
    200: 'hsl(263 70% 75%)',
    300: 'hsl(263 70% 65%)',
    400: 'hsl(263 70% 55%)',
    500: 'hsl(263 70% 50%)',  // Default
    600: 'hsl(263 70% 45%)',
    700: 'hsl(263 70% 35%)',
    800: 'hsl(263 70% 25%)',
    900: 'hsl(263 70% 15%)',  // Darkest
  },
  
  // Secondary Colors
  secondary: {
    50: 'hsl(217 91% 95%)',
    100: 'hsl(217 91% 85%)',
    200: 'hsl(217 91% 75%)',
    300: 'hsl(217 91% 65%)',
    400: 'hsl(217 91% 60%)',  // Default
    500: 'hsl(217 91% 50%)',
    600: 'hsl(217 91% 45%)',
    700: 'hsl(217 91% 35%)',
    800: 'hsl(217 91% 25%)',
    900: 'hsl(217 91% 15%)',
  },
  
  // Neutral Colors
  neutral: {
    50: 'hsl(0 0% 98%)',    // Lightest
    100: 'hsl(0 0% 95%)',
    200: 'hsl(0 0% 90%)',
    300: 'hsl(0 0% 80%)',
    400: 'hsl(0 0% 65%)',
    500: 'hsl(0 0% 50%)',   // Medium
    600: 'hsl(0 0% 40%)',
    700: 'hsl(0 0% 25%)',
    800: 'hsl(0 0% 15%)',
    900: 'hsl(0 0% 10%)',   // Darkest
    950: 'hsl(0 0% 5%)',    // Darkest
  },
  
  // Status Colors
  success: {
    50: 'hsl(120 40% 95%)',
    100: 'hsl(120 40% 85%)',
    200: 'hsl(120 40% 75%)',
    300: 'hsl(120 40% 65%)',
    400: 'hsl(120 40% 55%)',
    500: 'hsl(120 60% 40%)',  // Default
    600: 'hsl(120 60% 35%)',
    700: 'hsl(120 60% 25%)',
    800: 'hsl(120 60% 15%)',
    900: 'hsl(120 60% 10%)',
  },
  
  warning: {
    50: 'hsl(45 100% 95%)',
    100: 'hsl(45 100% 85%)',
    200: 'hsl(45 100% 75%)',
    300: 'hsl(45 100% 65%)',
    400: 'hsl(45 100% 55%)',
    500: 'hsl(45 100% 50%)',  // Default
    600: 'hsl(45 100% 40%)',
    700: 'hsl(45 100% 30%)',
    800: 'hsl(45 100% 20%)',
    900: 'hsl(45 100% 10%)',
  },
  
  error: {
    50: 'hsl(0 84.2% 95%)',
    100: 'hsl(0 84.2% 85%)',
    200: 'hsl(0 84.2% 75%)',
    300: 'hsl(0 84.2% 65%)',
    400: 'hsl(0 84.2% 55%)',
    500: 'hsl(0 84.2% 45%)',  // Default
    600: 'hsl(0 84.2% 40%)',
    700: 'hsl(0 84.2% 30%)',
    800: 'hsl(0 84.2% 20%)',
    900: 'hsl(0 84.2% 10%)',
  },
  
  info: {
    50: 'hsl(200 100% 95%)',
    100: 'hsl(200 100% 85%)',
    200: 'hsl(200 100% 75%)',
    300: 'hsl(200 100% 65%)',
    400: 'hsl(200 100% 55%)',
    500: 'hsl(200 100% 45%)',  // Default
    600: 'hsl(200 100% 40%)',
    700: 'hsl(200 100% 30%)',
    800: 'hsl(200 100% 20%)',
    900: 'hsl(200 100% 10%)',
  },
};

// Typography Tokens
export const typographyTokens = {
  // Font Families
  fontFamily: {
    heading: 'var(--font-heading)',
    body: 'var(--font-body)',
  },
  
  // Font Sizes
  fontSize: {
    '2xs': '0.625rem',  // 10px
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
    '6xl': '3.75rem',   // 60px
  },
  
  // Font Weights
  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
  
  // Line Heights
  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },
  
  // Letter Spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
};

// Spacing Tokens
export const spacingTokens = {
  // Spacing Scale (in rem)
  0: '0rem',           // 0px
  0.5: '0.125rem',     // 2px
  1: '0.25rem',        // 4px
  1.5: '0.375rem',     // 6px
  2: '0.5rem',         // 8px
  2.5: '0.625rem',     // 10px
  3: '0.75rem',        // 12px
  3.5: '0.875rem',     // 14px
  4: '1rem',           // 16px
  5: '1.25rem',        // 20px
  6: '1.5rem',         // 24px
  7: '1.75rem',        // 28px
  8: '2rem',           // 32px
  9: '2.25rem',        // 36px
  10: '2.5rem',        // 40px
  11: '2.75rem',       // 44px
  12: '3rem',          // 48px
  14: '3.5rem',        // 56px
  16: '4rem',          // 64px
  20: '5rem',          // 80px
  24: '6rem',          // 96px
  28: '7rem',          // 112px
  32: '8rem',          // 128px
  36: '9rem',          // 144px
  40: '10rem',         // 160px
  44: '11rem',         // 176px
  48: '12rem',         // 192px
  52: '13rem',         // 208px
  56: '14rem',         // 224px
  60: '15rem',         // 240px
  64: '16rem',         // 256px
  72: '18rem',         // 288px
  80: '20rem',         // 320px
  96: '24rem',         // 384px
};

// Border Tokens
export const borderTokens = {
  radius: {
    none: '0px',
    sm: '0.125rem',    // 2px
    base: '0.25rem',   // 4px
    md: '0.375rem',    // 6px
    lg: '0.5rem',      // 8px
    xl: '0.75rem',     // 12px
    '2xl': '1rem',     // 16px
    '3xl': '1.5rem',   // 24px
    full: '9999px',
  },
  
  width: {
    0: '0px',
    1: '1px',
    2: '2px',
    4: '4px',
    8: '8px',
  },
};

// Shadow Tokens
export const shadowTokens = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: '0 0 #0000',
};

// Animation Tokens
export const animationTokens = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  
  easing: {
    ease: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
    easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
};

// Component Tokens
export const componentTokens = {
  // Button Sizes
  button: {
    height: {
      sm: '2rem',      // 32px
      md: '2.5rem',    // 40px
      lg: '3rem',      // 48px
    },
    padding: {
      sm: '0.5rem 1rem',
      md: '0.75rem 1.5rem',
      lg: '1rem 2rem',
    },
  },
  
  // Input Sizes
  input: {
    height: {
      sm: '2rem',      // 32px
      md: '2.5rem',    // 40px
      lg: '3rem',      // 48px
    },
    padding: {
      sm: '0.5rem 0.75rem',
      md: '0.75rem 1rem',
      lg: '1rem 1.25rem',
    },
  },
  
  // Card Sizes
  card: {
    padding: {
      sm: '1rem',
      md: '1.5rem',
      lg: '2rem',
    },
    radius: 'var(--radius)',
  },
  
  // Avatar Sizes
  avatar: {
    size: {
      xs: '1.5rem',    // 24px
      sm: '2rem',      // 32px
      md: '2.5rem',    // 40px
      lg: '3rem',      // 48px
      xl: '4rem',      // 64px
    },
  },
};