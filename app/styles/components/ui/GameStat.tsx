import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../../constants/colors';
import { radius, spacing } from '../../../../constants/spacing';
import { typography } from '../../../../constants/typography';

export const GameStat = ({ label, value, icon, color = colors.gold }: { label: string; value: string | number; icon: string; color?: string }) => (
  <View style={styles.container}>
    <Text style={styles.icon}>{icon}</Text>
    <Text style={[styles.value, { color }]}>{value}</Text>
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  icon: {
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});