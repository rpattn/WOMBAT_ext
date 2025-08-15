import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../test/test-utils';
import WebSocketClient from '../components/WebSocketClient';

function getLastSocket() {
  const arr = (globalThis as any).__wsInstances as any[] | undefined;
  return arr?.[arr.length - 1];
}

describe('WebSocketClient', () => {
  test('auto-connects, sends initial messages, and renders incoming messages', async () => {
    renderWithProviders(<WebSocketClient />);

    // Wait microtask turn for mock to open
    await Promise.resolve();

    const socket = getLastSocket();
    expect(socket).toBeTruthy();

    // Should auto-send get_library_files and list_saved_libraries
    // Give a tick for component effects to run
    await Promise.resolve();

    const sent = socket.sent.map(String);
    expect(sent).toEqual(
      expect.arrayContaining([
        'get_library_files',
        expect.stringContaining('list_saved_libraries'),
      ])
    );

    // Simulate incoming non-JSON message
    socket.receive('hello from server');

    // Expand details to view messages list
    const details = screen.getByText(/messages \(/i).closest('details');
    if (details && !details.open) {
      (details as HTMLDetailsElement).open = true;
    }
    const messagesRegion = within(screen.getByText(/messages \(/i).parentElement!.parentElement!);
    expect(await messagesRegion.findByText(/\[server] hello from server/i)).toBeInTheDocument();
  });
});
