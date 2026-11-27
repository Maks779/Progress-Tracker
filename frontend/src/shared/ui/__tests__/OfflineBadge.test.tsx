import { act, render, screen } from '@testing-library/react-native';
import { HeaderShownContext } from 'expo-router/react-navigation';

import { useConnection } from '@/shared/api/connection';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { Screen } from '../Screen';

async function page(props: { offlineBadge?: boolean } = {}, underTopBar = false) {
  await render(
    <ThemeProvider>
      <HeaderShownContext.Provider value={underTopBar}>
        <Screen title="Trackers" {...props} />
      </HeaderShownContext.Provider>
    </ThemeProvider>,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  useConnection.setState({ online: true, reachable: true });
});

describe('The offline badge', () => {
  it('appears above the title while offline and goes once the server answers', async () => {
    await page();
    expect(screen.queryByText('Offline')).toBeNull();

    await act(async () => useConnection.setState({ reachable: false }));
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getByLabelText('Offline. You’re seeing what was saved on this device.')).toBeTruthy();

    await act(async () => useConnection.setState({ reachable: true }));
    expect(screen.queryByText('Offline')).toBeNull();
  });

  it('is left to the top bar when there is one, and to the page that says more itself', async () => {
    useConnection.setState({ online: false });
    await page({}, true);
    expect(screen.queryByText('Offline')).toBeNull();
    await page({ offlineBadge: false });
    expect(screen.queryByText('Offline')).toBeNull();
  });
});
