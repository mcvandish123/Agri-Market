import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { signedPct } from '@/lib/format';
import { colors, radius, shadow, space, type } from '@/theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={type.h2}>{title}</Text>
      {subtitle ? <Text style={[type.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** Green for a rise, red for a fall, grey for no change or unknown. */
export function ChangeBadge({ pct }: { pct: number | null }) {
  const tone = pct == null || pct === 0 ? 'flat' : pct > 0 ? 'up' : 'down';
  const bg = tone === 'up' ? colors.greenSoft : tone === 'down' ? colors.redSoft : colors.muted;
  const fg = tone === 'up' ? colors.greenDark : tone === 'down' ? colors.red : colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{pct == null ? '—' : signedPct(pct, 1)}</Text>
    </View>
  );
}

export function Tag({ label, tone = 'green' }: { label: string; tone?: 'green' | 'grey' | 'amber' }) {
  const bg = tone === 'green' ? colors.greenSoft : tone === 'amber' ? colors.amberSoft : colors.muted;
  const fg = tone === 'green' ? colors.greenDark : tone === 'amber' ? colors.amber : colors.textMuted;
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && { backgroundColor: colors.green }]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon = 'arrow-forward',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, (disabled || pressed) && { opacity: disabled ? 0.45 : 0.85 }]}
    >
      <Text style={styles.buttonText}>{label}</Text>
      <Ionicons name={icon} size={18} color="#fff" />
    </Pressable>
  );
}

/** Small label above a value (e.g. PRICE/KG  ₱60.15). */
export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  const color = tone === 'up' ? colors.greenDark : tone === 'down' ? colors.red : colors.text;
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.green} />
      <Text style={[type.small, { marginTop: space.sm }]}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card style={{ alignItems: 'center', gap: space.sm }}>
      <Ionicons name="cloud-offline-outline" size={28} color={colors.textFaint} />
      <Text style={[type.body, { textAlign: 'center' }]}>{message}</Text>
      <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retry}>
        <Text style={{ color: colors.greenDark, fontWeight: '600' }}>Try again</Text>
      </Pressable>
    </Card>
  );
}

export function Notice({ children, tone = 'grey' }: { children: ReactNode; tone?: 'grey' | 'amber' }) {
  return (
    <View style={[styles.notice, tone === 'amber' && { backgroundColor: colors.amberSoft }]}>
      <Ionicons
        name="information-circle-outline"
        size={16}
        color={tone === 'amber' ? colors.amber : colors.textMuted}
        style={{ marginTop: 1 }}
      />
      <Text style={[type.small, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    ...shadow,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 12, fontWeight: '700' },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  tagText: { fontSize: 11, fontWeight: '600' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.muted },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  button: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.sm,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textFaint, letterSpacing: 0.6, textTransform: 'uppercase' },
  statValue: { fontSize: 15, fontWeight: '700', marginTop: 3 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.greenSoft },
  notice: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: space.md,
  },
});
