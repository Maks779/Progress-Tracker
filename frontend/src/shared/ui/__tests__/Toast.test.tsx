import { act, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { showToast, TOAST_MS, ToastHost } from '../Toast';

describe('The toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows one line and goes by itself; a new one restarts the time', async () => {
    await render(
      <ThemeProvider>
        <ToastHost />
      </ThemeProvider>,
    );
    expect(screen.queryByText('Reading saved. Nice work.')).toBeNull();

    await act(async () => showToast('Reading saved. Nice work.'));
    expect(screen.getByText('Reading saved. Nice work.')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(TOAST_MS - 100);
    });
    await act(async () => showToast('Session saved. Nice work.'));
    await act(async () => {
      jest.advanceTimersByTime(TOAST_MS - 100);
    });
    expect(screen.getByText('Session saved. Nice work.')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Session saved. Nice work.')).toBeNull();
  });
});
