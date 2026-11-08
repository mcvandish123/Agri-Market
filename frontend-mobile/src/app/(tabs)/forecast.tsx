import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { useApi } from '@/api/useApi';
import { AppHeader } from '@/components/AppHeader';
import { Option, Select } from '@/components/Select';
import { Notice, PrimaryButton } from '@/components/ui';
import { REGION } from '@/lib/areas';
import { monthLong } from '@/lib/format';
import { colors, radius, space, type } from '@/theme';

/**
 * Forecast input. The system forecasts one month ahead for the Davao Region
 * average (thesis scope), so the area is optional context and the horizon is
 * fixed at one month.
 */
export default function ForecastScreen() {
  const router = useRouter();
  const [area, setArea] = useState<string>(REGION);
  const areas = useApi(api.areaPrices);
  const forecast = useApi(api.latestForecast);

  const options: Option[] = [
    { value: REGION, label: 'Davao Region (average)', hint: 'Average of the six reporting areas' },
    ...(areas.data?.areas ?? []).map((a) => ({
      value: a.area,
      label: a.name,
      hint: 'Shows this area’s latest price next to the regional forecast',
    })),
  ];

  const target = forecast.data?.targetMonth;
  const unavailable = forecast.error?.status === 404;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={type.title}>Forecast</Text>
        <Text style={[type.title, { color: colors.green, marginTop: -4 }]}>copra prices.</Text>
        <Text style={[type.body, { color: colors.textMuted, marginTop: space.md }]}>
          Choose an area, then see next month’s reference forecast for Davao Region copra.
        </Text>

        <Text style={styles.label}>Area</Text>
        <Select placeholder="Choose an area" options={options} value={area} onChange={setArea} icon="location-outline" />
        <Text style={styles.help}>Forecasts are made for the regional average.</Text>

        <Text style={styles.label}>Forecast Horizon</Text>
        <View style={styles.fixedField} accessible accessibilityLabel={`Forecast horizon: one month${target ? `, ${monthLong(target)}` : ''}`}>
          <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
          <Text style={styles.fixedText}>1 month</Text>
          {target ? <Text style={styles.fixedHint}>{monthLong(target)}</Text> : null}
        </View>
        <Text style={styles.help}>The study evaluated one-month-ahead forecasts, so the app forecasts one month.</Text>

        <View style={{ marginTop: space.xxl }}>
          <PrimaryButton
            label="Generate Forecast"
            disabled={!forecast.data}
            onPress={() => router.push({ pathname: '/result', params: { area } })}
          />
        </View>

        {unavailable ? (
          <View style={{ marginTop: space.lg }}>
            <Notice tone="amber">No forecast has been published yet. Please check again later.</Notice>
          </View>
        ) : forecast.error ? (
          <View style={{ marginTop: space.lg }}>
            <Notice tone="amber">{forecast.error.message}</Notice>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, paddingTop: space.xxl },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: space.xxl, marginBottom: space.sm },
  help: { ...type.small, marginTop: space.sm },
  fixedField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 15,
  },
  fixedText: { fontSize: 16, color: colors.text, flex: 1 },
  fixedHint: { fontSize: 14, color: colors.textMuted },
});
