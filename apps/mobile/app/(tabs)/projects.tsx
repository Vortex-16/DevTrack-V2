import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/src/api/client';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  _count: { tasks: number };
  tasks: { id: string; title: string; status: string; priority: string }[];
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#00D4AA',
  ARCHIVED: '#888',
  PLANNING: '#FFB347',
};

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#FF6B6B',
  MEDIUM: '#FFB347',
  LOW: '#888',
  URGENT: '#FF4444',
};

export default function ProjectsScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get<Project[]>('/api/v1/projects');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color="#6C63FF" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Projects</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{data?.length ?? 0}</Text>
        </View>
      </View>

      {error ? (
        <Text style={styles.error}>Failed to load projects</Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => <ProjectCard project={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const statusColor = STATUS_COLOR[project.status] ?? '#888';
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.projectName}>{project.name}</Text>
        <Text style={styles.taskCount}>{project._count.tasks} tasks</Text>
      </View>

      {project.description && (
        <Text style={styles.description} numberOfLines={2}>{project.description}</Text>
      )}

      {project.tasks.length > 0 && (
        <View style={styles.taskList}>
          {project.tasks.map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[task.priority] ?? '#888' }]} />
              <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
              <Text style={styles.taskStatus}>{task.status}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No Projects Yet</Text>
      <Text style={styles.emptyText}>Create your first project via the API</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 12 },
  pageTitle: { color: '#FFF', fontSize: 28, fontWeight: '700', flex: 1 },
  countBadge: { backgroundColor: '#6C63FF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  card: { backgroundColor: '#161622', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#1E1E2E' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  projectName: { color: '#FFF', fontSize: 16, fontWeight: '600', flex: 1 },
  taskCount: { color: '#666', fontSize: 12 },
  description: { color: '#888', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  taskList: { gap: 8, borderTopWidth: 1, borderTopColor: '#1E1E2E', paddingTop: 12 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  taskTitle: { color: '#CCC', fontSize: 13, flex: 1 },
  taskStatus: { color: '#555', fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#FFF', fontSize: 20, fontWeight: '600' },
  emptyText: { color: '#666', fontSize: 14, marginTop: 8 },
  error: { color: '#FF6B6B', textAlign: 'center', marginTop: 40 },
});
