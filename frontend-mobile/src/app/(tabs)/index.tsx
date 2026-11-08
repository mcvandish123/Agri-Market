import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { useApi } from '@/api/useApi';
import type { AreaPrice, PricePoint } from '@/api/types';
import { AppHeader } from '@/components/AppHeader';
import { LineChart } from '@/components/LineChart';
import { Card, ChangeBadge, Chip, ErrorState, Loading, SectionTitle, Stat, Tag } from '@/components/ui';
import { monthLong, monthName, monthsBefore, peso, signedPeso } from '@/lib/format';
import { colors, radius, space, type } from '@/theme';

const RANGES = [
  { key: '3M', months: 3 },
  { key: '6M', months: 6 },
  { key: '1Y', months: 12 },
  { key: '5Y', months: 60 },
  { key: 'All', months: null },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

/** Points within the last `months` months (inclusive of the anchor month). */
function inRange(history: PricePoint[], months: number | null): PricePoint[] {
  if (!months || history.length === 0) return history;
  const from = monthsBefore(history[history.length - 1].month, months);
  return history.filter((p) => p.month >= from);
}

/** Distinct two-letter badges (several areas share initials). */
const AREA_CODES: Record<string, string> = {
  davao_city: 'DC',
  davao_de_oro: 'DO',
  davao_del_norte: 'DN',
  davao_del_sur: 'DS',
  davao_occidental: 'OC',
  davao_oriental: 'OR',
};
const initials = (area: AreaPrice) => AREA_CODES[area.area] ?? area.name.slice(0, 2).toUpperCase();

export default function HomeScreen() {
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>('1Y');
  const latest = useApi(api.latestPrice);
  const history = useApi(() => api.priceHistory());
  const areas = useApi(api.areaPrices);
  const forecast = useApi(api.latestForecast);

  const refreshing = latest.loading || history.loading || areas.loading || forecast.loading;
  const refreshAll = () => {
    void latest.refresh();
    void history.refresh();
    void areas.refresh();
    void forecast.refresh();
  };

  const shown = useMemo(
    () => inRange(history.data ?? [], RANGES.find((r) => r.key === range)?.months ?? null),
    [history.data, range],
  );
  const rangeChange =
    shown.length > 1 ? ((shown[shown.length - 1].pricePhpKg - shown[0].pricePhpKg) / shown[0].pricePhpKg) * 100 : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing && latest.data !== null} onRefresh={refreshAll} />}
      >
        {/* Price card */}
        {latest.error && !latest.data ? (
          <ErrorState message={latest.error.message} onRetry={refreshAll} />
        ) : (
          <Card>
            <View style={styles.rowBetween}>
              <Text style={type.small}>Davao Region Farmgate Prices</Text>
              <ChangeBadge pct={rangeChange} />
            </View>
            {latest.data ? (
              <>
                <View style={styles.priceRow}>
                  <Text style={styles.bigPrice}>{peso(latest.data.pricePhpKg)}</Text>
                  <Text style={styles.perKg}>/kg</Text>
                </View>
                <Text style={type.small}>Regional average · {monthLong(latest.data.month)}</Text>
              </>
            ) : (
              <Loading />
            )}
            <View style={styles.chips}>
              {RANGES.map((r) => (
                <Chip key={r.key} label={r.key} active={range === r.key} onPress={() => setRange(r.key)} />
              ))}
            </View>
            {history.data ? (
              <LineChart data={shown.map((p) => ({ month: p.month, value: p.pricePhpKg }))} height={210} />
            ) : history.error ? (
              <Text style={type.small}>{history.error.message}</Text>
            ) : (
              <Loading label="Loading prices…" />
            )}
            <Text style={[type.small, { marginTop: space.sm }]}>Drag across the chart to read a month's price.</Text>
          </Card>
        )}

        {/* Next month teaser */}
        {forecast.data && (
          <Pressable onPress={() => router.push('/forecast')} accessibilityRole="button">
            <Card style={styles.teaser}>
              <View style={{ flex: 1 }}>
                <Text style={type.eyebrow}>Next month · {monthName(forecast.data.targetMonth)}</Text>
                <Text style={styles.teaserPrice}>{peso(forecast.data.reference.pricePhpKg)}</Text>
                <Text style={type.small}>
                  Reference forecast · typical error ±{peso(forecast.data.typicalError.pricePhpKg)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: space.sm }}>
                <Tag
                  label={forecast.data.regime.label === 'high' ? 'Volatile market' : 'Calm market'}
                  tone={forecast.data.regime.label === 'high' ? 'amber' : 'green'}
                />
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </Card>
          </Pressable>
        )}

        {/* Area prices */}
        <View style={{ marginTop: space.md }}>
          <SectionTitle
            title="Copra Metrics"
            subtitle={
              areas.data ? `Current price by area · ${monthLong(areas.data.month)}` : 'Current price by area'
            }
          />
          {areas.error && !areas.data ? (
            <ErrorState message={areas.error.message} onRetry={() => void areas.refresh()} />
          ) : !areas.data ? (
            <Loading />
          ) : (
            <View style={{ gap: space.md }}>
              {areas.data.areas.map((a) => (
                <AreaCard key={a.area} area={a} previousMonth={areas.data?.previousMonth ?? null} />
              ))}
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          Farmgate copra prices from the Philippine Coconut Authority, Region XI. Prices in Philippine pesos per
          kilogram. Not a price quotation or financial advice.
        </Text>
      </ScrollView>
    </View>
  );
}

function AreaCard({ area, previousMonth }: { area: AreaPrice; previousMonth: string | null }) {
  const diff =
    area.pricePhpKg != null && area.previousPricePhpKg != null ? area.pricePhpKg - area.previousPricePhpKg : null;
  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(area)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>{area.name}</Text>
            <Text style={type.small}>Davao Region · farmgate</Text>
          </View>
        </View>
        <ChangeBadge pct={area.changePct} />
      </View>
      <View style={[styles.statsRow]}>
        <Stat label="Price/kg" value={area.pricePhpKg == null ? '—' : peso(area.pricePhpKg)} />
        <Stat
          label={previousMonth ? `${monthName(previousMonth).slice(0, 3)} price` : 'Last month'}
          value={area.previousPricePhpKg == null ? '—' : peso(area.previousPricePhpKg)}
        />
        <Stat
          label="Change"
          value={diff == null ? '—' : signedPeso(diff)}
          tone={diff == null || diff === 0 ? undefined : diff > 0 ? 'up' : 'down'}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.sm },
  bigPrice: { fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  perKg: { fontSize: 16, color: colors.textMuted, marginBottom: 6, marginLeft: 2 },
  chips: { flexDirection: 'row', gap: space.sm, marginTop: space.md, marginBottom: space.sm, flexWrap: 'wrap' },
  teaser: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  teaserPrice: { fontSize: 24, fontWeight: '800', color: colors.text, marginVertical: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: colors.greenDark },
  statsRow: { flexDirection: 'row', marginTop: space.lg, gap: space.sm },
  footer: { ...type.small, fontSize: 12, color: colors.textFaint, marginTop: space.md, textAlign: 'center' },
});
