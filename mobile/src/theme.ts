export const colors = {
  background: '#F7FBEF',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F5E7',
  primary: '#C4FF00',
  primaryDark: '#536A00',
  primaryHover: '#A9E000',
  primarySoft: '#F2FFD0',
  blue: '#0877D1',
  blueSoft: '#E8F3FF',
  coral: '#F25F5C',
  amber: '#A9E000',
  text: '#0B0F08',
  textMuted: '#5E6958',
  line: '#DCE5CF',
  occupied: '#252C21',
} as const

export const radius = {
  small: 12,
  medium: 16,
  large: 20,
} as const

export const fonts = {
  regular: 'BricolageGrotesque_400Regular',
  medium: 'BricolageGrotesque_500Medium',
  semibold: 'BricolageGrotesque_600SemiBold',
  bold: 'BricolageGrotesque_700Bold',
  extraBold: 'BricolageGrotesque_800ExtraBold',
} as const

export const shadow = {
  shadowColor: '#0B0F08',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 3,
} as const
