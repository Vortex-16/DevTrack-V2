import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/src/api/client';
import { useState } from 'react';
import {
  TargetIcon, AwardIcon, GitCommitIcon, BarChartIcon, TrendingUpIcon, ActivityIcon, CalendarIcon,
} from '@/src/components/Icons';

export default function AnalyticsScreen() {
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'alltime'>('weekly');

  const { data, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/analytics/dashboard');
      return res.data as {
        velocity: {
          commits7d: number;
          commits30d: number;
          allTimeCommits: number;
          avgCommitsPerDay7d: number;
          activeDays7d: number;
          activeDays30d: number;
          topLanguages: { language: string; count: number }[];
        };
        currentStreak: number;
        recentStreaks: { date: string; committed: boolean }[];
      };
    },
  });

  // Calculate metrics based on chosen timeframe
  const displayCommits = timeframe === 'weekly'
    ? (data?.velocity.commits7d ?? 0)
    : timeframe === 'monthly'
    ? (data?.velocity.commits30d ?? 0)
    : (data?.velocity.allTimeCommits ?? 0);

  const displayLabel = timeframe === 'weekly'
    ? 'Commits (7d)'
    : timeframe === 'monthly'
    ? 'Commits (30d)'
    : 'Commits (All Time)';

  const gaugeGoal = timeframe === 'weekly' ? 20 : timeframe === 'monthly' ? 80 : 500;
  const gaugePercent = Math.min(100, (displayCommits / gaugeGoal) * 100);
  const gaugeLabel = timeframe === 'weekly'
    ? `commits / 7 days (Goal: ${gaugeGoal})`
    : timeframe === 'monthly'
    ? `commits / 30 days (Goal: ${gaugeGoal})`
    : `commits total (Goal: ${gaugeGoal})`;

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
        <Text style={styles.pageTitle}>Learning Pathway{'\n'}Status</Text>

        {isLoading ? (
          <ActivityIndicator color="#6C63FF" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <ActivityIcon size={32} color="#EF4444" />
            <Text style={styles.errorTitle}>Couldn't load analytics</Text>
            <Text style={styles.errorSub}>Pull down to retry</Text>
          </View>
        ) : (
          <>
            {/* Stat grid */}
            <View style={styles.statsGrid}>
              <View style={styles.tealStatCard}>
                <View style={styles.cardIconRow}>
                  <TargetIcon size={22} color="#3A6F62" />
                  <Text style={styles.statLabel}>{displayLabel}</Text>
                </View>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{displayCommits}</Text>
                  <View style={styles.arrowCircle}>
                    <TrendingUpIcon size={14} color="#3A6F62" />
                  </View>
                </View>
              </View>
              <View style={styles.yellowStatCard}>
                <View style={styles.cardIconRow}>
                  <AwardIcon size={22} color="#92400E" />
                  <Text style={[styles.statLabel, { color: '#7C5D23' }]}>Streak</Text>
                </View>
                <View style={styles.statValueRow}>
                  <Text style={[styles.statValue, { color: '#4E3A11' }]}>{data?.currentStreak ?? 0}</Text>
                  <View style={styles.arrowCircle}>
                    <TrendingUpIcon size={14} color="#7C5D23" />
                  </View>
                </View>
              </View>
            </View>

            {/* Toggle pills */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, timeframe === 'weekly' && styles.activeTogglePill]}
                onPress={() => setTimeframe('weekly')}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, timeframe === 'weekly' && styles.activeToggleText]}>Weekly</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, timeframe === 'monthly' && styles.activeTogglePill]}
                onPress={() => setTimeframe('monthly')}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, timeframe === 'monthly' && styles.activeToggleText]}>Monthly</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, timeframe === 'alltime' && styles.activeTogglePill]}
                onPress={() => setTimeframe('alltime')}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, timeframe === 'alltime' && styles.activeToggleText]}>All Time</Text>
              </TouchableOpacity>
            </View>

            {/* Progress card */}
            <View style={styles.gaugeCard}>
              <View style={styles.gaugeHeaderRow}>
                <BarChartIcon size={18} color="#5B4A77" />
                <Text style={styles.gaugeTitle}>Commit Progress</Text>
              </View>
              <View style={styles.gaugeBody}>
                <View style={styles.gaugeArcBg}>
                  <View style={[styles.gaugeArcFill, { width: `${gaugePercent}%` }]} />
                </View>
                <Text style={styles.gaugeValue}>{displayCommits}</Text>
                <Text style={styles.gaugeLabel}>{gaugeLabel}</Text>
              </View>
            </View>

            {/* Metrics list */}
            <Text style={styles.sectionHeading}>Velocity Index</Text>
            <View style={styles.whiteCard}>
              {[
                { icon: <GitCommitIcon size={16} color="#6C63FF" />, label: 'Avg commits / active day', value: (data?.velocity.avgCommitsPerDay7d ?? 0).toFixed(1) },
                { icon: <CalendarIcon size={16} color="#6C63FF" />, label: 'Active days this week', value: `${data?.velocity.activeDays7d ?? 0} / 7` },
                { icon: <CalendarIcon size={16} color="#6C63FF" />, label: 'Active days this month', value: `${data?.velocity.activeDays30d ?? 0} / 30` },
                { icon: <BarChartIcon size={16} color="#6C63FF" />, label: 'All-time commit total', value: String(data?.velocity.allTimeCommits ?? 0) },
              ].map(({ icon, label, value }, i) => (
                <View key={label} style={[styles.metricRow, i > 0 && styles.metricBorder]}>
                  <View style={styles.metricLabelRow}>
                    {icon}
                    <Text style={styles.metricLabel}>{label}</Text>
                  </View>
                  <Text style={styles.metricValue}>{value}</Text>
                </View>
              ))}
            </View>

            {/* Activity heatmap */}
            <Text style={styles.sectionHeading}>Activity Grid</Text>
            <View style={styles.whiteCard}>
              {(data?.recentStreaks?.length ?? 0) === 0 ? (
                <View style={styles.emptyHint}>
                  <ActivityIcon size={24} color="#CBD5E1" />
                  <Text style={styles.emptyHintText}>No activity yet — sync GitHub to load data</Text>
                </View>
              ) : (
                <StreakGrid streaks={data!.recentStreaks} />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  pageTitle: {
    fontSize: 34, fontFamily: 'TurboDriverItalic', color: '#0F172A',
    lineHeight: 42, paddingTop: 20, marginBottom: 28,
  },

  statsGrid: { flexDirection: 'row', gap: 14, marginBottom: 24 },
  tealStatCard: { flex: 1, backgroundColor: '#D2ECE6', borderRadius: 24, padding: 20, gap: 10 },
  yellowStatCard: { flex: 1, backgroundColor: '#FFF3D4', borderRadius: 24, padding: 20, gap: 10 },
  cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { fontSize: 13, fontWeight: '600', color: '#3A6F62' },
  statValueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statValue: { fontSize: 30, fontWeight: '800', color: '#1E3E37' },
  arrowCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },

  toggleRow: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 22,
    padding: 4, marginBottom: 24, borderWidth: 1, borderColor: '#F1F5F9',
  },
  activeTogglePill: { flex: 1, backgroundColor: '#0F172A', borderRadius: 20, paddingVertical: 12, alignItems: 'center' },
  activeToggleText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  inactiveTogglePill: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  inactiveToggleText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },

  gaugeCard: { backgroundColor: '#E6DDF8', borderRadius: 28, padding: 24, marginBottom: 32, gap: 16 },
  gaugeHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gaugeTitle: { fontSize: 15, fontWeight: '700', color: '#5B4A77' },
  gaugeBody: { alignItems: 'center', gap: 10 },
  gaugeArcBg: { width: '100%', height: 16, backgroundColor: '#F1F5F9', borderRadius: 8, overflow: 'hidden' },
  gaugeArcFill: { height: 16, backgroundColor: '#A78BFA', borderRadius: 8 },
  gaugeValue: { fontSize: 40, fontWeight: '800', color: '#2E1E50' },
  gaugeLabel: { fontSize: 13, color: '#7B6A9B', fontWeight: '500' },

  sectionHeading: { fontSize: 22, fontFamily: 'TurboDriverItalic', color: '#0F172A', marginBottom: 16 },
  whiteCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  metricBorder: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  metricLabel: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  metricValue: { color: '#0F172A', fontSize: 15, fontWeight: '700' },

  gridContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  daysLabels: { gap: 10, justifyContent: 'space-between', height: 110, paddingVertical: 2 },
  dayLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  calendarScroll: { gap: 6 },
  gridColumn: { flexDirection: 'column', gap: 6, justifyContent: 'space-between', height: 110 },
  streakDot2D: { width: 10, height: 10, borderRadius: 2.5 },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 20 },
  toggleText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  emptyHint: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  emptyHintText: { color: '#94A3B8', fontSize: 14, textAlign: 'center' },

  errorBox: { alignItems: 'center', paddingTop: 60, gap: 10 },
  errorTitle: { color: '#EF4444', fontSize: 18, fontWeight: '700' },
  errorSub: { color: '#94A3B8', fontSize: 14 },
});
