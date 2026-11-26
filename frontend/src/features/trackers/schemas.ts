import { z } from 'zod';

import type { TrackerCreate, TrackerUpdate } from '@/shared/api/generated/model';

import { ICON_KEYS, type TrackerIcon } from './catalog';

/**
 * The tracker form, with the API's limits: a name of 1–40 characters, a description of up to
 * 200, and for counters a unit of 1–20 and a unit note of up to 40. Messages are i18n keys.
 */
export const trackerSchema = z
  .object({
    type: z.enum(['strength', 'cardio', 'reading', 'general']),
    name: z.string().trim().min(1, 'trackers.errors.name').max(40, 'trackers.errors.nameLong'),
    description: z.string().trim().max(200, 'trackers.errors.description'),
    mode: z.enum(['duration', 'counter']),
    unit: z.string().trim().max(20, 'trackers.errors.unitLong'),
    unitNote: z.string().trim().max(40, 'trackers.errors.unitNote'),
    color: z.enum(['strength', 'cardio', 'reading', 'general']),
    icon: z.enum(ICON_KEYS as [TrackerIcon, ...TrackerIcon[]]),
  })
  .refine((values) => values.type !== 'general' || values.mode !== 'counter' || values.unit.length > 0, {
    message: 'trackers.errors.unit',
    path: ['unit'],
  });

export type TrackerValues = z.infer<typeof trackerSchema>;

/** The request body for a new tracker; general trackers carry their mode, counters their unit. */
export function createBody(values: TrackerValues): TrackerCreate {
  const counter = values.type === 'general' && values.mode === 'counter';
  return {
    type: values.type,
    name: values.name.trim(),
    description: values.description.trim() || null,
    color: values.color,
    icon: values.icon,
    ...(values.type === 'general' ? { general_mode: values.mode } : {}),
    ...(counter ? { counter_unit: values.unit.trim(), counter_unit_note: values.unitNote.trim() || null } : {}),
  };
}

/** The changes for an existing tracker; type and mode never change after creation. */
export function updateBody(values: TrackerValues, counter: boolean): TrackerUpdate {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    color: values.color,
    icon: values.icon,
    ...(counter ? { counter_unit: values.unit.trim(), counter_unit_note: values.unitNote.trim() || null } : {}),
  };
}
