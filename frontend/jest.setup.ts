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
    Easing: { linear: same, cubic: same, sin: same, out: () => same, inOut: () => same },
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
