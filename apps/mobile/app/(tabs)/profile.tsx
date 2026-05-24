import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/src/api/client';
import { useGithubConnect } from '@/src/hooks/useGithubConnect';
import { useRouter } from 'expo-router';

interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  plan: string;
  profile: { bio: string | null; location: string | null; isPublic: boolean } | null;
  createdAt: string;
}

interface GithubStatus {
  connected: boolean;
  login: string | null;
  connectedAt: string | null;
}

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

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
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

  const planColor =
    profile?.plan === 'PRO' ? '#FFB347' :
    profile?.plan === 'ENTERPRISE' ? '#6C63FF' : '#555';

  const isConnecting = githubState.status === 'connecting';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? 'D').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.displayName}>
            {user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : profile?.username ?? 'Developer'}
          </Text>
          <Text style={styles.email}>{profile?.email}</Text>
          <View style={[styles.planBadge, { borderColor: planColor }]}>
            <Text style={[styles.planText, { color: planColor }]}>{profile?.plan ?? 'FREE'}</Text>
          </View>
        </View>

        {/* Info card */}
        <View style={styles.card}>
          <InfoRow label="Username" value={profile?.username ?? 'Not set'} />
          <InfoRow label="Location" value={profile?.profile?.location ?? 'Not set'} />
          <InfoRow label="Public Profile" value={profile?.profile?.isPublic ? 'Yes' : 'No'} />
          <InfoRow
            label="Member Since"
            value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
          />
        </View>

        {/* GitHub connection */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Integrations</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.integrationCard,
            githubStatus?.connected && styles.integrationCardConnected,
          ]}
          onPress={handleGithubAction}
          activeOpacity={0.7}
          disabled={isConnecting || githubLoading}
        >
          <Text style={styles.integrationIcon}>🐙</Text>
          <View style={styles.integrationInfo}>
            <Text style={styles.integrationName}>GitHub</Text>
            {githubLoading ? (
              <Text style={styles.integrationSub}>Loading...</Text>
            ) : githubStatus?.connected ? (
              <Text style={styles.integrationConnected}>@{githubStatus.login}</Text>
            ) : (
              <Text style={styles.integrationSub}>Connect to sync commits & repos</Text>
            )}
          </View>
          {isConnecting ? (
            <ActivityIndicator color="#6C63FF" size="small" />
          ) : githubStatus?.connected ? (
            <View style={styles.connectedBadge}>
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          ) : (
            <Text style={styles.connectChevron}>›</Text>
          )}
        </TouchableOpacity>

        {/* GitHub connect error */}
        {githubState.status === 'error' && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠ {githubState.message}</Text>
          </View>
        )}

        {/* Success message */}
        {githubState.status === 'success' && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓ Connected as @{githubState.login}</Text>
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  avatarSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#6C63FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { color: '#FFF', fontSize: 32, fontWeight: '700' },
  displayName: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  email: { color: '#666', fontSize: 14, marginTop: 4 },
  planBadge: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 4, marginTop: 10,
  },
  planText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  card: {
    backgroundColor: '#161622', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#1E1E2E', marginBottom: 16, gap: 12,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { color: '#666', fontSize: 14 },
  infoValue: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  sectionHeader: { marginBottom: 10 },
  sectionTitle: {
    color: '#888', fontSize: 12, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  integrationCard: {
    backgroundColor: '#161622', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#1E1E2E',
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
  },
  integrationCardConnected: { borderColor: '#00D4AA40' },
  integrationIcon: { fontSize: 28 },
  integrationInfo: { flex: 1 },
  integrationName: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  integrationSub: { color: '#666', fontSize: 12, marginTop: 2 },
  integrationConnected: { color: '#00D4AA', fontSize: 12, marginTop: 2, fontWeight: '500' },
  connectedBadge: {
    backgroundColor: '#00D4AA20', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  connectedText: { color: '#00D4AA', fontSize: 11, fontWeight: '700' },
  connectChevron: { color: '#444', fontSize: 22 },
  errorBanner: {
    backgroundColor: '#FF6B6B20', borderRadius: 10,
    padding: 12, marginBottom: 8,
  },
  errorText: { color: '#FF6B6B', fontSize: 13 },
  successBanner: {
    backgroundColor: '#00D4AA20', borderRadius: 10,
    padding: 12, marginBottom: 8,
  },
  successText: { color: '#00D4AA', fontSize: 13 },
  signOutButton: {
    backgroundColor: '#1A0A0A', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#FF6B6B40', marginTop: 24,
  },
  signOutText: { color: '#FF6B6B', fontSize: 16, fontWeight: '600' },
});
