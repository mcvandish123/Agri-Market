import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { useApi } from '@/api/useApi';
import { colors, space } from '@/theme';

const HEALTH_POLL_MS = 30_000;

/**
 * Top bar: app name with a status dot (green = API and database reachable).
 * With `back`, shows a back button instead of the dot (stacked screens).
 */
export function AppHeader({ back, title }: { back?: boolean; title?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const health = useApi(api.health);
  const { refresh } = health;
  // Recheck while this screen is focused, so the dot follows the server going up or down
  useFocusEffect(
    useCallback(() => {
      if (back) return undefined;
      void refresh();
      const id = setInterval(() => void refresh(), HEALTH_POLL_MS);
      return () => clearInterval(id);
    }, [back, refresh]),
  );
  // useApi keeps old data after a failed refresh, so check the error too
  const online = !health.error && health.data?.database === 'ok';
  const dot = !health.data && !health.error ? colors.textFaint : online ? colors.green : colors.red;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
      {back ? (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/forecast'))}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          style={styles.side}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.side} />
      )}
      <View style={styles.center}>
        {!back && (
          <View
            style={[styles.dot, { backgroundColor: dot }]}
            accessibilityLabel={online ? 'Live data connected' : 'Data unavailable'}
          />
        )}
        <Text style={styles.title}>{title ?? 'Agri-Copra'}</Text>
      </View>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    backgroundColor: colors.bg,
  },
  side: { width: 32 },
  center: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
});
