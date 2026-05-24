import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/src/api/client';
import Svg, { Path, Rect } from 'react-native-svg';

function ArrowUpRightIcon({ color = '#1A1A1A' }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M7 17L17 7M17 7H7M17 7V17" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function AnalyticsScreen() {
  const { data, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/analytics/dashboard');
      return res.data as {
        velocity: {
          commits7d: number;
          commits30d: number;
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
        {/* Title */}
        <Text style={styles.pageTitle}>Learning Pathway{'\n'}Status</Text>

        {isLoading ? (
          <ActivityIndicator color="#6C63FF" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>📡 Couldn't load analytics</Text>
            <Text style={styles.errorSub}>Pull down to retry</Text>
          </View>
        ) : (
          <>
            {/* Stat grid */}
            <View style={styles.statsGrid}>
              <View style={styles.tealStatCard}>
                <Text style={styles.statIcon}>🎯</Text>
                <Text style={styles.statLabel}>Commits (7d)</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{data?.velocity.commits7d ?? 0}</Text>
                  <View style={styles.arrowCircle}>
                    <ArrowUpRightIcon color="#3A6F62" />
                  </View>
                </View>
              </View>
              <View style={styles.yellowStatCard}>
                <Text style={styles.statIcon}>🏆</Text>
                <Text style={[styles.statLabel, { color: '#7C5D23' }]}>Current Streak</Text>
                <View style={styles.statValueRow}>
                  <Text style={[styles.statValue, { color: '#4E3A11' }]}>{data?.currentStreak ?? 0}</Text>
                  <View style={styles.arrowCircle}>
                    <ArrowUpRightIcon color="#7C5D23" />
                  </View>
                </View>
              </View>
            </View>

            {/* Toggle pills (decorative — shows "Weekly" selected) */}
            <View style={styles.toggleRow}>
              <View style={styles.activeTogglePill}><Text style={styles.activeToggleText}>Weekly</Text></View>
              <View style={styles.inactiveTogglePill}><Text style={styles.inactiveToggleText}>Monthly</Text></View>
              <View style={styles.inactiveTogglePill}><Text style={styles.inactiveToggleText}>All Time</Text></View>
            </View>

            {/* Progress gauge card */}
            <View style={styles.gaugeCard}>
              <View style={styles.gaugeHeader}>
                <Text style={styles.gaugeTitle}>📊 Commit Progress</Text>
              </View>
              {/* Simple visual arc via styled views */}
              <View style={styles.gaugeBody}>
                <View style={styles.gaugeArcBg}>
                  <View style={[styles.gaugeArcFill, {
                    width: `${Math.min(100, ((data?.velocity.commits30d ?? 0) / 200) * 100)}%`,
                  }]} />
                </View>
                <Text style={styles.gaugeValue}>{data?.velocity.commits30d ?? 0}</Text>
                <Text style={styles.gaugeLabel}>commits / 30 days</Text>
              </View>
            </View>

            {/* Detailed metrics */}
            <Text style={styles.sectionHeading}>Velocity Index</Text>
            <View style={styles.whiteCard}>
              {[
                { label: 'Avg commits / active day', value: (data?.velocity.avgCommitsPerDay7d ?? 0).toFixed(1) },
                { label: 'Active days this week', value: `${data?.velocity.activeDays7d ?? 0} / 7` },
                { label: 'Active days this month', value: `${data?.velocity.activeDays30d ?? 0} / 30` },
                { label: '30-day commit total', value: String(data?.velocity.commits30d ?? 0) },
              ].map(({ label, value }, i) => (
                <View key={label} style={[styles.metricRow, i > 0 && styles.metricBorder]}>
                  <Text style={styles.metricLabel}>{label}</Text>
                  <Text style={styles.metricValue}>{value}</Text>
                </View>
              ))}
            </View>

            {/* Activity heatmap */}
            <Text style={styles.sectionHeading}>Activity Grid</Text>
            <View style={styles.whiteCard}>
              <View style={styles.heatmap}>
                {[...(data?.recentStreaks ?? [])].reverse().map((day, i) => (
                  <View
                    key={i}
                    style={[styles.heatmapCell, { backgroundColor: day.committed ? '#6C63FF' : '#E2E8F0' }]}
                  />
                ))}
              </View>
              {(data?.recentStreaks?.length ?? 0) === 0 && (
                <Text style={styles.emptyHint}>No activity data yet</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  statIcon: { fontSize: 22 },
  statLabel: { fontSize: 13, fontWeight: '600', color: '#3A6F62' },
  statValueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statValue: { fontSize: 30, fontWeight: '800', color: '#1E3E37' },
  arrowCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },

  toggleRow: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 22,
    padding: 4, marginBottom: 24, borderWidth: 1, borderColor: '#F1F5F9',
  },
  activeTogglePill: {
    flex: 1, backgroundColor: '#0F172A', borderRadius: 20,
    paddingVertical: 12, alignItems: 'center',
  },
  activeToggleText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  inactiveTogglePill: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  inactiveToggleText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },

  gaugeCard: { backgroundColor: '#E6DDF8', borderRadius: 28, padding: 24, marginBottom: 32, gap: 16 },
  gaugeHeader: {},
  gaugeTitle: { fontSize: 15, fontWeight: '700', color: '#5B4A77' },
  gaugeBody: { alignItems: 'center', gap: 10 },
  gaugeArcBg: {
    width: '100%', height: 16, backgroundColor: '#F1F5F9', borderRadius: 8, overflow: 'hidden',
  },
  gaugeArcFill: { height: 16, backgroundColor: '#A78BFA', borderRadius: 8 },
  gaugeValue: { fontSize: 40, fontWeight: '800', color: '#2E1E50' },
  gaugeLabel: { fontSize: 13, color: '#7B6A9B', fontWeight: '500' },

  sectionHeading: {
    fontSize: 22, fontFamily: 'TurboDriverItalic', color: '#0F172A', marginBottom: 16,
  },
  whiteCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  metricBorder: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  metricLabel: { color: '#64748B', fontSize: 14, fontWeight: '500', flex: 1 },
  metricValue: { color: '#0F172A', fontSize: 15, fontWeight: '700' },

  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  heatmapCell: { width: 14, height: 14, borderRadius: 4 },
  emptyHint: { color: '#94A3B8', fontSize: 14, textAlign: 'center', paddingVertical: 8 },

  errorBox: { alignItems: 'center', paddingTop: 60, gap: 8 },
  errorTitle: { color: '#EF4444', fontSize: 18, fontWeight: '700' },
  errorSub: { color: '#94A3B8', fontSize: 14 },
});
