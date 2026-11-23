import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { forgetSession } from '@/features/auth/session';
import { ApiError } from '@/shared/api/fetcher';
import { deleteAccount, useReadMe } from '@/shared/api/generated/endpoints/me/me';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { usePreferences } from '../preferences';
import { ProfileScreen } from '../screens/ProfileScreen';

jest.mock('@/shared/api/generated/endpoints/me/me', () => ({
  useReadMe: jest.fn(),
  deleteAccount: jest.fn(),
  updateMe: jest.fn(),
}));

jest.mock('@/features/auth/session', () => ({
  signOut: jest.fn(),
  forgetSession: jest.fn(),
}));

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
}));

const readMe = useReadMe as jest.Mock;
const ALEX = {
  id: '1',
  email: 'alex@example.com',
  name: 'Alex Morgan',
  timezone: 'Europe/Warsaw',
  language: 'en',
  theme: 'system',
  weight_unit: 'kg',
  distance_unit: 'km',
};

function profile(state: { data?: unknown; isPending?: boolean } = { data: { status: 200, data: ALEX } }) {
  readMe.mockReturnValue({ isPending: false, refetch: jest.fn(), ...state });
}

async function open() {
  await render(
    <ThemeProvider>
      <ProfileScreen />
    </ThemeProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await i18n.changeLanguage('en');
  usePreferences.setState({
    values: { language: 'en', theme: 'system', weight_unit: 'kg', distance_unit: 'km' },
    pending: [],
    hydrated: true,
  });
  profile();
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('Profile', () => {
  it('shows who is signed in; the initials are decoration for screen readers', async () => {
    await open();

    expect(screen.getByText('Alex Morgan')).toBeTruthy();
    expect(screen.getByText('alex@example.com')).toBeTruthy();
    expect(screen.getByText('AM', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('AM')).toBeNull();
  });

  it('offers a retry when the profile cannot be loaded', async () => {
    const refetch = jest.fn();
    readMe.mockReturnValue({ isPending: false, data: undefined, refetch });
    await open();

    await fireEvent.press(screen.getByText('Try again'));

    expect(screen.getByText('Couldn’t load your profile.')).toBeTruthy();
    expect(refetch).toHaveBeenCalled();
  });

  it('changes a unit with one tap and says it is only on this device until it syncs', async () => {
    await open();
    expect(screen.getByRole('radio', { name: 'kg', checked: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'lb' }));

    expect(usePreferences.getState()).toMatchObject({ values: { weight_unit: 'lb' }, pending: ['weight_unit'] });
    expect(screen.getByRole('radio', { name: 'lb', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'kg', checked: false })).toBeTruthy();
    expect(screen.getByText('Saved on this device. It will sync when you’re back online.')).toBeTruthy();
  });

  it('lists every language in its own name and switches the whole screen', async () => {
    await open();

    await fireEvent.press(screen.getByRole('radio', { name: 'Українська' }));

    expect(screen.getByText('Твій простір, твої правила.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'English' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Polski' })).toBeTruthy();
  });
});

describe('Delete account', () => {
  async function openSheet() {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  }

  it('asks for the password before anything is deleted', async () => {
    await openSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));

    expect(await screen.findByText('Enter your password.')).toBeTruthy();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('says when the password is wrong and keeps the account', async () => {
    (deleteAccount as jest.Mock).mockRejectedValue(
      new ApiError({ type: 'about:blank', title: 'x', status: 401, code: 'invalid_credentials' }),
    );
    await openSheet();

    await fireEvent.changeText(screen.getByLabelText('Current password'), 'wrong-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));

    expect(await screen.findByText('This password is incorrect.')).toBeTruthy();
    expect(forgetSession).not.toHaveBeenCalled();
  });

  it('deletes the account and ends the session on this device', async () => {
    (deleteAccount as jest.Mock).mockResolvedValue({ status: 204, data: undefined });
    await openSheet();

    await fireEvent.changeText(screen.getByLabelText('Current password'), 'correct-horse');
    await fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));

    expect(deleteAccount).toHaveBeenCalledWith({ password: 'correct-horse' });
    expect(forgetSession).toHaveBeenCalled();
  });

  it('tells when there were too many attempts', async () => {
    (deleteAccount as jest.Mock).mockRejectedValue(
      new ApiError({ type: 'about:blank', title: 'x', status: 429, code: 'rate_limited' }),
    );
    await openSheet();

    await fireEvent.changeText(screen.getByLabelText('Current password'), 'guess');
    await fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));

    expect(await screen.findByText('Too many attempts. Try again in a few minutes.')).toBeTruthy();
  });
});
