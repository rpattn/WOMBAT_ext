import React from 'react';
import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { MemoryRouterProps } from 'react-router-dom';
import { render } from '@testing-library/react';
import { ToastProvider } from '../components/ToastManager';
import { WebSocketProvider } from '../context/WebSocketContext';

export function Providers({ children, routerProps }: PropsWithChildren & { routerProps?: MemoryRouterProps }) {
  return (
    <MemoryRouter {...routerProps}>
      <ToastProvider>
        <WebSocketProvider>
          {children}
        </WebSocketProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Parameters<typeof render>[1] & { routerProps?: MemoryRouterProps }
) {
  const { routerProps, ...rest } = options ?? {} as any;
  const Wrapper = (props: PropsWithChildren) => (
    <Providers routerProps={routerProps}>{props.children}</Providers>
  );
  return render(ui, { wrapper: Wrapper, ...rest });
}
