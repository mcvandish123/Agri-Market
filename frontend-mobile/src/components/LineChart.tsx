import { useMemo, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polygon, Stop, Text as SvgText } from 'react-native-svg';
import { monthShort, monthTick, peso } from '@/lib/format';
import { colors } from '@/theme';

export interface ChartPoint {
  month: string;
  value: number;
}

export interface ChartForecast extends ChartPoint {
  low: number;
  high: number;
}

interface Props {
  data: ChartPoint[];
  height?: number;
  /** Next month's reference forecast, drawn after the last point with its typical-error fan. */
  forecast?: ChartForecast;
  /** Horizontal space around the chart (screen + card padding), for the first frame before layout. */
  inset?: number;
}

const PAD = { top: 28, right: 12, bottom: 22, left: 34 };

/** Rounded grid values covering [min, max]. */
function ticks(min: number, max: number, count = 4): number[] {
  const span = Math.max(max - min, 1);
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.01; v += step) out.push(Number(v.toFixed(6)));
  if (out[out.length - 1] < max) out.push(start + out.length * step);
  return out;
}

/**
 * Line chart with a soft area fill. Drag across it to read a month's price.
 * Prices only; the forecast fan is the typical error, not a confidence interval.
 */
export function LineChart({ data, height = 200, forecast, inset = 66 }: Props) {
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  // onLayout does not always fire (e.g. some stacked screens on web), so start
  // from the screen width and switch to the measured width when it arrives.
  const width = measured || Math.max(window.width - inset, 200);
  const [selected, setSelected] = useState<number | null>(null);

  const points = useMemo(
    () => (forecast ? [...data, { month: forecast.month, value: forecast.value }] : data),
    [data, forecast],
  );

  const geo = useMemo(() => {
    if (width === 0 || points.length === 0) return null;
    const values = data.map((d) => d.value);
    if (forecast) values.push(forecast.low, forecast.high);
    const grid = ticks(Math.min(...values), Math.max(...values));
    const yMin = grid[0];
    const yMax = grid[grid.length - 1];
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const n = Math.max(points.length - 1, 1);
    const x = (i: number) => PAD.left + (i / n) * innerW;
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH;
    const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
    const area = data.length
      ? `${line} L${x(data.length - 1).toFixed(1)},${PAD.top + innerH} L${x(0).toFixed(1)},${PAD.top + innerH} Z`
      : '';
    return { grid, x, y, line, area, innerH, n };
  }, [width, height, points, data, forecast]);

  const onLayout = (e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width);

  const pick = (e: GestureResponderEvent) => {
    if (!geo) return;
    const innerW = width - PAD.left - PAD.right;
    const i = Math.round(((e.nativeEvent.locationX - PAD.left) / innerW) * geo.n);
    setSelected(Math.min(Math.max(i, 0), points.length - 1));
  };

  const shown = selected ?? points.length - 1;
  const shownPoint = points[shown];
  const isForecast = forecast !== undefined && shown === points.length - 1;
  const last = data.length - 1;
  const tickIdx = points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0, points.length - 1];

  return (
    <View>
      <View style={styles.readout}>
        {shownPoint && (
          <Text style={styles.readoutText}>
            {monthShort(shownPoint.month)} · <Text style={styles.readoutValue}>{peso(shownPoint.value)}</Text>
            {isForecast ? '  (reference forecast)' : ''}
          </Text>
        )}
      </View>
      <View
        style={{ height }}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={() => setSelected(null)}
        onResponderTerminate={() => setSelected(null)}
        accessible
        accessibilityLabel={
          shownPoint ? `Price chart. ${monthShort(shownPoint.month)}: ${peso(shownPoint.value)} per kilogram` : 'Price chart'
        }
      >
        {geo && (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.green} stopOpacity={0.22} />
                <Stop offset="1" stopColor={colors.green} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            {geo.grid.map((v) => (
              <Line key={v} x1={PAD.left} x2={width - PAD.right} y1={geo.y(v)} y2={geo.y(v)} stroke={colors.border} strokeWidth={1} />
            ))}
            {geo.grid.map((v) => (
              <SvgText key={`l${v}`} x={PAD.left - 6} y={geo.y(v) + 4} fontSize={10} fill={colors.textFaint} textAnchor="end">
                {Math.round(v)}
              </SvgText>
            ))}
            <Path d={geo.area} fill="url(#fill)" />
            <Path d={geo.line} stroke={colors.green} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {forecast && last >= 0 && (
              <>
                <Polygon
                  points={`${geo.x(last)},${geo.y(data[last].value)} ${geo.x(last + 1)},${geo.y(forecast.high)} ${geo.x(last + 1)},${geo.y(forecast.low)}`}
                  fill={colors.greenFaint}
                />
                <Line
                  x1={geo.x(last)}
                  y1={geo.y(data[last].value)}
                  x2={geo.x(last + 1)}
                  y2={geo.y(forecast.value)}
                  stroke={colors.green}
                  strokeWidth={2}
                  strokeDasharray="5,4"
                />
                <Circle cx={geo.x(last + 1)} cy={geo.y(forecast.value)} r={4.5} fill={colors.bg} stroke={colors.green} strokeWidth={2} />
              </>
            )}
            {shownPoint && (
              <>
                <Line x1={geo.x(shown)} x2={geo.x(shown)} y1={PAD.top} y2={PAD.top + geo.innerH} stroke={colors.textFaint} strokeWidth={1} strokeDasharray="3,3" />
                <Circle cx={geo.x(shown)} cy={geo.y(shownPoint.value)} r={4} fill={colors.green} />
              </>
            )}
            {tickIdx.map((i) => (
              <SvgText
                key={`t${i}`}
                x={geo.x(i)}
                y={height - 4}
                fontSize={10}
                fill={colors.textFaint}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              >
                {monthTick(points[i].month)}
              </SvgText>
            ))}
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { height: 20, justifyContent: 'center' },
  readoutText: { fontSize: 12, color: colors.textMuted },
  readoutValue: { color: colors.text, fontWeight: '600' },
});
