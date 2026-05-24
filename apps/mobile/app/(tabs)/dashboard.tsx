import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { apiClient } from '@/src/api/client';
import Svg, { Path, Circle } from 'react-native-svg';

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

// ── Icons ───────────────────────────────────────────────────────
function BellIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
        stroke="#1A1A1A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}
function SearchIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="8" stroke="#1A1A1A" strokeWidth={2} />
      <Path d="M21 21l-4.35-4.35" stroke="#1A1A1A" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function ArrowRightIcon({ color = '#1A1A1A' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M12 5l7 7-7 7" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Helper: get best display name from Clerk user object ─────────
function getDisplayName(user: ReturnType<typeof useUser>['user']): string {
  if (!user) return 'Developer';
  // Prefer firstName if it is a real name (not an email fragment)
  if (user.firstName && !user.firstName.includes('@')) return user.firstName;
  // Fall back to full name
  if (user.fullName) return user.fullName.split(' ')[0] ?? user.fullName;
  // Fall back to Clerk username
  if (user.username) return user.username;
  // Fall back to GitHub login from externalAccounts
  const github = user.externalAccounts?.find((a) => String(a.provider) === 'oauth_github');
  if (github?.username) return github.username;
  // Last resort: first part of email
  const email = user.emailAddresses?.[0]?.emailAddress;
  if (email) return email.split('@')[0] ?? 'Developer';
  return 'Developer';
}

// ── Main Screen ──────────────────────────────────────────────────
export default function DashboardScreen() {
  const { user } = useUser();
  const router = useRouter();

  const { data, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardData>('/api/v1/analytics/dashboard');
      return res.data;
    },
  });

  const displayName = getDisplayName(user);
  const avatarUrl = user?.imageUrl;

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
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.profileRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{displayName[0]?.toUpperCase() ?? 'D'}</Text>
              </View>
            )}
            <View style={styles.profileText}>
              <Text style={styles.greetingText}>Hello {displayName}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.learningBadge} />
                <View style={[styles.learningBadge, { opacity: 0.3 }]} />
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
            <BellIcon />
          </TouchableOpacity>
        </View>

        {/* ── Title ── */}
        <View style={styles.mainHeadingContainer}>
          <Text style={styles.mainHeading}>Your Progress</Text>
          <View style={styles.headingRow}>
            <Text style={styles.mainHeading}>Today</Text>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
              <SearchIcon />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Body ── */}
        {isLoading ? (
          <ActivityIndicator color="#6C63FF" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>📡 Couldn't load data</Text>
            <Text style={styles.errorSub}>Pull down to retry</Text>
          </View>
        ) : (
          <>
            {/* Teal card — Commit Velocity */}
            <View style={styles.tealCard}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}><Text style={{ fontSize: 18 }}>💻</Text></View>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>🔥 {data?.currentStreak ?? 0} day streak</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>Git Commit Velocity</Text>
              <Text style={styles.cardTitle}>
                {data?.velocity.commits7d ?? 0} commits this week across all repos
              </Text>
              <View style={styles.cardFooter}>
                <View style={styles.statPill}>
                  <Text style={styles.statPillValue}>{data?.velocity.activeDays7d ?? 0}</Text>
                  <Text style={styles.statPillLabel}> active days</Text>
                </View>
                <TouchableOpacity
                  style={styles.arrowButton}
                  activeOpacity={0.8}
                  onPress={() => router.push('/(tabs)/analytics')}
                >
                  <ArrowRightIcon />
                </TouchableOpacity>
              </View>
            </View>

            {/* Lavender card — Activity Index */}
            <View style={styles.lavenderCard}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}><Text style={{ fontSize: 18 }}>📊</Text></View>
                <View style={[styles.pill, { backgroundColor: '#EDE8F8' }]}>
                  <Text style={[styles.pillText, { color: '#5B4A77' }]}>
                    {(data?.velocity.avgCommitsPerDay7d ?? 0).toFixed(1)} avg/day
                  </Text>
                </View>
              </View>
              <Text style={[styles.cardSubtitle, { color: '#6B5A8E' }]}>Activity Index</Text>
              <Text style={[styles.cardTitle, { color: '#2E1E50' }]}>
                {data?.velocity.commits30d ?? 0} commits in the last 30 days
              </Text>
              <View style={styles.cardFooter}>
                <View style={[styles.statPill, { backgroundColor: '#EDE8F8' }]}>
                  <Text style={[styles.statPillValue, { color: '#5B4A77' }]}>{data?.velocity.commits30d ?? 0}</Text>
                  <Text style={[styles.statPillLabel, { color: '#7C6A9E' }]}> 30-day commits</Text>
                </View>
                <TouchableOpacity
                  style={styles.arrowButton}
                  activeOpacity={0.8}
                  onPress={() => router.push('/(tabs)/analytics')}
                >
                  <ArrowRightIcon />
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
                <Text style={styles.emptyHint}>No activity yet — start committing! 🚀</Text>
              ) : (
                <StreakGrid streaks={data!.recentStreaks.slice(0, 30)} />
              )}
            </View>

            {/* Quick nav to Insights */}
            <TouchableOpacity
              style={styles.insightsBanner}
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/insights')}
            >
              <Text style={styles.insightsBannerIcon}>✦</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightsBannerTitle}>AI Growth Insights</Text>
                <Text style={styles.insightsBannerSub}>Generate your weekly developer report →</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────
