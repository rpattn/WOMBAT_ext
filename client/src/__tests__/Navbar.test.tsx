import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/test-utils';
import Navbar from '../components/Navbar';

describe('Navbar', () => {
  test('renders links and toggles active class by route', async () => {
    const user = userEvent.setup();
    // Start at results route
    renderWithProviders(<Navbar />, { routerProps: { initialEntries: ['/results'] } });

    // Links present
    const linkSim = screen.getByRole('link', { name: /simulation manager/i });
    const linkResults = screen.getByRole('link', { name: /results/i });

    expect(linkResults).toHaveClass('active');
    expect(linkSim).not.toHaveClass('active');

    // Navigate to root
    await user.click(linkSim);
    expect(linkSim).toHaveClass('active');
    expect(linkResults).not.toHaveClass('active');
  });
});
