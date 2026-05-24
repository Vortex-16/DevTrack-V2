import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

/** Index route — immediately redirects based on auth state */
export default function Index() {
  const { isSignedIn } = useAuth();
  return isSignedIn
    ? <Redirect href="/(tabs)/dashboard" />
    : <Redirect href="/(auth)/sign-in" />;
}
