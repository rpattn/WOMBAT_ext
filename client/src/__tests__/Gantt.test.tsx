import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/test-utils';
import App from '../App';

// Gantt page should show only CSV files in its FileSelector counts

test('Gantt file selector shows CSV-only counts', async () => {
  renderWithProviders(<App />, { routerProps: { initialEntries: ['/results/gantt'] } });

  // Wait for the panel to render
  const title = await screen.findByRole('heading', { level: 3, name: /project/i });
  expect(title).toBeInTheDocument();

  // Find the FileSelector tree (aria-label is project name)
  const tree = await screen.findByRole('tree', { name: /library files/i });
  expect(tree).toBeInTheDocument();

  const countEl = (tree as HTMLElement).querySelector('.file-count');
  expect(countEl).toBeTruthy();
  const countText = (countEl?.textContent || '').toLowerCase();

  // YAML/HTML/PNG should be zero on this page (format: "0 yaml, 0 csv, ...")
  expect(countText).toMatch(/\b0\s+yaml\b/);
  expect(countText).toMatch(/\b0\s+html\b/);
  expect(countText).toMatch(/\b0\s+png\b/);
  // CSV is present (could be 0 in some mocks, but format should be shown)
  expect(countText).toMatch(/\b\d+\s+csv\b/);
});
