import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/src/api/client';
import { useState } from 'react';

interface AIInsight {
  id: string;
  provider: string;
  model: string;
  response: string;
  tokensUsed: number | null;
  latencyMs: number | null;
  createdAt: string;
}

interface GenerateResult {
  text: string;
  provider: string;
  model: string;
  generatedAt: string;
}

export default function InsightsScreen() {
  const queryClient = useQueryClient();
  const [showLatestOnly, setShowLatestOnly] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: async () => {
      const res = await apiClient.get<{ insights: AIInsight[]; count: number }>(
        '/api/v1/ai/insights?limit=20',
      );
      return res.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<GenerateResult>('/api/v1/ai/insights/generate');
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>AI Insights</Text>
          <Text style={styles.pageSubtitle}>Powered by NVIDIA NIM + Gemini</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.generateButton,
            generateMutation.isPending && styles.generateButtonDisabled,
          ]}
          onPress={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          activeOpacity={0.7}
        >
          {generateMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.generateButtonText}>✦ Generate</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Latest generated insight flash */}
      {generateMutation.data && (
        <View style={styles.newInsightBanner}>
          <View style={styles.newInsightHeader}>
            <Text style={styles.newInsightLabel}>✦ Just Generated</Text>
            <ProviderBadge provider={generateMutation.data.provider} />
          </View>
          <Text style={styles.newInsightText}>{generateMutation.data.text}</Text>
        </View>
      )}

      {/* Generate error */}
      {generateMutation.isError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            ⚠ Generation failed — check your AI provider keys
          </Text>
        </View>
      )}

      {/* Insight history */}
      {isLoading ? (
        <ActivityIndicator color="#6C63FF" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data?.insights}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState onGenerate={() => generateMutation.mutate()} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor="#6C63FF"
            />
          }
          ListHeaderComponent={
            data && data.count > 0 ? (
              <Text style={styles.listHeader}>{data.count} insight{data.count !== 1 ? 's' : ''} generated</Text>
            ) : null
          }
          renderItem={({ item, index }) => (
            <InsightCard insight={item} isLatest={index === 0} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function InsightCard({ insight, isLatest }: { insight: AIInsight; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(isLatest);
  const date = new Date(insight.createdAt);

  return (
    <TouchableOpacity
      style={[styles.card, isLatest && styles.cardLatest]}
      onPress={() => setExpanded((e) => !e)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardMeta}>
          <ProviderBadge provider={insight.provider} />
          <Text style={styles.cardDate}>
            {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <View style={styles.cardStats}>
          {insight.tokensUsed && (
            <Text style={styles.stat}>{insight.tokensUsed} tok</Text>
          )}
          {insight.latencyMs && (
            <Text style={styles.stat}>{Math.round(insight.latencyMs / 1000)}s</Text>
          )}
          <Text style={styles.chevron}>{expanded ? '∧' : '∨'}</Text>
        </View>
      </View>

      {expanded ? (
        <Text style={styles.insightText}>{insight.response}</Text>
      ) : (
        <Text style={styles.insightPreview} numberOfLines={2}>
          {insight.response}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const PROVIDER_COLORS: Record<string, string> = {
  'nvidia-nim': '#76B900',
  gemini: '#4285F4',
};

function ProviderBadge({ provider }: { provider: string }) {
  const color = PROVIDER_COLORS[provider] ?? '#888';
  const label = provider === 'nvidia-nim' ? 'NVIDIA' : provider === 'gemini' ? 'Gemini' : provider;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}20`, borderColor: `${color}60` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>✦</Text>
      <Text style={styles.emptyTitle}>No Insights Yet</Text>
      <Text style={styles.emptyText}>
        Generate your first AI growth insight based on your commit history
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={onGenerate} activeOpacity={0.7}>
        <Text style={styles.emptyButtonText}>Generate First Insight</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  pageTitle: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  pageSubtitle: { color: '#555', fontSize: 12, marginTop: 3 },
  generateButton: {
    backgroundColor: '#6C63FF', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, minWidth: 100, alignItems: 'center',
  },
  generateButtonDisabled: { opacity: 0.6 },
  generateButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  newInsightBanner: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: '#6C63FF15', borderRadius: 16,
    borderWidth: 1, borderColor: '#6C63FF40', padding: 16,
  },
  newInsightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  newInsightLabel: { color: '#6C63FF', fontSize: 12, fontWeight: '700' },
  newInsightText: { color: '#DDD', fontSize: 14, lineHeight: 22 },
  errorBanner: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: '#FF6B6B15', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#FF6B6B40',
  },
  errorText: { color: '#FF6B6B', fontSize: 13 },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  listHeader: { color: '#555', fontSize: 12, marginBottom: 4 },
  card: {
    backgroundColor: '#161622', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#1E1E2E',
  },
  cardLatest: { borderColor: '#6C63FF30' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDate: { color: '#555', fontSize: 12 },
  cardStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stat: { color: '#444', fontSize: 11 },
  chevron: { color: '#555', fontSize: 14 },
  insightText: { color: '#CCC', fontSize: 14, lineHeight: 22 },
  insightPreview: { color: '#888', fontSize: 13, lineHeight: 20 },
  badge: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 40, color: '#6C63FF', marginBottom: 16 },
  emptyTitle: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyButton: {
    backgroundColor: '#6C63FF', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 14, marginTop: 24,
  },
  emptyButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
