import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';

import { useOutbox } from '@/features/outbox/outbox';
import type { OutboxItem } from '@/features/outbox/rules';
import type { WorkoutDraft } from '@/features/workout/rules';
import { useWorkout } from '@/features/workout/store';
import { ApiError } from '@/shared/api/fetcher';
import {
  checkResetToken,
  forgotPassword,
  resetPassword,
} from '@/shared/api/generated/endpoints/auth/auth';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { LogInScreen } from '../screens/LogInScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { logIn, signUp } from '../session';
import { useAuthStore } from '../store';

const mockSearchParams: { token?: string } = {};
const mockRedirect = jest.fn();

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockSearchParams,
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));

jest.mock('../session', () => ({
  logIn: jest.fn(),
  signUp: jest.fn(),
  forgetSession: jest.fn(),
}));

jest.mock('@/shared/api/generated/endpoints/auth/auth', () => ({
  checkResetToken: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
}));

function open(Screen: ComponentType) {
  return render(
    <ThemeProvider>
      <Screen />
    </ThemeProvider>,
  );
}

function apiError(status: number, code: string) {
  return new ApiError({ type: 'about:blank', title: code, status, code });
}

const tooCommon = new ApiError({
  type: 'about:blank',
  title: 'Validation error',
  status: 422,
  code: 'validation_error',
  errors: [{ field: 'password', code: 'password_too_common', message: 'too common' }],
});

const TOO_COMMON = 'This password is too common. Try a longer or less predictable one.';

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  jest.clearAllMocks();
  delete mockSearchParams.token;
  useAuthStore.setState({ status: 'signedOut', accessToken: null, expired: false });
});

describe('Welcome', () => {
  it('opens normally for a new visitor', async () => {
    await open(WelcomeScreen);

    expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('hands over to log in, which explains that the session expired', async () => {
    useAuthStore.setState({ expired: true });

    await open(WelcomeScreen);

    expect(mockRedirect).toHaveBeenCalledWith('/log-in');
    expect(screen.queryByRole('button', { name: 'Get started' })).toBeNull();
  });
});

describe('Sign up', () => {
  it('explains a wrong email as soon as the field loses focus', async () => {
    await open(SignUpScreen);
    const email = screen.getByLabelText('Email');

    await fireEvent.changeText(email, 'alex@');
    await fireEvent(email, 'blur');

    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
  });

  it('does not send an incomplete form', async () => {
    await open(SignUpScreen);

    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter your name.')).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('shows the answer of the server under the email field', async () => {
    (signUp as jest.Mock).mockRejectedValue(apiError(409, 'email_taken'));
    await open(SignUpScreen);

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Alex Morgan');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'alex@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'correct-horse');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('An account with this email already exists.')).toBeTruthy();
    expect(signUp).toHaveBeenCalledWith('Alex Morgan', 'alex@example.com', 'correct-horse');
  });

  it('asks for another password when this one is too common', async () => {
    (signUp as jest.Mock).mockRejectedValue(tooCommon);
    await open(SignUpScreen);

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Alex Morgan');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'alex@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(TOO_COMMON)).toBeTruthy();
  });
});

describe('Log in', () => {
  it('does not say which of the two was wrong', async () => {
    (logIn as jest.Mock).mockRejectedValue(apiError(401, 'invalid_credentials'));
    await open(LogInScreen);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'alex@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();
  });

  it('sends one request when the button and the keyboard fire together', async () => {
    let finish: () => void = () => undefined;
    (logIn as jest.Mock).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    await open(LogInScreen);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'alex@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'correct-horse');

    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await fireEvent(screen.getByLabelText('Password'), 'submitEditing');
    await act(async () => {
      finish();
    });

    expect(logIn).toHaveBeenCalledTimes(1);
  });

  it('tells why the user has to log in again', async () => {
    useAuthStore.setState({ expired: true });

    await open(LogInScreen);

    expect(screen.getByText('Your session has expired')).toBeTruthy();
    expect(screen.getByText('Log in again to keep going.')).toBeTruthy();
  });

  it('says that the workout and the changes waiting on the device are safe', async () => {
    useAuthStore.setState({ expired: true });
    useWorkout.setState({ draft: { id: 'workout' } as WorkoutDraft });
    useOutbox.setState({ items: [{ id: 'one' }, { id: 'two' }] as OutboxItem[] });

    await open(LogInScreen);

    expect(
      screen.getByText('Log in again to keep going. Your workout is safe on this device. 2 changes waiting on this device sync once you’re back in.'),
    ).toBeTruthy();
    useWorkout.setState({ draft: null });
    useOutbox.setState({ items: [] });
  });

  it('shows and hides the password', async () => {
    await open(LogInScreen);
    const password = screen.getByLabelText('Password');
    expect(password.props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByText('Show password'));

    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
  });
});

