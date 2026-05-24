import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { apiClient } from '@/src/api/client';

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

export default function DashboardScreen() {
  const { user } = useUser();

  const { data, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardData>('/api/v1/analytics/dashboard');
      return res.data;
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor="#6C63FF"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.name}>{user?.firstName ?? 'Developer'} 👋</Text>
          </View>
          <StreakBadge streak={data?.currentStreak ?? 0} />
        </View>

        {isLoading ? (
          <ActivityIndicator color="#6C63FF" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.error}>Failed to load dashboard</Text>
        ) : (
          <>
            {/* Velocity Cards */}
            <Text style={styles.sectionTitle}>This Week</Text>
            <View style={styles.cardRow}>
              <StatCard
                label="Commits"
                value={String(data?.velocity.commits7d ?? 0)}
                accent="#6C63FF"
              />
              <StatCard
                label="Active Days"
                value={String(data?.velocity.activeDays7d ?? 0)}
                accent="#00D4AA"
              />
            </View>
            <View style={styles.cardRow}>
              <StatCard
                label="30d Commits"
                value={String(data?.velocity.commits30d ?? 0)}
                accent="#FF6B6B"
              />
              <StatCard
                label="Avg/Day"
                value={(data?.velocity.avgCommitsPerDay7d ?? 0).toFixed(1)}
                accent="#FFB347"
              />
            </View>

            {/* Top Languages */}
            {data?.velocity.topLanguages && data.velocity.topLanguages.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Top Languages</Text>
                <View style={styles.card}>
                  {data.velocity.topLanguages.map((lang, i) => (
                    <LanguageBar
                      key={lang.language}
                      language={lang.language}
                      count={lang.count}
                      total={data.velocity.topLanguages[0]?.count ?? 1}
                      index={i}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Streak Grid (last 30 days) */}
            <Text style={styles.sectionTitle}>Streak (30 days)</Text>
            <View style={styles.card}>
              <StreakGrid streaks={data?.recentStreaks.slice(0, 30) ?? []} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function StreakBadge({ streak }: { streak: number }) {
  return (
    <View style={styles.streakBadge}>
      <Text style={styles.streakFire}>🔥</Text>
      <Text style={styles.streakCount}>{streak}</Text>
    </View>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent, borderTopWidth: 2 }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const LANG_COLORS = ['#6C63FF', '#00D4AA', '#FF6B6B', '#FFB347', '#4ECDC4'];

function LanguageBar({
  language,
  count,
  total,
  index,
}: {
  language: string;
  count: number;
  total: number;
  index: number;
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
  const reversed = [...streaks].reverse();
  return (
    <View style={styles.streakGrid}>
      {reversed.map((s, i) => (
        <View
          key={i}
          style={[
            styles.streakDot,
            { backgroundColor: s.committed ? '#6C63FF' : '#1A1A2E' },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
  },
  greeting: { color: '#666', fontSize: 14 },
  name: { color: '#FFF', fontSize: 24, fontWeight: '700', marginTop: 2 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },
  streakFire: { fontSize: 18 },
  streakCount: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 24,
  },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#161622',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E1E2E',
  },
  statValue: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  statLabel: { color: '#666', fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: '#161622',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E1E2E',
  },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  langName: { color: '#CCC', fontSize: 13, width: 70 },
  langBarBg: { flex: 1, height: 6, backgroundColor: '#1A1A2E', borderRadius: 3 },
  langBarFill: { height: 6, borderRadius: 3 },
  langCount: { color: '#666', fontSize: 12, width: 28, textAlign: 'right' },
  streakGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  streakDot: { width: 14, height: 14, borderRadius: 3 },
  error: { color: '#FF6B6B', textAlign: 'center', marginTop: 40 },
});
