import { useEffect, useState } from 'react';
import { authApi } from '../services/api';
import { useUserStore } from '../stores/useUserStore';

export function useCurrentUser() {
  const { user, setUser, clearUser } = useUserStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then(({ data }) => {
        setUser(data.user, data.sessionId);
      })
      .catch(() => {
        clearUser();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setUser, clearUser]);

  return { user, loading };
}
