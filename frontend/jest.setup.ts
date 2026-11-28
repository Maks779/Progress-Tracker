jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const same = <T,>(value: T) => value;
  const builder = () => {
    const animation: Record<string, () => unknown> = {};
    for (const method of ['duration', 'delay', 'easing', 'reduceMotion']) {
      animation[method] = () => animation;
    }
    return animation;
  };
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: same },
    Easing: { linear: same, cubic: same, sin: same, out: () => same, inOut: () => same, bezier: () => same },
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
    FadeIn: builder(),
    FadeInDown: builder(),
    SlideInDown: builder(),
    interpolate: () => 0,
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    useReducedMotion: () => false,
    withDelay: (_delay: number, animation: unknown) => animation,
    withRepeat: same,
    withSequence: (...steps: unknown[]) => steps[steps.length - 1],
    withTiming: same,
  };
});

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID() }));

jest.mock('expo-notifications', () => {
  const unanswered = { granted: false, canAskAgain: true, status: 'undetermined', expires: 'never' };
  return {
    AndroidImportance: { HIGH: 4 },
    IosAuthorizationStatus: { PROVISIONAL: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(async () => unanswered),
    requestPermissionsAsync: jest.fn(async () => unanswered),
    getExactAlarmPermissionsAsync: jest.fn(async () => ({ ...unanswered, granted: true, status: 'granted' })),
    requestExactAlarmPermissionsAsync: jest.fn(async () => ({ ...unanswered, granted: true, status: 'granted' })),
    scheduleNotificationAsync: jest.fn(async () => 'scheduled'),
    cancelScheduledNotificationAsync: jest.fn(async () => undefined),
    cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  };
});
