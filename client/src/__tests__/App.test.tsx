import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/test-utils';
import App from '../App';

// Ensure matchMedia is available for ThemeSelector in this test context
beforeAll(() => {
  if (typeof window !== 'undefined' && (typeof window.matchMedia !== 'function')) {
    (window as any).matchMedia = (query: string) => ({
      media: query,
      matches: false,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    } as any);
  }
});

describe('App', () => {
  test('renders navbar and routes between pages', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { routerProps: { initialEntries: ['/'] } });

    // Navbar brand
    expect(screen.getByText('WOMBAT')).toBeInTheDocument();

    // Simulation Manager link should be active on root
    const simLink = screen.getByRole('link', { name: /simulation manager/i });
    expect(simLink).toHaveClass('active');

    // Navigate to Results
    await user.click(screen.getByRole('link', { name: /results/i }));
    expect(screen.getByRole('heading', { level: 2, name: /results/i })).toBeInTheDocument();

    // Navigate to Connect panel (navbar label still says WebSocket Client)
    await user.click(screen.getByRole('link', { name: /websocket client/i }));
    // The details element summary shows REST Client now
    const matches = screen.getAllByText(/rest client/i);
    const summaryEl = matches.find((el) => el.tagName.toLowerCase() === 'summary');
    expect(summaryEl).toBeTruthy();
  });
});
