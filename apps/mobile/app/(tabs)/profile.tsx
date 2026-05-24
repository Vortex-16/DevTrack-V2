import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/src/api/client';
import { useGithubConnect } from '@/src/hooks/useGithubConnect';
import { useRouter } from 'expo-router';
import {
  GithubIcon, SyncIcon, LogOutIcon,
  LinkIcon, AlertTriangleIcon, CheckIcon,
} from '@/src/components/Icons';

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

// ── Name resolution ──────────────────────────────────────────────
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

function SyncIconComp() { return <SyncIcon size={18} color="#FFFFFF" />; }
function SignOutIconComp() { return <LogOutIcon size={18} color="#EF4444" />; }

// ── Main ────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state: githubState, connect, disconnect } = useGithubConnect();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await apiClient.get<UserProfile>('/api/v1/users/me');
      return res.data;
    },
  });

  const { data: githubStatus, isLoading: githubLoading, refetch: refetchGithub } = useQuery({
    queryKey: ['github-status'],
    queryFn: async () => {
      const res = await apiClient.get<GithubStatus>('/api/v1/github/status');
      return res.data;
    },
  });

  // Sync mutation — triggers full GitHub sync then refreshes all dashboard queries
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ message: string; traceId: string }>('/api/v1/github/sync');
      return res.data;
    },
    onSuccess: async () => {
      // Wait 3 s for the sync to process, then invalidate all data
      await new Promise((r) => setTimeout(r, 3000));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['github-status'] }),
      ]);
      Alert.alert('Sync Complete', 'Your GitHub data has been synced. Check the Dashboard!');
    },
    onError: (err) => {
      Alert.alert('Sync Failed', err instanceof Error ? err.message : 'Could not sync GitHub data');
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
        onPress: async () => { await signOut(); router.replace('/(auth)/sign-in'); },
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

        {/* Avatar */}
        <View style={styles.avatarSection}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          )}
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.email}>
            {profile?.email ?? user?.emailAddresses?.[0]?.emailAddress ?? ''}
          </Text>
          <View style={[styles.planBadge, { backgroundColor: planStyle.bg }]}>
            <Text style={[styles.planText, { color: planStyle.text }]}>{profile?.plan ?? 'FREE'} Plan</Text>
          </View>
        </View>

        {/* Account info */}
        <Text style={styles.sectionHeading}>Account</Text>
        <View style={styles.infoCard}>
          <InfoRow label="Username" value={profile?.username ?? user?.username ?? '—'} />
          <InfoRow
            label="Member Since"
            value={profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
              : '—'}
          />
          <InfoRow label="Public Profile" value={profile?.profile?.isPublic ? 'Enabled' : 'Disabled'} last />
        </View>

        {/* GitHub Integration */}
        <Text style={styles.sectionHeading}>GitHub Integration</Text>

        {/* Connect / Disconnect */}
        <TouchableOpacity
          style={[styles.integrationCard, githubStatus?.connected && styles.integrationConnected]}
          onPress={handleGithubAction}
          activeOpacity={0.75}
          disabled={isConnecting || githubLoading}
        >
          <GithubIcon size={28} />
          <View style={styles.integrationInfo}>
            <Text style={styles.integrationName}>GitHub Account</Text>
            {githubLoading ? (
              <Text style={styles.integrationSub}>Checking…</Text>
            ) : githubStatus?.connected ? (
              <Text style={styles.integrationConnectedText}>
                @{githubStatus.login} · Tap to disconnect
              </Text>
            ) : (
              <Text style={styles.integrationSub}>Connect to sync commits & repos</Text>
            )}
          </View>
          {isConnecting ? (
            <ActivityIndicator color="#6C63FF" size="small" />
          ) : githubStatus?.connected ? (
            <View style={styles.connectedBadge}><CheckIcon size={16} color="#059669" /></View>
          ) : (
            <LinkIcon size={18} color="#CBD5E1" />
          )}
        </TouchableOpacity>

        {/* GitHub state banners */}
        {githubState.status === 'error' && (
          <View style={styles.errorBanner}>
            <AlertTriangleIcon size={14} color="#EF4444" />
            <Text style={[styles.bannerText, { marginLeft: 6 }]}>{githubState.message}</Text>
          </View>
        )}
        {githubState.status === 'success' && (
          <View style={styles.successBanner}>
            <CheckIcon size={14} color="#059669" />
            <Text style={[styles.bannerText, { color: '#059669', marginLeft: 6 }]}>
              Connected as @{githubState.login} — now sync below
            </Text>
          </View>
        )}

        {/* ── SYNC NOW button — the KEY feature ── */}
        {githubStatus?.connected && (
          <TouchableOpacity
            style={[styles.syncButton, syncMutation.isPending && styles.syncButtonDisabled]}
            onPress={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            activeOpacity={0.85}
          >
            {syncMutation.isPending ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.syncButtonText}>Syncing your GitHub data…</Text>
              </>
            ) : (
              <>  
                <SyncIconComp />
                <Text style={styles.syncButtonText}>Sync GitHub Data Now</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {syncMutation.isSuccess && (
          <View style={[styles.successBanner, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <CheckIcon size={14} color="#059669" />
            <Text style={[styles.bannerText, { color: '#059669' }]}>
              Sync complete — dashboard is now live!
            </Text>
          </View>
        )}



        {/* Sign out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
          <SignOutIconComp />
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
    marginBottom: 12, marginTop: 28,
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  integrationConnected: { borderColor: '#D2ECE6', backgroundColor: '#FAFFFE' },
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

  // ── Sync button ──────────────────────────────────────────────
  syncButton: {
    marginTop: 14, backgroundColor: '#0F172A', borderRadius: 20,
    paddingVertical: 18, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 6,
  },
  syncButtonDisabled: { opacity: 0.6 },
  syncButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // ── Dev options ──────────────────────────────────────────────
  devSection: {
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  devSectionHeading: {
    fontSize: 16,
    fontFamily: 'TurboDriverItalic',
    color: '#0F172A',
    marginBottom: 12,
  },
  devSyncButton: {
    backgroundColor: '#6366F1',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  devSyncButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

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
    marginTop: 36, backgroundColor: '#FEF2F2', borderRadius: 18,
    paddingVertical: 18, alignItems: 'center',
    borderWidth: 1, borderColor: '#FCA5A5',
    flexDirection: 'row', justifyContent: 'center', gap: 10,
  },
  signOutText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
});
