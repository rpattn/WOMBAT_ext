import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/test-utils';
import RestClient from '../components/RestClient';

describe('RestClient', () => {
  test('shows basic REST controls and initializes a session', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch');

    renderWithProviders(<RestClient />);

    // UI elements
    expect(screen.getByText(/server rest api base url/i)).toBeInTheDocument();
    const initBtn = screen.getByRole('button', { name: /init session/i });
    expect(initBtn).toBeInTheDocument();

    await user.click(initBtn);

    // Expect a POST /api/session among fetch calls
    const sawSessionPost = fetchSpy.mock.calls.some((args: any[]) => {
      const url = String(args[0]);
      const init = args[1] as RequestInit | undefined;
      return url.endsWith('/api/session') && (!init || (init.method || 'GET').toUpperCase() === 'POST');
    });
    expect(sawSessionPost).toBe(true);
  });
});
