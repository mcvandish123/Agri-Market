import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { useApi } from '@/api/useApi';
import type { MetricRow, ModelName } from '@/api/types';
import { AppHeader } from '@/components/AppHeader';
import { Card, ErrorState, Notice, Tag } from '@/components/ui';
import { MODEL_LABELS, peso } from '@/lib/format';
import { colors, radius, space, type } from '@/theme';

type Kind = 'Baseline' | 'Statistical' | 'Machine learning' | 'Hybrid' | 'Deep learning';

/** The six models compared in the thesis, in the app's fixed order (naive first). */
const MODELS: { model: ModelName; kind: Kind; description: string }[] = [
  {
    model: 'naive',
    kind: 'Baseline',
    description:
      'Next month’s price equals this month’s price. Every other model is compared against it; the app uses it as the reference forecast.',
  },
  {
    model: 'sarimax',
    kind: 'Statistical',
    description:
      'Time-series model of the log price with five outside drivers from the previous month: soybean and palm oil price changes, temperature, vapor pressure deficit and inflation.',
  },
  {
    model: 'xgboost_full',
    kind: 'Machine learning',
    description:
      'Gradient-boosted decision trees that predict next month’s price change from all 25 previous-month features: prices, weather, inflation, exchange rate, export value and world vegetable oil prices.',
  },
  {
    model: 'xgboost_rfe',
    kind: 'Machine learning',
    description:
      'The same XGBoost model using the 24 features kept by Recursive Feature Elimination (RFE), which repeatedly drops the weakest input.',
  },
  {
    model: 'ms_xgboost_rfe',
    kind: 'Hybrid',
    description:
      'XGBoost-RFE plus the Markov Switching estimate of how likely the market was volatile last month, as an extra input.',
  },
  {
    model: 'lstm',
    kind: 'Deep learning',
    description: 'A recurrent neural network (Long Short-Term Memory) that reads the last three months of the 24 RFE features.',
  },
];

const STACK = [
  { group: 'Mobile app', items: ['TypeScript', 'React Native', 'Expo'] },
  { group: 'API', items: ['NestJS', 'Node.js'] },
  { group: 'Modeling & services', items: ['Python', 'statsmodels', 'XGBoost', 'TensorFlow', 'FastAPI'] },
  { group: 'Database', items: ['Supabase', 'PostgreSQL'] },
];

const SOURCES = [
  'Philippine Coconut Authority (PCA) – farmgate copra prices, Region XI',
  'Philippine Statistics Authority (PSA) – consumer price index, coconut oil exports',
  'PAGASA – temperature, humidity and rainfall',
  'World Bank Pink Sheet – coconut, palm, palm kernel and soybean oil prices',
  'Bangko Sentral ng Pilipinas (BSP) – peso-dollar exchange rate',
];

const metric = (rows: MetricRow[] | null, model: ModelName, set: MetricRow['evaluationSet']) =>
  rows?.find((r) => r.model === model && r.evaluationSet === set);

export default function MethodScreen() {
  const metrics = useApi(api.metrics);
  const naiveLow = metric(metrics.data, 'naive', 'test_low_volatility')?.rmse;
  const naiveHigh = metric(metrics.data, 'naive', 'test_high_volatility')?.rmse;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void metrics.refresh()} />}
      >
        <View>
          <Text style={type.h2}>Methodology & Architecture</Text>
          <Text style={type.small}>How the forecasts are made</Text>
        </View>

        <Card>
          <Text style={[type.h3, styles.cardTitle]}>Introduction</Text>
          <Text style={type.body}>
            Copra farmgate prices in the Davao Region shift with seasons, supply and global coconut oil demand. This
            study compared six statistical and machine learning models on 24 months they had never seen (January
            2024 – December 2025). None was significantly more accurate than simply using last month’s price, so the
            app shows that naive forecast as its reference and the other models for comparison.
          </Text>
        </Card>

        <Card>
          <Text style={[type.h3, styles.cardTitle]}>Pipeline</Text>
          <Text style={[type.small, { marginBottom: space.md }]}>
            Every model forecasts next month’s price using only data available by the end of this month. Test
            accuracy is over January 2024 – December 2025; lower is better.
          </Text>
          {metrics.error && !metrics.data && (
            <View style={{ marginBottom: space.md }}>
              <ErrorState message={metrics.error.message} onRetry={() => void metrics.refresh()} />
            </View>
          )}
          <View style={{ gap: space.lg }}>
            {MODELS.map((m, i) => {
              const test = metric(metrics.data, m.model, 'test');
              return (
                <View key={m.model} style={styles.step}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.stepHead}>
                      <Text style={type.h3}>{MODEL_LABELS[m.model]}</Text>
                      <Tag label={m.model === 'naive' ? 'Reference' : m.kind} tone={m.model === 'naive' ? 'green' : 'grey'} />
                    </View>
                    <Text style={[type.small, { marginTop: 2 }]}>{m.description}</Text>
                    {test?.rmse != null && (
                      <Text style={styles.metricLine}>
                        Test error: {peso(test.rmse)}/kg RMSE
                        {test.mapePct != null ? ` · ${test.mapePct.toFixed(2)}% MAPE` : ''}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          <View style={{ marginTop: space.lg }}>
            <Notice>
              A Friedman test found no significant difference among the six models (p = 0.199), and no pairwise test
              was significant after correction.
            </Notice>
          </View>
        </Card>

        <Card>
          <Text style={[type.h3, styles.cardTitle]}>Market regimes</Text>
          <Text style={type.body}>
            A two-regime Markov Switching model, re-estimated every month, detects whether the market is calm or
            volatile. The app’s typical error depends on it
            {naiveLow != null && naiveHigh != null
              ? `: about ${peso(naiveLow)}/kg in calm months and ${peso(naiveHigh)}/kg in volatile months.`
              : '.'}
          </Text>
        </Card>

        <Card>
          <Text style={[type.h3, styles.cardTitle]}>Data sources</Text>
          <View style={{ gap: space.sm }}>
            {SOURCES.map((s) => (
              <View key={s} style={{ flexDirection: 'row', gap: space.sm }}>
                <Text style={type.small}>•</Text>
                <Text style={[type.small, { flex: 1 }]}>{s}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={[type.h3, styles.cardTitle]}>Technology stack</Text>
          <View style={{ gap: space.md }}>
            {STACK.map((g) => (
              <View key={g.group}>
                <Text style={[type.eyebrow, { marginBottom: space.sm }]}>{g.group}</Text>
                <View style={styles.pills}>
                  {g.items.map((item, i) => (
                    <View key={item} style={[styles.pill, i === 0 && { backgroundColor: colors.greenSoft }]}>
                      <Text style={[styles.pillText, i === 0 && { color: colors.greenDark }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  cardTitle: { marginBottom: space.sm },
  step: { flexDirection: 'row', gap: space.md },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  metricLine: { fontSize: 12, color: colors.greenDark, fontWeight: '600', marginTop: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.muted },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
});
