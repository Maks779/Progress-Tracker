import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { forgetSession, signOut } from '@/features/auth/session';
import { useAuthStore } from '@/features/auth/store';
import { enqueue, useOutbox } from '@/features/outbox/outbox';
import { ApiError } from '@/shared/api/fetcher';
import {
  changePassword,
  deleteAccount,
  updateMe,
  useReadMe,
} from '@/shared/api/generated/endpoints/me/me';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { usePreferences } from '../preferences';
import { ProfileScreen } from '../screens/ProfileScreen';

jest.mock('@/shared/api/generated/endpoints/me/me', () => ({
  useReadMe: jest.fn(),
  getReadMeQueryKey: () => ['/api/v1/me'],
  changePassword: jest.fn(),
  deleteAccount: jest.fn(),
  updateMe: jest.fn(),
}));

jest.mock('@/features/auth/session', () => ({
  signOut: jest.fn(),
  forgetSession: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
  useRouter: () => ({ push: mockPush }),
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

let queryClient = new QueryClient();

async function open() {
  queryClient = new QueryClient();
  await render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ProfileScreen />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function apiError(status: number, code: string, fieldCode?: string) {
  return new ApiError({
    type: 'about:blank',
    title: code,
    status,
    code,
    errors: fieldCode ? [{ field: 'new_password', code: fieldCode, message: fieldCode }] : null,
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await i18n.changeLanguage('en');
  usePreferences.setState({
    values: { language: 'en', theme: 'system', weight_unit: 'kg', distance_unit: 'km', notify_rest_timer: true, notify_weekly_reminder: true },
    pending: [],
    hydrated: true,
  });
  profile();
  useAuthStore.setState({ status: 'signedIn' });
  useOutbox.setState({ hydrated: true, items: [], syncing: false, retryAt: null });
});

const BODY = { tracker_id: 'gym', started_at: '2026-11-26T17:00:00Z', local_date: '2026-11-26' };

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

  it('opens goals and trackers from the links card', async () => {
    profile();
    await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Goals' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Trackers' }));

    expect(mockPush).toHaveBeenNthCalledWith(1, '/profile/goals');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/profile/trackers');
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

describe('Log out', () => {
  it('signs out at once when nothing waits to be sent', async () => {
    await enqueue({ kind: 'session', id: 'theirs', userId: 'other', body: BODY });
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    expect(signOut).toHaveBeenCalled();
    expect(useOutbox.getState().items.map((item) => item.id)).toEqual(['theirs']);
  });

  it('asks first when changes have not reached the server, and deletes them from the device', async () => {
    await enqueue({ kind: 'session', id: 'mine', userId: '1', body: BODY });
    await enqueue({ kind: 'exercise', id: 'curl', userId: '1', body: { name: 'Spider curl', muscle_group: 'arms', equipment: 'dumbbell' } });
    await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    expect(screen.getByText('Log out with unsynced changes?')).toBeTruthy();
    expect(screen.getByText(/^2 changes made on this device haven’t reached the server yet/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Stay logged in' }));
    expect(signOut).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Log out anyway' }));
    expect(signOut).toHaveBeenCalled();
    expect(useOutbox.getState().items).toEqual([]);
    expect(await AsyncStorage.getAllKeys()).not.toContain('ember.outbox.session.mine');
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

  it('leaves none of the account’s waiting changes on the device', async () => {
    (deleteAccount as jest.Mock).mockResolvedValue({ status: 204, data: undefined });
    await enqueue({ kind: 'session', id: 'mine', userId: '1', body: BODY });
    await openSheet();

    await fireEvent.changeText(screen.getByLabelText('Current password'), 'correct-horse');
    await fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));

    expect(forgetSession).toHaveBeenCalled();
    expect(useOutbox.getState().items).toEqual([]);
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

describe('Edit name', () => {
  it('opens with the current name and refuses an empty one', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
    const field = screen.getByLabelText('Name');
    expect(field.props.value).toBe('Alex Morgan');

    await fireEvent.changeText(field, '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Enter your name.')).toBeTruthy();
    expect(updateMe).not.toHaveBeenCalled();
  });

  it('saves the trimmed name and shows the server answer on the card', async () => {
    const saved = { status: 200, headers: new Headers(), data: { ...ALEX, name: 'Alex M.' } };
    (updateMe as jest.Mock).mockResolvedValue(saved);
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));

    await fireEvent.changeText(screen.getByLabelText('Name'), '  Alex M.  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(updateMe).toHaveBeenCalledWith({ name: 'Alex M.' });
    expect(queryClient.getQueryData(['/api/v1/me'])).toBe(saved);
    expect(screen.queryByText('Your name')).toBeNull();
  });

  it('keeps the sheet open and says why when the server cannot be reached', async () => {
    (updateMe as jest.Mock).mockRejectedValue(apiError(0, 'network_error'));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Sam');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Can’t reach the server. Check your connection and try again.')).toBeTruthy();
    expect(screen.getByText('Your name')).toBeTruthy();
  });
});

describe('Change password', () => {
  async function fill(current: string, password: string, repeat = password) {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Change password' }));
    await fireEvent.changeText(screen.getByLabelText('Current password'), current);
    await fireEvent.changeText(screen.getByLabelText('New password'), password);
    await fireEvent.changeText(screen.getByLabelText('Repeat new password'), repeat);
    const buttons = screen.getAllByRole('button', { name: 'Change password' });
    await fireEvent.press(buttons[buttons.length - 1]);
  }

  it('asks for the same new password twice', async () => {
    await fill('old-password-1', 'Quiet-Harbor-Maple-7', 'Quiet-Harbor-Maple-8');

    expect(await screen.findByText('Passwords don’t match.')).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('refuses a new password equal to the current one', async () => {
    await fill('Quiet-Harbor-Maple-7', 'Quiet-Harbor-Maple-7');

    expect(await screen.findByText('Choose a password different from the current one.')).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('marks the current password when the server says it is wrong', async () => {
    (changePassword as jest.Mock).mockRejectedValue(apiError(401, 'invalid_credentials'));

    await fill('wrong-password', 'Quiet-Harbor-Maple-7');

    expect(await screen.findByText('This password is incorrect.')).toBeTruthy();
  });

  it('marks the new password when it is too common', async () => {
    (changePassword as jest.Mock).mockRejectedValue(apiError(422, 'validation_error', 'password_too_common'));

    await fill('old-password-1', 'password123');

    expect(
      await screen.findByText('This password is too common. Try a longer or less predictable one.'),
    ).toBeTruthy();
  });

  it('says this device stays signed in once the password is changed', async () => {
    (changePassword as jest.Mock).mockResolvedValue({ status: 204, data: undefined });

    await fill('old-password-1', 'Quiet-Harbor-Maple-7');

    expect(changePassword).toHaveBeenCalledWith({
      current_password: 'old-password-1',
      new_password: 'Quiet-Harbor-Maple-7',
    });
    expect(await screen.findByText('Password changed')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('Password changed')).toBeNull();
  });

  it('opens empty again after it was closed', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Change password' }));
    await fireEvent.changeText(screen.getByLabelText('Current password'), 'typed');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Change password' }));

    expect(screen.getByLabelText('Current password').props.value).toBe('');
  });
});
