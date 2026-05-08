import { useState, useCallback } from 'react';
import { useAuthStore } from '../store/useEditorStore';

const API = '/api';

export function useAuth() {
  const { token, user, setAuth, clearAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(async (email: string, username: string, password: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setAuth(data.token, data.user);
      return true;
    } catch (e: any) {
      setError(e.message); return false;
    } finally {
      setLoading(false);
    }
  }, [setAuth]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setAuth(data.token, data.user);
      return true;
    } catch (e: any) {
      setError(e.message); return false;
    } finally {
      setLoading(false);
    }
  }, [setAuth]);

  const logout = useCallback(() => clearAuth(), [clearAuth]);

  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    return fetch(`${API}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  }, [token]);

  return { user, token, loading, error, register, login, logout, authFetch, isAuthenticated: !!token };
}
