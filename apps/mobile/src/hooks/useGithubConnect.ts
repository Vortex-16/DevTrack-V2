import { useState, useCallback, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/src/api/client';

WebBrowser.maybeCompleteAuthSession();

type ConnectState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'success'; login: string }
  | { status: 'error'; message: string };

/**
 * useGithubConnect — manages the full GitHub OAuth flow for mobile.
 *
 * Flow:
 *  1. connect() → GET /api/v1/github/connect → receives OAuth URL
 *  2. Opens OAuth URL in expo-web-browser (AuthSession)
 *  3. GitHub → API callback → API redirects to devtrack://oauth/github?success=true
 *  4. App receives deep link via Linking event listener
 *  5. Invalidates ['github-status'] query to refetch connection status
 *
 * Why expo-web-browser instead of Linking.openURL?
 *  AuthSession opens a secure in-app browser that shares the system cookie jar
 *  (important for GitHub's auth flow) and can be dismissed programmatically.
 */
export function useGithubConnect() {
  const [state, setState] = useState<ConnectState>({ status: 'idle' });
  const queryClient = useQueryClient();

  // Listen for deep link callback from GitHub OAuth redirect
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });
    return () => subscription.remove();
  }, []);

  const handleDeepLink = useCallback(
    (url: string) => {
      const parsed = Linking.parse(url);

      // Only handle our OAuth deep links
      if (parsed.path !== 'oauth/github') return;

      const success = parsed.queryParams?.success === 'true';
      const login = parsed.queryParams?.login as string | undefined;
      const error = parsed.queryParams?.error as string | undefined;

      if (success && login) {
        setState({ status: 'success', login });
        // Invalidate queries so UI refreshes immediately
        void queryClient.invalidateQueries({ queryKey: ['github-status'] });
        void queryClient.invalidateQueries({ queryKey: ['profile'] });
      } else {
        setState({
          status: 'error',
          message: error ? decodeURIComponent(error) : 'GitHub connection failed',
        });
      }
    },
    [queryClient],
  );

  const connect = useCallback(async () => {
    setState({ status: 'connecting' });
    try {
      // Create dynamic deep link depending on environment (Expo Go vs Standalone)
      const redirectUri = Linking.createURL('oauth/github');

      // 1. Get OAuth URL from our API, passing our dynamic redirect URI
      const res = await apiClient.get<{ url: string }>(
        `/api/v1/github/connect?redirect_uri=${encodeURIComponent(redirectUri)}`
      );
      const { url } = res.data;

      // 2. Open in secure in-app browser, watching for our dynamic redirect URI
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);

      if (result.type === 'success') {
        // Deep link handled by Linking listener above
        handleDeepLink(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setState({ status: 'idle' });
      }
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    }
  }, [handleDeepLink]);

  const disconnect = useCallback(async () => {
    try {
      await apiClient.delete('/api/v1/github/disconnect');
      setState({ status: 'idle' });
      void queryClient.invalidateQueries({ queryKey: ['github-status'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Disconnect failed',
      });
    }
  }, [queryClient]);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, connect, disconnect, reset };
}
