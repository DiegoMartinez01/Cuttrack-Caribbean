
export const typography = {
  fontFamily: {
    regular: 'Inter-Regular',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 40,
  },
  
  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  
  textShadow: {
    small: {
      textShadowColor: 'rgba(0,0,0,0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    large: {
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    glow: {
      textShadowColor: 'rgba(255,107,53,0.5)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    premium: {
      textShadowColor: 'rgba(255,107,53,0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 6,
    },
  },
};