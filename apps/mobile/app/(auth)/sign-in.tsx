import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import { useRouter, Link } from 'expo-router';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Warm up the browser for OAuth
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_github' });
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignIn = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)/dashboard');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      Alert.alert('Sign In Error', message);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signIn, email, password, setActive, router]);

  const onGitHubSignIn = useCallback(async () => {
    setLoading(true);
    try {
      const { createdSessionId, setActive: setSessionActive } = await startOAuthFlow({
        redirectUrl: Linking.createURL('/dashboard', { scheme: 'devtrack' }),
      });

      if (createdSessionId && setSessionActive) {
        await setSessionActive({ session: createdSessionId });
        router.replace('/(tabs)/dashboard');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'GitHub OAuth failed';
      Alert.alert('OAuth Error', message);
    } finally {
      setLoading(false);
    }
  }, [startOAuthFlow, router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* Logo / Brand */}
        <View style={styles.brand}>
          <Text style={styles.logo}>DevTrack</Text>
          <Text style={styles.tagline}>Developer Intelligence Platform</Text>
        </View>

        {/* OAuth Buttons */}
        <View style={styles.oauthContainer}>
          <TouchableOpacity
            style={styles.githubButton}
            onPress={onGitHubSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <View style={styles.githubContent}>
                {/* Simple premium custom SVG/Icon placeholder representation */}
                <Text style={styles.githubText}>Continue with GitHub</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don&apos;t have an account? </Text>
          <Link href="/(auth)/sign-up">
            <Text style={styles.footerLink}>Sign Up</Text>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Inline text input component to keep this file self-contained */
import { TextInput as RNTextInput, TextInputProps } from 'react-native';

function TextInput({
  label,
  ...props
}: { label: string } & TextInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <RNTextInput
        style={styles.input}
        placeholderTextColor="#555"
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  brand: { alignItems: 'center', marginBottom: 48 },
  logo: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  tagline: { fontSize: 14, color: '#666', marginTop: 6 },
  form: { gap: 16 },
  oauthContainer: { marginVertical: 8 },
  githubButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  githubContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  githubText: { color: '#0F172A', fontSize: 16, fontWeight: '600' },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2A2A3A' },
  dividerText: { color: '#666', fontSize: 13, fontWeight: '500' },
  inputGroup: { gap: 6 },
  label: { color: '#888', fontSize: 13, fontWeight: '500' },
  input: {
    backgroundColor: '#161622',
    borderWidth: 1,
    borderColor: '#2A2A3A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: { color: '#666', fontSize: 14 },
  footerLink: { color: '#6C63FF', fontSize: 14, fontWeight: '600' },
});
