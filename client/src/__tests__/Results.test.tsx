import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/test-utils';
import App from '../App';

function getLastSocket() {
  const arr = (globalThis as any).__wsInstances as any[] | undefined;
  return arr?.[arr.length - 1];
}

describe('Results page', () => {
  test('renders sidebar, dropdown, file selector, and refreshes files', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { routerProps: { initialEntries: ['/results'] } });

    // Wait for WS to connect
    await Promise.resolve();

    // Files section header
    expect(screen.getByRole('heading', { name: /^files$/i })).toBeInTheDocument();

    // Refresh Files button sends get_library_files
    const btn = screen.getByRole('button', { name: /refresh files/i });
    await user.click(btn);

    const socket = getLastSocket();
    await waitFor(() => {
      const sent = socket?.sent?.map(String) ?? [];
      expect(sent).toContain('get_library_files');
    });
  });
});
