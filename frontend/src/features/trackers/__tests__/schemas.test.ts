import { createBody, trackerSchema, type TrackerValues, updateBody } from '../schemas';

const GYM: TrackerValues = {
  type: 'strength',
  name: '  Gym ',
  description: '',
  mode: 'duration',
  unit: '',
  unitNote: '',
  color: 'strength',
  icon: 'dumbbell',
};

function errors(values: Partial<TrackerValues>) {
  const result = trackerSchema.safeParse({ ...GYM, ...values });
  return result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));
}

describe('tracker form rules', () => {
  it('needs a name of at most 40 characters', () => {
    expect(errors({ name: '   ' })).toEqual({ name: 'trackers.errors.name' });
    expect(errors({ name: 'x'.repeat(41) })).toEqual({ name: 'trackers.errors.nameLong' });
    expect(errors({ description: 'x'.repeat(201) })).toEqual({ description: 'trackers.errors.description' });
  });

  it('needs a unit only for general trackers that count', () => {
    expect(errors({ type: 'general', mode: 'counter', unit: ' ' })).toEqual({ unit: 'trackers.errors.unit' });
    expect(errors({ type: 'general', mode: 'duration', unit: '' })).toEqual({});
    expect(errors({ type: 'strength', mode: 'counter', unit: '' })).toEqual({});
  });
});

describe('request bodies', () => {
  it('sends the mode only for general trackers and the unit only for counters', () => {
    expect(createBody(GYM)).toEqual({ type: 'strength', name: 'Gym', description: null, color: 'strength', icon: 'dumbbell' });
    expect(
      createBody({ ...GYM, type: 'general', mode: 'counter', unit: 'glasses', unitNote: ' 250 ml ', color: 'general', icon: 'droplet' }),
    ).toEqual({
      type: 'general',
      name: 'Gym',
      description: null,
      color: 'general',
      icon: 'droplet',
      general_mode: 'counter',
      counter_unit: 'glasses',
      counter_unit_note: '250 ml',
    });
    expect(createBody({ ...GYM, type: 'general', mode: 'duration', unit: 'ignored' })).toMatchObject({
      general_mode: 'duration',
    });
    expect(createBody({ ...GYM, type: 'general', mode: 'duration', unit: 'ignored' })).not.toHaveProperty('counter_unit');
  });

  it('never sends the type or mode when editing', () => {
    expect(updateBody({ ...GYM, description: ' Legs day ' }, false)).toEqual({
      name: 'Gym',
      description: 'Legs day',
      color: 'strength',
      icon: 'dumbbell',
    });
    expect(updateBody({ ...GYM, unit: 'cups', unitNote: '' }, true)).toMatchObject({ counter_unit: 'cups', counter_unit_note: null });
  });
});
