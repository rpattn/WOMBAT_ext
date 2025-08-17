import { screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/test-utils';
import App from '../App';

describe('Results page', () => {
  test('renders sidebar and triggers REST refresh for files', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch');

    renderWithProviders(<App />, { routerProps: { initialEntries: ['/results'] } });

    // Files section summary is rendered as a <summary>, not a heading
    const filesSummary = await screen.findByText(/^files$/i);
    expect(filesSummary).toBeInTheDocument();
    const filesDetails = filesSummary.closest('details') as HTMLDetailsElement | null;
    expect(filesDetails).toBeTruthy();

    // Click Refresh Files triggers GET /api/{id}/library/files
    const btn = within(filesDetails as HTMLElement).getByRole('button', { name: /refresh files/i });
    await user.click(btn);

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((c: any[]) => String(c[0]));
      const matched = calls.some((u: string) => /\/api\/[^/]+\/library\/files$/.test(u));
      expect(matched).toBe(true);
    });
  });
});
