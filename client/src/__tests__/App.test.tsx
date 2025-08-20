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
    expect(screen.getByText('WOMBAT_ext')).toBeInTheDocument();

    // Home is active on root
    const homeLink = screen.getByRole('link', { name: /home/i });
    expect(homeLink).toHaveClass('active');

    // Navigate to Simulation Manager
    const simLink = screen.getByRole('link', { name: /simulation manager/i });
    await user.click(simLink);
    expect(simLink).toHaveClass('active');

    // Navigate to Results
    await user.click(screen.getByRole('link', { name: /results/i }));
    expect(await screen.findByRole('heading', { level: 2, name: /results/i })).toBeInTheDocument();

    // Navigate to Connection Manager
    await user.click(screen.getByRole('link', { name: /connection manager/i }));
  });
});