describe('Forgot password', () => {
  async function sendLink() {
    (forgotPassword as jest.Mock).mockResolvedValue({ status: 202, data: undefined });
    await open(ForgotPasswordScreen);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'alex@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('confirms in neutral words that a link was sent', async () => {
    await sendLink();

    expect(await screen.findByText('Check your inbox')).toBeTruthy();
    expect(
      screen.getByText(
        'If an account exists for alex@example.com, we sent a link. It expires in 30 minutes.',
      ),
    ).toBeTruthy();
    expect(forgotPassword).toHaveBeenCalledWith({ email: 'alex@example.com' });
  });

  it('replaces the form, so the link cannot be sent twice by accident', async () => {
    await sendLink();

    expect(await screen.findByText('Check your inbox')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send reset link' })).toBeNull();
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('lets the user send again only after a minute', async () => {
    jest.useFakeTimers();
    await sendLink();
    expect(await screen.findByRole('button', { name: 'Send again in 60 s', disabled: true })).toBeTruthy();

    for (let second = 0; second < 60; second += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Send again' }));

    expect(forgotPassword).toHaveBeenCalledTimes(2);
  });

  it('goes back to the form to fix the email', async () => {
    await sendLink();

    await fireEvent.press(await screen.findByText('Use a different email'));

    expect(screen.getByLabelText('Email').props.value).toBe('alex@example.com');
  });
});

describe('Reset password', () => {
  const linkWorks = { status: 204, data: undefined };

  async function openWithToken(check: () => Promise<unknown>) {
    mockSearchParams.token = 'emailed-token';
    (checkResetToken as jest.Mock).mockImplementation(check);
    await open(ResetPasswordScreen);
  }

  async function fillAndSave(password: string, confirmPassword: string) {
    await fireEvent.changeText(await screen.findByLabelText('New password'), password);
    await fireEvent.changeText(screen.getByLabelText('Repeat new password'), confirmPassword);
    await fireEvent.press(screen.getByRole('button', { name: 'Save password' }));
  }

  it('says at once that a used link no longer works', async () => {
    await openWithToken(() => Promise.reject(apiError(400, 'invalid_reset_link')));

    expect(await screen.findByText('This link no longer works')).toBeTruthy();
    expect(screen.queryByLabelText('New password')).toBeNull();
    expect(checkResetToken).toHaveBeenCalledWith(
      { token: 'emailed-token' },
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('opens the form when the server cannot be reached for the check', async () => {
    await openWithToken(() => Promise.reject(apiError(0, 'network_error')));

    expect(await screen.findByLabelText('New password')).toBeTruthy();
  });

  it('asks to type the same password twice', async () => {
    await openWithToken(() => Promise.resolve(linkWorks));

    await fillAndSave('correct-horse', 'correct-house');

    expect(await screen.findByText('Passwords don’t match.')).toBeTruthy();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('saves the new password', async () => {
    (resetPassword as jest.Mock).mockResolvedValue(linkWorks);
    await openWithToken(() => Promise.resolve(linkWorks));

    await fillAndSave('correct-horse', 'correct-horse');

    expect(await screen.findByText('Password updated')).toBeTruthy();
    expect(resetPassword).toHaveBeenCalledWith({
      token: 'emailed-token',
      new_password: 'correct-horse',
    });
  });

  it('asks for another password when this one is too common', async () => {
    (resetPassword as jest.Mock).mockRejectedValue(tooCommon);
    await openWithToken(() => Promise.resolve(linkWorks));

    await fillAndSave('password123', 'password123');

    expect(await screen.findByText(TOO_COMMON)).toBeTruthy();
  });
});
