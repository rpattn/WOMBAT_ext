import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/test-utils';
import App from '../App';

// Basic smoke tests for Results Compare page customizations
// - YAML-only list in the FileSelector
// - Multi-select highlighting
// - Auto-expansion to results and first subfolder (implicit by visible rows)

test('Results Compare shows YAML-only and supports multi-select highlight', async () => {
  const user = userEvent.setup();
  renderWithProviders(<App />, { routerProps: { initialEntries: ['/results/compare'] } });

  // Wait for the FileSelector (role tree, aria-label is project name)
  const tree = await screen.findByRole('tree', { name: /library files/i });
  expect(tree).toBeInTheDocument();

  // The count line should show CSV/HTML/PNG as 0 on this page filtering
  const count = (tree as HTMLElement).querySelector('.file-count');
  expect(count).toBeTruthy();
  const countText = (count?.textContent || '').toLowerCase();
  // Format is like: "0 YAML, 0 CSV, 0 HTML, 0 PNG"
  expect(countText).toMatch(/\d+\s+yaml/);
  expect(countText).toMatch(/0\s+csv/);
  expect(countText).toMatch(/0\s+html/);
  expect(countText).toMatch(/0\s+png/);

  // Click two YAML files under results to toggle selection and verify highlight
  // Find any two tree items that look like YAML files
  const yamlItems = await screen.findAllByRole('treeitem', { name: /\.ya?ml$/i }).catch(() => [] as HTMLElement[]);
  if (yamlItems.length >= 2) {
    // Click first two distinct YAML items
    await user.click(yamlItems[0]);
    await user.click(yamlItems[1]);

    // Their parent rows should have the 'selected' class applied
    const row1 = yamlItems[0].closest('.tree-file') as HTMLElement | null;
    const row2 = yamlItems[1].closest('.tree-file') as HTMLElement | null;
    expect(row1).toBeTruthy();
    expect(row2).toBeTruthy();
    expect(row1!).toHaveClass('selected');
    expect(row2!).toHaveClass('selected');

    // Load Selected button should enable when at least one item is selected
    const panelBody = tree.closest('.panel-body') as HTMLElement | null;
    const loadBtn = within(panelBody || document.body).getByRole('button', { name: /load selected/i });
    expect(loadBtn).not.toBeDisabled();
  } else {
    // If no YAML files in the mock, ensure button remains disabled
    const panelBody = tree.closest('.panel-body') as HTMLElement | null;
    const loadBtn = within(panelBody || document.body).getByRole('button', { name: /load selected/i });
    expect(loadBtn).toBeDisabled();
  }
});
