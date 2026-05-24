import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Image,
} from 'react-native';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { apiClient } from '@/src/api/client';
import {
  BellIcon, SearchIcon, ArrowRightIcon,
  CodeIcon, BarChartIcon, FlameIcon, TrendingUpIcon, SparklesIcon,
  GitCommitIcon, ActivityIcon,
} from '@/src/components/Icons';

interface DashboardData {
  velocity: {
    commits7d: number;
    commits30d: number;
    avgCommitsPerDay7d: number;
    activeDays7d: number;
    topLanguages: { language: string; count: number }[];
  };
  currentStreak: number;
  recentStreaks: { date: string; committed: boolean }[];
}

function getDisplayName(user: ReturnType<typeof useUser>['user']): string {
  if (!user) return 'Developer';
  if (user.firstName && !user.firstName.includes('@')) return user.firstName;
  if (user.fullName) return user.fullName.split(' ')[0] ?? user.fullName;
  if (user.username) return user.username;
  const github = user.externalAccounts?.find((a) => String(a.provider) === 'oauth_github');
  if (github?.username) return github.username;
  const email = user.emailAddresses?.[0]?.emailAddress;
  if (email) return email.split('@')[0] ?? 'Developer';
  return 'Developer';
}

const LANG_COLORS = ['#6C63FF', '#4ECDC4', '#EF4444', '#F59E0B', '#10B981'];

