import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { authApi } from './services/api';
import { useUserStore } from './stores/useUserStore';
import { SocketProvider } from './hooks/SocketContext';
import { NotificationLayer } from './components/NotificationLayer/NotificationLayer';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { EventList } from './pages/EventList/EventList';
import { AuthScreen } from './pages/AuthScreen/AuthScreen';
import { EventDashboard } from './pages/EventDashboard/EventDashboard';
import { EventSummary } from './pages/EventSummary/EventSummary';

function AppRoutes() {
  const { user, setUser, clearUser } = useUserStore();
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    authApi
      .me()
      .then(({ data }) => {
        setUser(data.user, data.sessionId);
        const path = window.location.pathname;
        if (path === '/' || path === '/auth') {
          navigate('/dashboard');
        }
      })
      .catch(() => {
        clearUser();
      })
      .finally(() => {
        setAuthChecked(true);
      });
  }, [setUser, clearUser, navigate]);

  if (!authChecked) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}
        aria-label="Loading"
      >
        Sync is loading…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<EventList />} />
      <Route path="/auth" element={<AuthScreen />} />
      <Route
        path="/dashboard"
        element={user ? <EventDashboard /> : <Navigate to="/" replace />}
      />
      <Route
        path="/dashboard/:eventId"
        element={user ? <EventDashboard /> : <Navigate to="/" replace />}
      />
      <Route
        path="/summary"
        element={user ? <EventSummary /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary component="App">
      <BrowserRouter>
        <SocketProvider>
          <NotificationLayer />
          <AppRoutes />
        </SocketProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
