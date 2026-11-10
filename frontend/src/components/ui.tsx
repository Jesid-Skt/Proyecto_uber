// AI-assisted: see docs/AI_LOG.md #1.
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  type ViewProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { borders, colors, radii, shadows, spacing, typography } from '../theme/tokens';

export { colors } from '../theme/tokens';

export function Page({
  children,
  contentContainerStyle,
  ...scrollViewProps
}: ScrollViewProps & { contentContainerStyle?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        {...scrollViewProps}
        contentContainerStyle={[
          styles.page,
          { paddingBottom: spacing.pageBottom + insets.bottom },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PageHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title} adjustsFontSizeToFit minimumFontScale={0.85}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: ViewProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[styles.buttonText, variant === 'secondary' && styles.buttonSecondaryText]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, props.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Label({ children, muted = false }: React.PropsWithChildren<{ muted?: boolean }>) {
  return <Text style={muted ? styles.muted : styles.body}>{children}</Text>;
}

export const commonStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  centeredText: { textAlign: 'center' },
  mutedCentered: { color: colors.muted, fontSize: typography.caption, textAlign: 'center' },
  errorText: { color: colors.danger, fontSize: typography.label },
  errorCaption: { color: colors.danger, fontSize: typography.caption },
  successText: { color: colors.accent, fontWeight: typography.bold },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.section,
    fontWeight: typography.bold,
    marginBottom: spacing.sm,
  },
  statValue: { color: colors.ink, fontSize: 22, fontWeight: typography.bold },
  emphasisValue: { color: colors.accent, fontSize: 20, fontWeight: typography.bold },
  balanceValue: { color: colors.onAccent, fontSize: typography.display, fontWeight: typography.bold },
  balanceCaption: { color: colors.onDarkSurface, fontSize: typography.caption, lineHeight: typography.lineCaption },
  balanceCard: { backgroundColor: colors.navy, borderColor: colors.navy },
  columnGapSmall: { gap: spacing.sm },
  statusActive: { color: colors.accent, fontWeight: typography.bold },
  statusInactive: { color: colors.muted, fontWeight: typography.bold },
  countdown: { color: colors.accent, fontWeight: typography.bold, fontSize: typography.section + 2 },
  countdownCritical: { color: colors.danger },
  chip: {
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.chipSurface,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyChip: { flexBasis: '22%' },
  datePickerCard: {
    width: '100%',
    alignItems: 'center',
    overflow: 'hidden',
    padding: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.accent },
  chipText: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    textAlign: 'center',
    flexShrink: 1,
  },
  chipTextSelected: { color: colors.onAccent },
  paymentChip: { backgroundColor: 'transparent' },
  paymentChipSelected: { backgroundColor: colors.accentLight },
  paymentChipTextSelected: { color: colors.accent },
  mapCard: { padding: spacing.sm, overflow: 'hidden' },
  homeMap: { height: 245, borderRadius: radii.lg },
  historyPage: { flex: 1, backgroundColor: colors.background },
  historyHeader: { padding: spacing.page, gap: spacing.md },
  historyList: { paddingHorizontal: spacing.page, paddingBottom: spacing.pageBottom, gap: spacing.md, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  map: { height: 300, borderRadius: radii.xl },
  detailMap: { height: 280, borderRadius: radii.xl },
  tripMap: { height: 300, borderRadius: radii.xl },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { padding: spacing.page, gap: spacing.lg },
  heading: { gap: spacing.xs, marginBottom: spacing.xs },
  title: { color: colors.ink, fontSize: typography.title, fontWeight: typography.bold },
  subtitle: { color: colors.muted, fontSize: typography.subtitle, lineHeight: typography.lineBody },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: borders.hairline,
    borderColor: colors.line,
    ...shadows.card,
  },
  button: {
    minHeight: 52,
    minWidth: 0,
    flexShrink: 1,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
  },
  buttonSecondary: { backgroundColor: colors.accentLight },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    color: colors.onAccent,
    fontSize: typography.body,
    fontWeight: typography.semibold,
    textAlign: 'center',
    flexShrink: 1,
  },
  buttonSecondaryText: { color: colors.ink },
  field: { gap: spacing.xs, marginBottom: spacing.md },
  label: { color: colors.ink, fontSize: typography.caption + 1, fontWeight: typography.semibold },
  input: {
    width: '100%',
    minWidth: 0,
    minHeight: 50,
    borderWidth: borders.regular,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  error: { color: colors.danger, fontSize: typography.caption },
  body: { color: colors.ink, fontSize: typography.label, lineHeight: typography.lineBody },
  muted: { color: colors.muted, fontSize: typography.caption, lineHeight: typography.lineCaption },
});
