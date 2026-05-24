import {
  View,
  Text,
  StyleSheet,
  TextInput as RNTextInput,
  TextInputProps,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { useRouter, Link } from 'expo-router';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignUp = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      Alert.alert('Sign Up Error', message);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signUp, email, password]);

  const onVerify = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)/dashboard');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      Alert.alert('Verification Error', message);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signUp, code, setActive, router]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Text style={styles.logo}>DevTrack</Text>
          <Text style={styles.tagline}>
            {pendingVerification ? 'Verify your email' : 'Create your account'}
          </Text>
        </View>

        {!pendingVerification ? (
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
              onPress={onSignUp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.verifyHint}>
              We sent a 6-digit code to {email}
            </Text>
            <TextInput
              label="Verification Code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={onVerify}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify & Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in">
            <Text style={styles.footerLink}>Sign In</Text>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TextInput({ label, ...props }: { label: string } & TextInputProps) {
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
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },
  brand: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 36, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1 },
  tagline: { fontSize: 14, color: '#666', marginTop: 6 },
  form: { gap: 16 },
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
  verifyHint: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: '#666', fontSize: 14 },
  footerLink: { color: '#6C63FF', fontSize: 14, fontWeight: '600' },
});
