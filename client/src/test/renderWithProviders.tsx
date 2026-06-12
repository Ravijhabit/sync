import { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SocketContext } from '../hooks/SocketContext';
import { createMockSocket } from '../__mocks__/socket';
import type { SocketContextValue } from '../hooks/types';

interface RenderOptions {
  route?: string;
  routePattern?: string;
  socketOverrides?: Partial<SocketContextValue>;
}

export function renderWithProviders(
  ui: ReactNode,
  { route = '/', routePattern, socketOverrides = {} }: RenderOptions = {}
) {
  const socket = createMockSocket();
  const contextValue: SocketContextValue = {
    socket: socket as SocketContextValue['socket'],
    connected: true,
    ...socketOverrides,
  };

  const content = routePattern ? (
    <Routes>
      <Route path={routePattern} element={ui} />
    </Routes>
  ) : ui;

  return {
    ...render(
      <MemoryRouter initialEntries={[route]}>
        <SocketContext.Provider value={contextValue}>
          {content}
        </SocketContext.Provider>
      </MemoryRouter>
    ),
    socket,
  };
}
