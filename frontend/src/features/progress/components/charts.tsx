import { useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { Text } from '@/shared/ui/Text';

import { axisTicks, type GridDay, labelIndexes, linePositions } from '../rules';

const AXIS = 32;

function useWidth() {
  const [width, setWidth] = useState(0);
  return { width, onLayout: (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width)) };
}

type LineProps = {
  values: number[];
  dates: string[];
  height: number;
  color: string;
  /** What a screen reader hears instead of the drawing. */
  label: string;
  formatValue: (value: number) => string;
  formatDate: (date: string) => string;
};

/**
 * A line over time (design: Progress / exercise line): three round values on the left with
 * their lines, the points joined in order, a few dates under it. One point is drawn as a dot.
 */
export function LineChart({ values, dates, height, color, label, formatValue, formatDate }: LineProps) {
  const { colors } = useTheme();
  const { width, onLayout } = useWidth();
  const ticks = axisTicks(values);
  const plot = Math.max(0, width - AXIS);
  const inset = 4;
  const points = linePositions(values, plot, height - 2 * inset, ticks).map((point) => ({ x: point.x, y: point.y + inset }));
  const shown = labelIndexes(dates.length);
  return (
    <View accessible aria-label={label} style={{ gap: 8 }}>
      <View onLayout={onLayout} style={{ height, flexDirection: 'row' }}>
        <View style={{ width: AXIS, height, justifyContent: 'space-between', paddingVertical: 0 }} importantForAccessibility="no-hide-descendants">
          {[...ticks].reverse().map((tick) => (
            <Text key={tick} variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'], marginTop: -8, marginBottom: -8 }}>
              {formatValue(tick)}
            </Text>
          ))}
        </View>
        {plot > 0 ? (
          <Svg width={plot} height={height}>
            {ticks.map((tick, index) => {
              const y = inset + (height - 2 * inset) * (1 - index / 2);
              return <Line key={tick} x1={0} x2={plot} y1={y} y2={y} stroke={colors.border.default} strokeWidth={1} />;
            })}
            {points.length > 1 ? (
              <Polyline
                points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {points.length === 1 ? <Circle cx={points[0].x} cy={points[0].y} r={4} fill={color} /> : null}
          </Svg>
        ) : null}
      </View>
      <View style={{ height: 16, marginLeft: AXIS }} importantForAccessibility="no-hide-descendants">
        {plot > 0
          ? shown.map((index, position) => {
              const first = position === 0;
              const last = position === shown.length - 1 && shown.length > 1;
              const x = points[index]?.x ?? 0;
              return (
                <Text
                  key={index}
                  variant="caption"
                  tone="muted"
                  numberOfLines={1}
                  style={{
                    position: 'absolute',
                    width: 72,
                    left: first ? 0 : last ? undefined : x - 36,
                    right: last ? 0 : undefined,
                    textAlign: first ? 'left' : last ? 'right' : 'center',
                  }}
                >
                  {formatDate(dates[index])}
                </Text>
              );
            })
          : null}
      </View>
    </View>
  );
}

export type Bar = { key: string; value: number; valueLabel: string; dateLabel: string };

type BarProps = {
  bars: Bar[];
  height: number;
  color: string;
  label: string;
  /** Dates under the bars (tablets and desktop, as framed); phones show only the values. */
  dates: boolean;
};

/** Room a date under crowded bars needs, so neighbouring dates never touch. */
const DATE_ROOM = 48;

/**
 * Bars by week or month (design: Volume · kg, Pages / week): each bar's height follows its
 * share of the tallest, its value under it, then its date. Many bars (a year by month) carry
 * no values, and only as many dates as fit, first and last included.
 */
export function BarChart({ bars, height, color, label, dates }: BarProps) {
  const { width, onLayout } = useWidth();
  const max = Math.max(...bars.map((bar) => bar.value), 0);
  const crowded = bars.length > 6;
  const gap = crowded ? 3 : 8;
  const barWidth = bars.length > 0 ? (width - gap * (bars.length - 1)) / bars.length : 0;
  const dated = crowded ? labelIndexes(bars.length, Math.max(2, Math.floor(width / DATE_ROOM))) : [];
  return (
    <View accessible aria-label={label} style={{ gap: 8 }}>
      <View onLayout={onLayout} style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap }}>
        {bars.map((bar) => (
          <View
            key={bar.key}
            style={{
              flex: 1,
              height: max > 0 && bar.value > 0 ? Math.max(3, (bar.value / max) * height) : 0,
              borderTopLeftRadius: crowded ? 2 : 4,
              borderTopRightRadius: crowded ? 2 : 4,
              backgroundColor: color,
            }}
          />
        ))}
      </View>
      {crowded ? (
        <View style={{ height: 16 }} importantForAccessibility="no-hide-descendants">
          {width > 0
            ? dated.map((index, position) => {
                const first = position === 0;
                const last = position === dated.length - 1;
                const center = index * (barWidth + gap) + barWidth / 2;
                return (
                  <Text
                    key={bars[index].key}
                    variant="caption"
                    tone="muted"
                    numberOfLines={1}
                    style={{
                      position: 'absolute',
                      width: DATE_ROOM,
                      left: first ? 0 : last ? undefined : center - DATE_ROOM / 2,
                      right: last ? 0 : undefined,
                      textAlign: first ? 'left' : last ? 'right' : 'center',
                    }}
                  >
                    {bars[index].dateLabel}
                  </Text>
                );
              })
            : null}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap }} importantForAccessibility="no-hide-descendants">
          {bars.map((bar) => (
            <View key={bar.key} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <Text variant="caption" tone="muted" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
                {bar.valueLabel}
              </Text>
              {dates ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {bar.dateLabel}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

type GridProps = { weeks: GridDay[][]; label: string };

/** A few weeks read as rows, Monday to Sunday; more weeks as columns, so the grid fills its card either way. */
const ROWS_UP_TO = 8;

/**
 * The consistency grid (design: Consistency, in weeks.): a square per day, lit when there was a
 * session, a week per column (a week per row for a month or less).
 */
export function ConsistencyGrid({ weeks, label }: GridProps) {
  const { colors } = useTheme();
  const { width, onLayout } = useWidth();
  const rows = weeks.length <= ROWS_UP_TO;
  const across = rows ? 7 : weeks.length;
  const gap = rows ? 4 : across > 26 ? 1 : 3;
  const cell = across > 0 ? Math.max(2, Math.min(rows ? 28 : 16, Math.floor((width - gap * (across - 1)) / across))) : 0;
  const square = (day: GridDay, key: number) => (
    <View
      key={key}
      style={{
        width: cell,
        height: cell,
        borderRadius: rows ? 4 : 2,
        backgroundColor: day === null ? 'transparent' : day.active ? colors.accent.fill : colors.bg.surfaceRaised,
      }}
    />
  );
  return (
    <View accessible aria-label={label} onLayout={onLayout} style={{ flexDirection: rows ? 'column' : 'row', gap, minHeight: 7 * 4 }}>
      {width > 0
        ? weeks.map((week, index) => (
            <View key={index} style={{ flexDirection: rows ? 'row' : 'column', gap }}>
              {week.map(square)}
            </View>
          ))
        : null}
    </View>
  );
}
