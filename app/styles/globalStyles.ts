import { StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { radius, spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  containerWithPadding: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.base,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    alignItems: 'center',
  },
  // 🔥 TÍTULO PRINCIPAL MEJORADO
  headerTitle: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
    letterSpacing: 1.5,
    ...typography.textShadow.premium,
  },
  headerSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    letterSpacing: 0.3,
  },
  text: {
    color: colors.text,
    fontSize: typography.size.base,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
  },
  textSecondary: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 18,
  },
  textMuted: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 16,
  },
  
  // 🔥 INPUT MEJORADO
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    padding: spacing.base,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    fontSize: typography.size.base,
    fontFamily: typography.fontFamily.regular,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontSize: typography.size.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing['3xl'],
    marginTop: spacing['3xl'],
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.base,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});