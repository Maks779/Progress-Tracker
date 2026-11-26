import { useTranslation } from 'react-i18next';

import { usePreferences } from '@/features/settings/preferences';
import type { GoalOut, TrackerSummary } from '@/shared/api/generated/model';
import { formatDate } from '@/shared/format/dates';

import { fromCanonical, type GoalKind, type GoalPeriod, type Metric } from './rules';

type TrackerText = Pick<TrackerSummary, 'name' | 'counter_unit'>;
type GoalText = Pick<GoalOut, 'kind' | 'period' | 'metric' | 'name' | 'end_date' | 'progress' | 'target'>;

/**
 * Everything a goal says in words, in the UI language and the person's distance unit:
 * "2 / 3 sessions", "14 / 20 books · 70%", "12 km / week", "Weekly · Resets Monday".
 */
export function useGoalText() {
  const { t, i18n } = useTranslation();
  const distanceUnit = usePreferences((state) => state.values.distance_unit);
  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(value);

  /** The unit on its own, for labels: "km", "min", "glasses", "pages". */
  function unit(metric: Metric, tracker: TrackerText): string {
    if (metric === 'distance') {
      return t(`goals.units.${distanceUnit}`);
    }
    if (metric === 'duration') {
      return t('goals.units.min');
    }
    if (metric === 'count') {
      return tracker.counter_unit ?? '';
    }
    return t(`goals.unitWords.${metric}`);
  }

  /** A canonical amount with its unit: "12 km", "60 pages", "3 sessions", "8 glasses". */
  function amount(metric: Metric, canonical: number, tracker: TrackerText): string {
    const value = fromCanonical(metric, canonical, distanceUnit);
    if (metric === 'sessions' || metric === 'pages' || metric === 'books') {
      return t(`goals.units.${metric}`, { count: value, formatted: number(value) });
    }
    if (metric === 'distance') {
      return t(`goals.distance.${distanceUnit}`, { count: value, formatted: number(value) });
    }
    return `${number(value)} ${unit(metric, tracker)}`.trim();
  }

  /** "2 / 3 sessions"; cumulative goals add the percentage: "14 / 20 books · 70%". */
  function progress(goal: GoalText, tracker: TrackerText): string {
    const metric = goal.metric as Metric;
    const done = number(fromCanonical(metric, goal.progress.value, distanceUnit));
    const text = `${done} / ${amount(metric, goal.progress.target, tracker)}`;
    if (goal.kind !== 'cumulative') {
      return text;
    }
    const percent = Math.floor((goal.progress.value / goal.progress.target) * 100);
    return `${text} · ${number(percent)}%`;
  }

  /** The target in the tracker list: "3 / week", "12 km / week", "8 glasses / day". */
  function short(goal: GoalText, tracker: TrackerText): string {
    const target = goal.kind === 'frequency' ? number(goal.target) : amount(goal.metric as Metric, goal.target, tracker);
    return t(`goals.per.${goal.period ?? 'week'}`, { amount: target });
  }

  /** "Weekly · Resets Monday", "Daily · Starts fresh each day", "Cumulative · Ends Dec 31, 2026". */
  function footer(goal: GoalText, today: string): string {
    if (goal.kind === 'cumulative' && goal.end_date) {
      const key = goal.end_date < today ? 'goals.footer.ended' : 'goals.footer.ends';
      return t(key, { date: formatDate(goal.end_date, i18n.language) });
    }
    return t(`goals.footer.${goal.period === 'day' ? 'day' : 'week'}`);
  }

  function title(goal: GoalText, tracker: TrackerText): string {
    return goal.name ?? tracker.name;
  }

  /** The unit phrase of the target field: "km / week", "pages", "min / day". */
  function targetUnit(kind: GoalKind, period: GoalPeriod, metric: Metric, tracker: TrackerText): string {
    const base = unit(metric, tracker);
    return kind === 'amount' ? t(`goals.per.${period}`, { amount: base }) : base;
  }

  return { amount, footer, progress, short, targetUnit, title, unit, distanceUnit };
}
