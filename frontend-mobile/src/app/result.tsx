import { useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { useApi } from '@/api/useApi';
import type { LatestForecast } from '@/api/types';
import { AppHeader } from '@/components/AppHeader';
import { LineChart } from '@/components/LineChart';
import { Card, ChangeBadge, ErrorState, Loading, Notice, SectionTitle, Stat, Tag } from '@/components/ui';
import { REGION } from '@/lib/areas';
import {
  forecastOutlook,
  MODEL_LABELS,
  monthLong,
  monthName,
  monthShort,
  monthsBefore,
  outdatedForecastNote,
  peso,
  signedPeso,
} from '@/lib/format';
import { colors, radius, space, type } from '@/theme';

/**
 * Forecast result for next month. The reference is always the naive forecast
 * (CLAUDE.md rule 2); the range is the "typical error" from model_metrics
 * (rule 3), never a confidence interval.
 */
export default function ResultScreen() {
  const { area = REGION } = useLocalSearchParams<{ area?: string }>();
  const forecast = useApi(api.latestForecast);
  const latest = useApi(api.latestPrice);
  const areas = useApi(api.areaPrices);
  const history = useApi(async () => {
    const f = await api.latestForecast();
    return api.priceHistory(monthsBefore(f.dataThrough, 11), f.dataThrough);
  });

  const refreshAll = () => {
    void forecast.refresh();
    void latest.refresh();
    void areas.refresh();
    void history.refresh();
  };

  if (!forecast.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AppHeader back title="Forecast result" />
        <View style={styles.content}>
          {forecast.error ? (
            <ErrorState
              message={
                forecast.error.status === 404
                  ? 'No forecast has been published yet. Please check again later.'
                  : forecast.error.message
              }
              onRetry={refreshAll}
            />
          ) : (
            <Loading label="Loading forecast…" />
          )}
        </View>
      </View>
    );
  }

  const f = forecast.data;
  const ref = f.reference.pricePhpKg;
  const high = f.regime.label === 'high';
  const selectedArea = area !== REGION ? areas.data?.areas.find((a) => a.area === area) : undefined;
  // New monthly data arrived but the forecast job has not run since
  const stale = latest.data !== null && latest.data.month >= f.targetMonth;
  const outdated = outdatedForecastNote(f.targetMonth, f.dataThrough);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader back title="Forecast result" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} />}
      >
        <View>
          <Text style={type.eyebrow}>{forecastOutlook(f.targetMonth)}</Text>
          <Text style={[type.title, { marginTop: 4 }]}>{monthLong(f.targetMonth)}</Text>
          <Text style={[type.small, { marginTop: 4 }]}>
            Davao Region average · based on prices through {monthLong(f.dataThrough)}
          </Text>
        </View>

        {stale && (
          <Notice tone="amber">
            Prices for {monthLong(latest.data!.month)} are already in. An updated forecast will appear after the next
            monthly update.
          </Notice>
        )}

        {!stale && outdated && <Notice tone="amber">{outdated}</Notice>}

        {/* Reference forecast */}
        <Card>
          <View style={styles.rowBetween}>
            <Text style={type.small}>Reference forecast</Text>
            <Tag label="Naive model" />
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.bigPrice}>{peso(ref)}</Text>
            <Text style={styles.perKg}>/kg</Text>
          </View>
          <View style={styles.rangeBox}>
            <Text style={type.eyebrow}>Typical error</Text>
            <Text style={styles.rangeText}>
              {peso(f.typicalError.low)} – {peso(f.typicalError.high)}
            </Text>
            <Text style={type.small}>
              ±{peso(f.typicalError.pricePhpKg)}/kg. In {high ? 'volatile' : 'calm'} months of the 2024–2025 test,
              this forecast was off by about this much. Prices can move outside this range.
            </Text>
          </View>
          <Text style={[type.small, { marginTop: space.md }]}>
            The naive forecast is last month’s price ({peso(ref)} in {monthName(f.dataThrough)}). In the study, no
            model forecast copra prices significantly better than it.
          </Text>
        </Card>

        {/* Summary stats */}
        <Card>
          <View style={styles.statsRow}>
            <Stat label="Last recorded" value={latest.data ? peso(latest.data.pricePhpKg) : '—'} />
            <Stat label="Data through" value={monthShort(f.dataThrough)} />
            <Stat label="Forecast for" value={monthShort(f.targetMonth)} />
          </View>
        </Card>

        {/* Volatility */}
        <Card>
          <View style={styles.rowBetween}>
            <View>
              <Text style={type.small}>Market volatility</Text>
              <Text style={[styles.regime, { color: high ? colors.amber : colors.greenDark }]}>
                {high ? 'High' : 'Low'}
              </Text>
            </View>
            <Tag label={high ? 'Volatile market' : 'Calm market'} tone={high ? 'amber' : 'green'} />
          </View>
          <View style={styles.barTrack} accessibilityLabel={`Chance of a volatile market: ${Math.round(f.regime.pHighVolatility * 100)} percent`}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.round(f.regime.pHighVolatility * 100)}%`, backgroundColor: high ? colors.amber : colors.green },
              ]}
            />
          </View>
          <Text style={[type.small, { marginTop: space.sm }]}>
            {Math.round(f.regime.pHighVolatility * 100)}% chance that the market was in its volatile state in{' '}
            {monthName(f.dataThrough)} (Markov Switching model). Volatile months have larger price swings.
          </Text>
        </Card>

        {/* Selected area */}
        {selectedArea && (
          <Card>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={type.small}>Selected area</Text>
                <Text style={type.h2}>{selectedArea.name}</Text>
              </View>
              <ChangeBadge pct={selectedArea.changePct} />
            </View>
            <View style={styles.statsRow}>
              <Stat
                label={`${monthShort(areas.data!.month)} price`}
                value={selectedArea.pricePhpKg == null ? '—' : peso(selectedArea.pricePhpKg)}
              />
              <Stat
                label="vs regional"
                value={
                  selectedArea.pricePhpKg == null || !latest.data
                    ? '—'
                    : signedPeso(selectedArea.pricePhpKg - latest.data.pricePhpKg)
                }
              />
            </View>
            <Text style={[type.small, { marginTop: space.md }]}>
              The forecast is for the regional average; area prices are shown for comparison.
            </Text>
          </Card>
        )}

        {/* Chart */}
        <Card>
          <Text style={type.h3}>Last 12 months and forecast</Text>
          <Text style={[type.small, { marginBottom: space.sm }]}>PHP per kg · shaded area = typical error</Text>
          {history.data ? (
            <LineChart
              data={history.data.map((p) => ({ month: p.month, value: p.pricePhpKg }))}
              forecast={{ month: f.targetMonth, value: ref, low: f.typicalError.low, high: f.typicalError.high }}
              height={200}
            />
          ) : (
            <Loading label="Loading prices…" />
          )}
        </Card>

        <ModelComparison forecast={f} />

        <Text style={styles.footer}>
          A reference for planning, not a price quotation or financial advice. Forecast updated{' '}
          {new Date(f.runAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}.
        </Text>
      </ScrollView>
    </View>
  );
}

function ModelComparison({ forecast }: { forecast: LatestForecast }) {
  const ref = forecast.reference.pricePhpKg;
  return (
    <View>
      <SectionTitle title="All models" subtitle="Comparison only, not a ranking" />
      <Card style={{ paddingVertical: space.sm }}>
        {forecast.models.map((m, i) => {
          const isRef = m.model === forecast.reference.model;
          return (
            <View key={m.model} style={[styles.modelRow, i > 0 && styles.divider]}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={[type.body, isRef && { fontWeight: '700' }]}>{MODEL_LABELS[m.model]}</Text>
                {isRef && <Tag label="Reference" />}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[type.body, { fontWeight: '600' }]}>{peso(m.pricePhpKg)}</Text>
                {!isRef && <Text style={type.small}>{signedPeso(m.pricePhpKg - ref)} vs reference</Text>}
              </View>
            </View>
          );
        })}
      </Card>
      <View style={{ marginTop: space.md }}>
        <Notice>
          On the 2024–2025 test months none of these models was significantly more accurate than the naive forecast
          (Friedman test, p = 0.199). Their forecasts are shown for transparency.
        </Notice>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.sm },
  bigPrice: { fontSize: 38, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  perKg: { fontSize: 16, color: colors.textMuted, marginBottom: 7, marginLeft: 2 },
  rangeBox: { backgroundColor: colors.muted, borderRadius: radius.md, padding: space.md, marginTop: space.md, gap: 4 },
  rangeText: { fontSize: 18, fontWeight: '700', color: colors.text },
  statsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  regime: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.muted, marginTop: space.md, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  modelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  footer: { ...type.small, fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: space.sm },
});
