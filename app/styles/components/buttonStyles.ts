import { StyleSheet } from 'react-native';
import { colors } from '../../../constants/colors';
import { radius, spacing } from '../../../constants/spacing';
import { typography } from '../../../constants/typography';

export const buttonStyles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1.5,
    backgroundColor: 'transparent', // 🔥 Fondo transparente
  },
  compact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
    borderWidth: 1.5,
    backgroundColor: 'transparent', // 🔥 Fondo transparente
  },
  
  // 🔥 TODAS las variantes ahora son transparentes con borde del color correspondiente
  primary: {
    borderColor: colors.primary,
  },
  secondary: {
    borderColor: colors.textSecondary,
  },
  danger: {
    borderColor: colors.error,
  },
  game: {
    borderColor: colors.primary,
  },
  edit: {
    borderColor: colors.primary,
  },
  activate: {
    borderColor: colors.success,
  },
  deactivate: {
    borderColor: colors.warning,
  },
  delete: {
    borderColor: colors.error,
  },
  archive: {
    borderColor: colors.warning,
  },
  restore: {
    borderColor: colors.success,
  },
  
  // Textos - ahora del color del borde
  text: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as any,
    letterSpacing: 0.5,
    fontFamily: typography.fontFamily.semibold,
  },
  textCompact: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as any,
    letterSpacing: 0.3,
    fontFamily: typography.fontFamily.semibold,
  },
  textPrimary: {
    color: colors.primary,
  },
  textSecondary: {
    color: colors.textSecondary,
  },
});