export default function DashboardScreen() {
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Automatic background synchronization on dashboard load
  useEffect(() => {
    const triggerAutoSync = async () => {
      try {
        const statusRes = await apiClient.get<{ connected: boolean }>('/api/v1/github/status');
        if (statusRes.data.connected) {
          console.log('[DevTrack AutoSync] Starting automatic background GitHub synchronization...');
          await apiClient.post('/api/v1/github/sync');
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
            queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] }),
            queryClient.invalidateQueries({ queryKey: ['github-status'] }),
            queryClient.invalidateQueries({ queryKey: ['profile'] }),
          ]);
          console.log('[DevTrack AutoSync] Background synchronization complete and queries invalidated.');
        }
      } catch (err) {
        console.warn('[DevTrack AutoSync] Automatic synchronization check failed:', err);
      }
    };
    triggerAutoSync();
  }, [queryClient]);

  const { data, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardData>('/api/v1/analytics/dashboard');
      return res.data;
    },
  });

  const displayName = getDisplayName(user);
  const avatarUrl = user?.imageUrl;

  const githubAccount = user?.externalAccounts?.find(
    (a) => (a.provider as string) === 'github' || (a.provider as string) === 'oauth_github'
  );
  const githubUsername = githubAccount?.username ?? 'vortex-16';
  const firstName = user?.firstName ?? 'Vikash';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor="#6C63FF" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{firstName[0]?.toUpperCase() ?? 'V'}</Text>
              </View>
            )}
            <View>
              <Text style={styles.greetingSmall}>Hello, {firstName}</Text>
              <Text style={styles.greetingName}>@{githubUsername}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <BellIcon size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={styles.mainHeading}>Your Progress{'\n'}Today</Text>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <SearchIcon size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Body */}
        {isLoading ? (
          <ActivityIndicator color="#6C63FF" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <ActivityIcon size={32} color="#EF4444" />
            <Text style={styles.errorTitle}>Couldn't load data</Text>
            <Text style={styles.errorSub}>Pull down to retry</Text>
          </View>
        ) : (
          <>
            {/* Teal card — Commit Velocity */}
            <View style={styles.tealCard}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <CodeIcon size={20} color="#3A6F62" />
                </View>
                <View style={styles.pill}>
                  <FlameIcon size={14} color="#EA580C" />
                  <Text style={styles.pillText}> {data?.currentStreak ?? 0} day streak</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>Git Commit Velocity</Text>
              <Text style={styles.cardTitle}>
                {data?.velocity.commits7d ?? 0} commits this week across all repos
              </Text>
              <View style={styles.cardFooter}>
                <View style={styles.statPill}>
                  <GitCommitIcon size={14} color="#3A6F62" />
                  <Text style={styles.statPillText}> {data?.velocity.activeDays7d ?? 0} active days</Text>
                </View>
                <TouchableOpacity
                  style={styles.arrowBtn}
                  activeOpacity={0.8}
                  onPress={() => router.push('/(tabs)/analytics')}
                >
                  <ArrowRightIcon size={18} color="#1E3E37" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Lavender card — Activity Index */}
            <View style={styles.lavenderCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle]}>
                  <BarChartIcon size={20} color="#5B4A77" />
                </View>
                <View style={[styles.pill, { backgroundColor: '#EDE8F8' }]}>
                  <TrendingUpIcon size={14} color="#5B4A77" />
                  <Text style={[styles.pillText, { color: '#5B4A77' }]}>
                    {' '}{(data?.velocity.avgCommitsPerDay7d ?? 0).toFixed(1)} avg/day
                  </Text>
                </View>
              </View>
              <Text style={[styles.cardSubtitle, { color: '#6B5A8E' }]}>Activity Index</Text>
              <Text style={[styles.cardTitle, { color: '#2E1E50' }]}>
                {data?.velocity.commits30d ?? 0} commits in the last 30 days
              </Text>
              <View style={styles.cardFooter}>
                <View style={[styles.statPill, { backgroundColor: '#EDE8F8' }]}>
                  <ActivityIcon size={14} color="#5B4A77" />
                  <Text style={[styles.statPillText, { color: '#5B4A77' }]}>
                    {' '}{data?.velocity.commits30d ?? 0} total commits
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.arrowBtn}
                  activeOpacity={0.8}
                  onPress={() => router.push('/(tabs)/analytics')}
                >
                  <ArrowRightIcon size={18} color="#2E1E50" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Top Languages */}
            {(data?.velocity.topLanguages?.length ?? 0) > 0 && (
              <>
                <Text style={styles.sectionHeading}>Top Languages</Text>
                <View style={styles.whiteCard}>
                  {data!.velocity.topLanguages.map((lang, i) => (
                    <LanguageBar
                      key={lang.language}
                      language={lang.language}
                      count={lang.count}
                      total={data!.velocity.topLanguages[0]?.count ?? 1}
                      index={i}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Activity Grid */}
            <Text style={styles.sectionHeading}>Activity Grid</Text>
            <View style={styles.whiteCard}>
              {(data?.recentStreaks?.length ?? 0) === 0 ? (
                <View style={styles.emptyHint}>
                  <GitCommitIcon size={24} color="#CBD5E1" />
                  <Text style={styles.emptyHintText}>No commits yet — start coding!</Text>
                </View>
              ) : (
                <StreakGrid streaks={data!.recentStreaks} />
              )}
            </View>

            {/* AI Insights banner */}
            <TouchableOpacity
              style={styles.insightsBanner}
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/insights')}
            >
              <SparklesIcon size={26} color="#A78BFA" />
              <View style={{ flex: 1 }}>
                <Text style={styles.insightsBannerTitle}>AI Growth Insights</Text>
                <Text style={styles.insightsBannerSub}>Generate your weekly developer report</Text>
              </View>
              <ArrowRightIcon size={18} color="#64748B" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LanguageBar({ language, count, total, index }: {
  language: string; count: number; total: number; index: number;
}) {
  const pct = Math.round((count / total) * 100);
  const color = LANG_COLORS[index % LANG_COLORS.length] ?? '#6C63FF';
  return (
    <View style={styles.langRow}>
      <Text style={styles.langName}>{language}</Text>
      <View style={styles.langBarBg}>
        <View style={[styles.langBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.langCount}>{count}</Text>
    </View>
  );
}

function StreakGrid({ streaks }: { streaks: { date: string; committed: boolean }[] }) {
  const sorted = [...streaks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const columns: { date: string; committed: boolean }[][] = [];
  let currentColumn: { date: string; committed: boolean }[] = [];

  for (const day of sorted) {
    currentColumn.push(day);
    if (currentColumn.length === 7) {
      columns.push(currentColumn);
      currentColumn = [];
    }
  }
  if (currentColumn.length > 0) {
    columns.push(currentColumn);
  }

  const displayColumns = columns.slice(-13);

  return (
    <View style={styles.gridContainer}>
      <View style={styles.daysLabels}>
        <Text style={styles.dayLabel}>M</Text>
        <Text style={styles.dayLabel}>W</Text>
        <Text style={styles.dayLabel}>F</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarScroll}>
        {displayColumns.map((col, colIndex) => (
          <View key={colIndex} style={styles.gridColumn}>
            {col.map((day, dayIndex) => (
              <View
                key={dayIndex}
                style={[
                  styles.streakDot2D,
                  { backgroundColor: day.committed ? '#10B981' : '#E2E8F0' }
                ]}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 16, paddingBottom: 8,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  greetingSmall: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  greetingName: { fontSize: 16, color: '#0F172A', fontWeight: '700' },

  iconBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },

  titleRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', paddingTop: 20, paddingBottom: 28,
  },
  mainHeading: { fontSize: 34, fontFamily: 'TurboDriverItalic', color: '#0F172A', lineHeight: 42, flex: 1 },

  tealCard: { backgroundColor: '#D2ECE6', borderRadius: 28, padding: 24, marginBottom: 16 },
  lavenderCard: { backgroundColor: '#E6DDF8', borderRadius: 28, padding: 24, marginBottom: 16 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  pillText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  cardSubtitle: { fontSize: 13, fontWeight: '700', color: '#3A6F62', marginBottom: 6 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1E3E37', lineHeight: 26, marginBottom: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9,
  },
  statPillText: { fontSize: 14, fontWeight: '600', color: '#3A6F62' },
  arrowBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },

  sectionHeading: {
    fontSize: 22, fontFamily: 'TurboDriverItalic', color: '#0F172A',
    marginTop: 32, marginBottom: 16,
  },
  whiteCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22,
    borderWidth: 1, borderColor: '#F1F5F9', gap: 14,
  },
  emptyHint: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  emptyHintText: { color: '#94A3B8', fontSize: 14 },

  langRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  langName: { color: '#475569', fontSize: 14, fontWeight: '600', width: 80 },
  langBarBg: { flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4 },
  langBarFill: { height: 8, borderRadius: 4 },
  langCount: { color: '#64748B', fontSize: 13, fontWeight: '500', width: 28, textAlign: 'right' },

  gridContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  daysLabels: { gap: 10, justifyContent: 'space-between', height: 110, paddingVertical: 2 },
  dayLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  calendarScroll: { gap: 6 },
  gridColumn: { flexDirection: 'column', gap: 6, justifyContent: 'space-between', height: 110 },
  streakDot2D: { width: 10, height: 10, borderRadius: 2.5 },

  insightsBanner: {
    marginTop: 32, backgroundColor: '#0F172A', borderRadius: 24, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  insightsBannerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  insightsBannerSub: { color: '#94A3B8', fontSize: 13, marginTop: 2 },

  errorBox: { alignItems: 'center', paddingTop: 60, gap: 10 },
  errorTitle: { color: '#EF4444', fontSize: 18, fontWeight: '700' },
  errorSub: { color: '#94A3B8', fontSize: 14 },
});
