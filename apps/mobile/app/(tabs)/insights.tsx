import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
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

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: async () => {
      const res = await apiClient.get<{ insights: AIInsight[]; count: number }>('/api/v1/ai/insights?limit=20');
      return res.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<GenerateResult>('/api/v1/ai/insights/generate');
      return res.data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ai-insights'] }),
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>AI Insights</Text>
          <Text style={styles.pageSubtitle}>Powered by Groq + Gemini</Text>
        </View>
        <TouchableOpacity
          style={[styles.generateButton, generateMutation.isPending && styles.generateButtonDisabled]}
          onPress={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          activeOpacity={0.8}
        >
          {generateMutation.isPending
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Text style={styles.generateButtonText}>✦ Generate</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Newly generated insight banner */}
      {generateMutation.data && (
        <View style={styles.newBanner}>
          <View style={styles.newBannerHeader}>
            <Text style={styles.newBannerLabel}>✦ Just Generated</Text>
            <ProviderBadge provider={generateMutation.data.provider} />
          </View>
          <Text style={styles.newBannerText}>{generateMutation.data.text}</Text>
        </View>
      )}

      {/* Error banner */}
      {generateMutation.isError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠ Generation failed — check AI provider keys</Text>
        </View>
      )}

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
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor="#6C63FF" />
          }
          ListHeaderComponent={
            data && data.count > 0
              ? <Text style={styles.listHeader}>{data.count} insight{data.count !== 1 ? 's' : ''} generated</Text>
              : null
          }
          renderItem={({ item, index }) => <InsightCard insight={item} isLatest={index === 0} />}
        />
      )}
    </SafeAreaView>
  );
}

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
          {!!insight.tokensUsed && <Text style={styles.stat}>{insight.tokensUsed} tok</Text>}
          {!!insight.latencyMs && <Text style={styles.stat}>{Math.round(insight.latencyMs / 1000)}s</Text>}
          <Text style={styles.chevron}>{expanded ? '∧' : '∨'}</Text>
        </View>
      </View>
      {expanded
        ? <Text style={styles.insightText}>{insight.response}</Text>
        : <Text style={styles.insightPreview} numberOfLines={2}>{insight.response}</Text>
      }
    </TouchableOpacity>
  );
}

const PROVIDER_COLORS: Record<string, string> = {
  groq: '#F97316', 'nvidia-nim': '#76B900', gemini: '#4285F4', openai: '#10A37F',
};

function ProviderBadge({ provider }: { provider: string }) {
  const color = PROVIDER_COLORS[provider] ?? '#6C63FF';
  const label = provider === 'nvidia-nim' ? 'NVIDIA'
    : provider.charAt(0).toUpperCase() + provider.slice(1);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}18`, borderColor: `${color}50` }]}>
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
        Generate your first AI growth insight based on your GitHub commit history
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={onGenerate} activeOpacity={0.8}>
        <Text style={styles.emptyButtonText}>Generate First Insight</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12,
  },
  pageTitle: { fontSize: 30, fontFamily: 'TurboDriverItalic', color: '#0F172A' },
  pageSubtitle: { color: '#94A3B8', fontSize: 13, marginTop: 3 },
  generateButton: {
    backgroundColor: '#0F172A', borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 12, minWidth: 110, alignItems: 'center',
  },
  generateButtonDisabled: { opacity: 0.5 },
  generateButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  newBanner: {
    marginHorizontal: 24, marginBottom: 8,
    backgroundColor: '#6C63FF10', borderRadius: 20,
    borderWidth: 1, borderColor: '#6C63FF30', padding: 18,
  },
  newBannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  newBannerLabel: { color: '#6C63FF', fontSize: 12, fontWeight: '700' },
  newBannerText: { color: '#0F172A', fontSize: 14, lineHeight: 22 },

  errorBanner: {
    marginHorizontal: 24, marginBottom: 8,
    backgroundColor: '#EF444415', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#EF444430',
  },
  errorText: { color: '#EF4444', fontSize: 13, fontWeight: '500' },

  list: { paddingHorizontal: 24, paddingBottom: 40, gap: 10 },
  listHeader: { color: '#94A3B8', fontSize: 12, marginBottom: 4 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#F1F5F9', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardLatest: { borderColor: '#6C63FF30' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDate: { color: '#94A3B8', fontSize: 12 },
  cardStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stat: { color: '#CBD5E1', fontSize: 11 },
  chevron: { color: '#94A3B8', fontSize: 14 },
  insightText: { color: '#334155', fontSize: 14, lineHeight: 23 },
  insightPreview: { color: '#64748B', fontSize: 13, lineHeight: 20 },

  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyIcon: { fontSize: 44, color: '#6C63FF' },
  emptyTitle: { color: '#0F172A', fontSize: 22, fontFamily: 'TurboDriverItalic' },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  emptyButton: {
    marginTop: 6, backgroundColor: '#0F172A', borderRadius: 16,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  emptyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
