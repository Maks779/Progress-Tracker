import type { TrackerCreateIcon, TrackerCreateType } from '@/shared/api/generated/model';
import type { Palette } from '@/shared/theme/tokens';
import {
  Activity,
  Bike,
  BookOpen,
  Brain,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Library,
  type LucideIcon,
  Moon,
  Mountain,
  Sparkles,
  Target,
  Timer,
  Waves,
} from '@/shared/ui/icons';

export type TrackerType = TrackerCreateType;
export type TrackerIcon = TrackerCreateIcon;
export type TrackerColor = keyof Palette['tracker'];
export type GeneralMode = 'duration' | 'counter';

export const TRACKER_TYPES: TrackerType[] = ['strength', 'cardio', 'reading', 'general'];

/** The four tracker colors of the design system; the API stores the token name. */
export const TRACKER_COLORS: TrackerColor[] = ['strength', 'cardio', 'reading', 'general'];

/** The 16 icons the API accepts, in the order the picker shows them. */
export const TRACKER_ICONS: Record<TrackerIcon, LucideIcon> = {
  dumbbell: Dumbbell,
  activity: Activity,
  bike: Bike,
  footprints: Footprints,
  waves: Waves,
  mountain: Mountain,
  'book-open': BookOpen,
  library: Library,
  sparkles: Sparkles,
  brain: Brain,
  droplet: Droplet,
  moon: Moon,
  target: Target,
  flame: Flame,
  timer: Timer,
  heart: Heart,
};

export const ICON_KEYS = Object.keys(TRACKER_ICONS) as TrackerIcon[];

/** What a new tracker of each type starts with: its own color and the first icon of its kind. */
export const TYPE_DEFAULTS: Record<TrackerType, { icon: TrackerIcon; color: TrackerColor }> = {
  strength: { icon: 'dumbbell', color: 'strength' },
  cardio: { icon: 'activity', color: 'cardio' },
  reading: { icon: 'book-open', color: 'reading' },
  general: { icon: 'sparkles', color: 'general' },
};

export function colorFor(palette: Palette, color: string): string {
  return palette.tracker[color as TrackerColor] ?? palette.accent.text;
}