const LANG_COLORS = ['#6C63FF', '#4ECDC4', '#FF6B6B', '#FFB347', '#00D4AA'];

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
  return (
    <View style={styles.streakGrid}>
      {[...streaks].reverse().map((s, i) => (
        <View
          key={i}
          style={[styles.streakDot, { backgroundColor: s.committed ? '#6C63FF' : '#E2E8F0' }]}
        />
      ))}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, paddingBottom: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  profileText: { gap: 4 },
  greetingText: { fontSize: 15, color: '#0F172A', fontWeight: '600' },
  badgeRow: { flexDirection: 'row', gap: 4 },
  learningBadge: { width: 32, height: 5, borderRadius: 3, backgroundColor: '#A78BFA' },

  iconButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },

  mainHeadingContainer: { marginBottom: 28 },
  mainHeading: { fontSize: 34, fontFamily: 'TurboDriverItalic', color: '#0F172A', lineHeight: 40 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  tealCard: { backgroundColor: '#D2ECE6', borderRadius: 28, padding: 24, marginBottom: 16 },
  lavenderCard: { backgroundColor: '#E6DDF8', borderRadius: 28, padding: 24, marginBottom: 16 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  pill: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  pillText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },

  cardSubtitle: { fontSize: 13, fontWeight: '600', color: '#3A6F62', marginBottom: 6 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1E3E37', lineHeight: 25, marginBottom: 20 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statPill: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  statPillValue: { fontSize: 20, fontWeight: '800', color: '#1E3E37' },
  statPillLabel: { fontSize: 13, color: '#3A6F62', fontWeight: '500' },
  arrowButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },

  sectionHeading: { fontSize: 22, fontFamily: 'TurboDriverItalic', color: '#0F172A', marginTop: 32, marginBottom: 16 },
  whiteCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#F1F5F9', gap: 14 },
  emptyHint: { color: '#94A3B8', fontSize: 14, textAlign: 'center', paddingVertical: 8 },

  langRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  langName: { color: '#475569', fontSize: 14, fontWeight: '600', width: 80 },
  langBarBg: { flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4 },
  langBarFill: { height: 8, borderRadius: 4 },
  langCount: { color: '#64748B', fontSize: 13, fontWeight: '500', width: 28, textAlign: 'right' },

  streakGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  streakDot: { width: 14, height: 14, borderRadius: 4 },

  insightsBanner: {
    marginTop: 32, backgroundColor: '#0F172A', borderRadius: 24, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  insightsBannerIcon: { fontSize: 28, color: '#A78BFA' },
  insightsBannerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  insightsBannerSub: { color: '#94A3B8', fontSize: 13, marginTop: 2 },

  errorBox: { alignItems: 'center', paddingTop: 60, gap: 8 },
  errorTitle: { color: '#EF4444', fontSize: 18, fontWeight: '700' },
  errorSub: { color: '#94A3B8', fontSize: 14 },
});
