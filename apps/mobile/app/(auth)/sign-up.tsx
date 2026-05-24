import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useSignUp, useOAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { GithubIcon } from '../../src/components/Icons';

// Warm up the browser for OAuth
WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

export default function SignUpScreen() {
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_github' });
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onGitHubSignUp = useCallback(async () => {
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
        {/* Brand Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>DevTrack</Text>
          <Text style={styles.tagline}>Developer Workflow Intelligence</Text>
        </View>

        {/* Decorative loving illustrations featuring the DevTrack Mascot */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../../assets/images/DevTrack Mascot.png')}
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        {/* Bottom CTA container */}
        <View style={styles.ctaContainer}>
          <Text style={styles.infoText}>
            Join DevTrack by linking your GitHub. Track your streaks, commits, and project tasks in one place.
          </Text>

          <TouchableOpacity
            style={styles.githubButton}
            onPress={onGitHubSignUp}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <View style={styles.githubContent}>
                <GithubIcon size={20} color="#0F172A" />
                <Text style={styles.githubText}>Sign Up with GitHub</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.termsText}>
            By signing up, you agree to our Terms of Service & Privacy Policy.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  inner: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  logo: {
    fontFamily: 'TurboDriverItalic',
    fontSize: 40,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#71717A',
    marginTop: 4,
    fontWeight: '500',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxHeight: 320,
    marginVertical: 20,
  },
  illustration: {
    width: width - 56,
    height: '100%',
    borderRadius: 24,
  },
  ctaContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 18,
    marginBottom: 10,
  },
  infoText: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  githubButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  githubContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  githubText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  termsText: {
    color: '#52525B',
    fontSize: 11,
    textAlign: 'center',
  },
});
