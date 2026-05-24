import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect } from 'react';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Base axios instance — all API calls go through here.
 * Auth token is injected per-request via the interceptor set up in useApiAuth().
 */
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

const randomUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Call this hook once at the app root to wire Clerk token into every request.
 * getToken() fetches from SecureStore cache (no network call if valid).
 *
 * Usage: Call useApiAuth() inside ClerkProvider context (e.g. in root _layout).
 */
export function useApiAuth() {
  const { getToken } = useAuth();

  useEffect(() => {
    const interceptor = apiClient.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Propagate a trace ID for observability safely
      config.headers['X-Trace-Id'] = randomUUID();
      return config;
    });

    return () => {
      apiClient.interceptors.request.eject(interceptor);
    };
  }, [getToken]);
}
