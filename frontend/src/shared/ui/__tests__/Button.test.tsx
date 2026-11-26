import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { Button } from '../Button';

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((ok) => (resolve = ok));
  return { promise, resolve };
}

async function show(onPress: () => unknown) {
  await render(
    <ThemeProvider>
      <Button label="Save" onPress={onPress} />
    </ThemeProvider>,
  );
}

describe('Button', () => {
  it('ignores taps while its action is still running', async () => {
    const pending = deferred();
    const onPress = jest.fn(() => pending.promise);
    await show(onPress);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('runs a plain action on every tap', async () => {
    const onPress = jest.fn();
    await show(onPress);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).toHaveBeenCalledTimes(2);
  });
});
