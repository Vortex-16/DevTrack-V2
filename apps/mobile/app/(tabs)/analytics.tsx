import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/src/api/client';

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
        <Text style={styles.pageTitle}>Analytics</Text>

        {isLoading ? (
          <ActivityIndicator color="#6C63FF" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.error}>Failed to load analytics</Text>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Streak</Text>
              <View style={styles.bigStatCard}>
                <Text style={styles.bigStat}>{data?.currentStreak ?? 0}</Text>
                <Text style={styles.bigStatLabel}>consecutive days</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Commit Velocity</Text>
              <View style={styles.card}>
                {[
                  { label: '7-day commits', value: String(data?.velocity.commits7d ?? 0) },
                  { label: '30-day commits', value: String(data?.velocity.commits30d ?? 0) },
                  { label: 'Avg/active day', value: (data?.velocity.avgCommitsPerDay7d ?? 0).toFixed(1) },
                  { label: 'Active days (7d)', value: String(data?.velocity.activeDays7d ?? 0) },
                  { label: 'Active days (30d)', value: String(data?.velocity.activeDays30d ?? 0) },
                ].map(({ label, value }) => (
                  <View key={label} style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{label}</Text>
                    <Text style={styles.metricValue}>{value}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activity (90 days)</Text>
              <View style={styles.card}>
                <View style={styles.heatmap}>
                  {[...( data?.recentStreaks ?? [])].reverse().map((day, i) => (
                    <View
                      key={i}
                      style={[styles.heatmapCell, { backgroundColor: day.committed ? '#6C63FF' : '#1A1A2E' }]}
                    />
                  ))}
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  pageTitle: { color: '#FFF', fontSize: 28, fontWeight: '700', marginTop: 20 },
  section: { marginTop: 24 },
  sectionTitle: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  bigStatCard: { backgroundColor: '#161622', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#6C63FF40' },
  bigStat: { color: '#6C63FF', fontSize: 72, fontWeight: '700' },
  bigStatLabel: { color: '#888', fontSize: 14, marginTop: 4 },
  card: { backgroundColor: '#161622', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#1E1E2E', gap: 14 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricLabel: { color: '#888', fontSize: 14 },
  metricValue: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatmapCell: { width: 12, height: 12, borderRadius: 2 },
  error: { color: '#FF6B6B', textAlign: 'center', marginTop: 40 },
});
