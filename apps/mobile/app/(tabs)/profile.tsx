import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/src/api/client';
import { useGithubConnect } from '@/src/hooks/useGithubConnect';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';

interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  plan: string;
  profile: { bio: string | null; isPublic: boolean } | null;
  createdAt: string;
}

interface GithubStatus {
  connected: boolean;
  login: string | null;
  connectedAt: string | null;
}

// ── Helper: resolve the best display name from Clerk ────────────
function resolveDisplayName(user: ReturnType<typeof useUser>['user'], profile?: UserProfile): string {
  if (!user) return 'Developer';
  if (user.firstName && !user.firstName.includes('@')) {
    return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
  }
  if (user.fullName) return user.fullName;
  if (user.username) return user.username;
  const github = user.externalAccounts?.find((a) => String(a.provider) === 'oauth_github');
  if (github?.username) return github.username;
  if (profile?.username) return profile.username;
  const email = user.emailAddresses?.[0]?.emailAddress;
  if (email) return email.split('@')[0] ?? 'Developer';
  return 'Developer';
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return (name[0] ?? 'D').toUpperCase();
}

// ── Icons ───────────────────────────────────────────────────────
function GithubIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.157-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"
        fill="#0F172A"
      />
    </Svg>
  );
}

function SignOutIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Main Screen ──────────────────────────────────────────────────
export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { state: githubState, connect, disconnect } = useGithubConnect();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await apiClient.get<UserProfile>('/api/v1/users/me');
      return res.data;
    },
  });

  const { data: githubStatus, isLoading: githubLoading } = useQuery({
    queryKey: ['github-status'],
    queryFn: async () => {
      const res = await apiClient.get<GithubStatus>('/api/v1/github/status');
      return res.data;
    },
  });

  const displayName = resolveDisplayName(user, profile);
  const initials = getInitials(displayName);
  const avatarUrl = user?.imageUrl;
  const isConnecting = githubState.status === 'connecting';

  const handleSignOut = () => {
    Alert.alert('Sign Out', `Sign out as ${displayName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  const handleGithubAction = () => {
    if (githubStatus?.connected) {
      Alert.alert('Disconnect GitHub', `Remove @${githubStatus.login}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => void disconnect() },
      ]);
    } else {
      void connect();
    }
  };

  const planStyle = {
    FREE: { bg: '#F1F5F9', text: '#64748B' },
    PRO:  { bg: '#FFF3D4', text: '#92400E' },
    TEAM: { bg: '#E6DDF8', text: '#5B4A77' },
  }[profile?.plan ?? 'FREE'] ?? { bg: '#F1F5F9', text: '#64748B' };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar section */}
        <View style={styles.avatarSection}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          )}
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.email}>{profile?.email ?? user?.emailAddresses?.[0]?.emailAddress ?? ''}</Text>
          <View style={[styles.planBadge, { backgroundColor: planStyle.bg }]}>
            <Text style={[styles.planText, { color: planStyle.text }]}>{profile?.plan ?? 'FREE'} Plan</Text>
          </View>
        </View>

        {/* Info */}
        <Text style={styles.sectionHeading}>Account</Text>
        <View style={styles.infoCard}>
          <InfoRow label="Username" value={profile?.username ?? user?.username ?? '—'} />
          <InfoRow label="Member Since" value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' }) : '—'} />
          <InfoRow label="Public Profile" value={profile?.profile?.isPublic ? 'Enabled' : 'Disabled'} last />
        </View>

        {/* Integrations */}
        <Text style={styles.sectionHeading}>Integrations</Text>
        <TouchableOpacity
          style={[styles.integrationCard, githubStatus?.connected && styles.integrationConnected]}
          onPress={handleGithubAction}
          activeOpacity={0.75}
          disabled={isConnecting || githubLoading}
        >
          <GithubIcon size={28} />
          <View style={styles.integrationInfo}>
            <Text style={styles.integrationName}>GitHub</Text>
            {githubLoading ? (
              <Text style={styles.integrationSub}>Checking connection…</Text>
            ) : githubStatus?.connected ? (
              <Text style={styles.integrationConnectedText}>@{githubStatus.login} · Connected</Text>
            ) : (
              <Text style={styles.integrationSub}>Tap to sync commits & repos</Text>
            )}
          </View>
          {isConnecting ? (
            <ActivityIndicator color="#6C63FF" size="small" />
          ) : githubStatus?.connected ? (
            <View style={styles.connectedBadge}><Text style={styles.connectedText}>✓</Text></View>
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </TouchableOpacity>

        {/* GitHub state banners */}
        {githubState.status === 'error' && (
          <View style={styles.errorBanner}>
            <Text style={styles.bannerText}>⚠ {githubState.message}</Text>
          </View>
        )}
        {githubState.status === 'success' && (
          <View style={styles.successBanner}>
            <Text style={[styles.bannerText, { color: '#059669' }]}>✓ Connected as @{githubState.login}</Text>
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
          <SignOutIcon />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  content: { paddingHorizontal: 24, paddingBottom: 48 },

  avatarSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 28, gap: 8 },
  avatarImg: { width: 88, height: 88, borderRadius: 44, marginBottom: 4 },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  avatarInitial: { color: '#FFF', fontSize: 34, fontWeight: '700' },
  displayName: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  email: { color: '#64748B', fontSize: 14 },
  planBadge: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 },
  planText: { fontSize: 13, fontWeight: '700' },

  sectionHeading: {
    fontSize: 18, fontFamily: 'TurboDriverItalic', color: '#0F172A',
    marginBottom: 12, marginTop: 24,
  },

  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  infoRow: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between' },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  infoValue: { color: '#0F172A', fontSize: 14, fontWeight: '600' },

  integrationCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#F1F5F9',
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  integrationConnected: { borderColor: '#D2ECE6' },
  integrationInfo: { flex: 1 },
  integrationName: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  integrationSub: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  integrationConnectedText: { color: '#059669', fontSize: 13, marginTop: 2, fontWeight: '500' },
  connectedBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#D2ECE6', justifyContent: 'center', alignItems: 'center',
  },
  connectedText: { color: '#059669', fontSize: 14, fontWeight: '700' },
  chevron: { color: '#CBD5E1', fontSize: 22 },

  errorBanner: {
    marginTop: 10, backgroundColor: '#FEF2F2', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#FCA5A5',
  },
  successBanner: {
    marginTop: 10, backgroundColor: '#F0FDF4', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#86EFAC',
  },
  bannerText: { color: '#EF4444', fontSize: 13, fontWeight: '500' },

  signOutButton: {
    marginTop: 32, backgroundColor: '#FEF2F2', borderRadius: 18,
    paddingVertical: 18, alignItems: 'center',
    borderWidth: 1, borderColor: '#FCA5A5',
    flexDirection: 'row', justifyContent: 'center', gap: 10,
  },
  signOutText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
});
