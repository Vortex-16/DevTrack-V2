import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/src/api/client';
import { useState } from 'react';
import Svg, { Path } from 'react-native-svg';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  techStack: string[];
  tasks: { id: string; title: string; status: string; priority: string }[];
  _count?: { tasks: number };
}

function PlusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE:   { bg: '#D2ECE6', text: '#3A6F62', label: 'Active' },
  PAUSED:   { bg: '#FFF3D4', text: '#7C5D23', label: 'Paused' },
  COMPLETED:{ bg: '#E6DDF8', text: '#5B4A77', label: 'Done' },
  ARCHIVED: { bg: '#F1F5F9', text: '#64748B', label: 'Archived' },
};

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#EF4444', CRITICAL: '#DC2626', MEDIUM: '#F59E0B', LOW: '#94A3B8',
};

export default function ProjectsScreen() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get<Project[]>('/api/v1/projects');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/v1/projects', {
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowModal(false);
      setNewTitle('');
      setNewDesc('');
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create project');
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color="#6C63FF" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>My Projects</Text>
          <Text style={styles.pageSubtitle}>{data?.length ?? 0} total</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)} activeOpacity={0.8}>
          <PlusIcon />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>📡 Couldn't load projects</Text>
          <Text style={styles.errorSub}>Pull down to retry</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState onAdd={() => setShowModal(true)} />}
          renderItem={({ item }) => <ProjectCard project={item} />}
        />
      )}

      {/* Create project modal */}
      <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Project</Text>

            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="e.g. DevTrack Mobile"
              placeholderTextColor="#94A3B8"
              autoFocus
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="What are you building?"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, (!newTitle.trim() || createMutation.isPending) && styles.createBtnDisabled]}
                onPress={() => createMutation.mutate()}
                disabled={!newTitle.trim() || createMutation.isPending}
                activeOpacity={0.8}
              >
                {createMutation.isPending
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.createText}>Create</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const st = STATUS_STYLE[project.status] ?? STATUS_STYLE['ACTIVE']!;
  const taskCount = project._count?.tasks ?? project.tasks.length;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.projectName} numberOfLines={1}>{project.title}</Text>
        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
        </View>
      </View>

      {project.description && (
        <Text style={styles.description} numberOfLines={2}>{project.description}</Text>
      )}

      {project.techStack.length > 0 && (
        <View style={styles.techRow}>
          {project.techStack.slice(0, 4).map((t) => (
            <View key={t} style={styles.techChip}>
              <Text style={styles.techChipText}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.taskCount}>{taskCount} task{taskCount !== 1 ? 's' : ''}</Text>
        {project.tasks.slice(0, 3).map((task) => (
          <View key={task.id} style={styles.taskPill}>
            <View style={[styles.taskDot, { backgroundColor: PRIORITY_COLOR[task.priority] ?? '#94A3B8' }]} />
            <Text style={styles.taskText} numberOfLines={1}>{task.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No Projects Yet</Text>
      <Text style={styles.emptyText}>Track your dev work — create your first project</Text>
      <TouchableOpacity style={styles.emptyButton} onPress={onAdd} activeOpacity={0.8}>
        <Text style={styles.emptyButtonText}>+ Create Project</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16,
  },
  pageTitle: { fontSize: 30, fontFamily: 'TurboDriverItalic', color: '#0F172A' },
  pageSubtitle: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  addButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#0F172A',
    justifyContent: 'center', alignItems: 'center',
  },

  list: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: '#F1F5F9', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  projectName: { color: '#0F172A', fontSize: 17, fontWeight: '700', flex: 1, marginRight: 10 },
  statusPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  description: { color: '#64748B', fontSize: 14, lineHeight: 20 },
  techRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  techChip: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  techChipText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  cardFooter: { gap: 6, borderTopWidth: 1, borderTopColor: '#F8F9FC', paddingTop: 10 },
  taskCount: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  taskPill: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskDot: { width: 6, height: 6, borderRadius: 3 },
  taskText: { color: '#475569', fontSize: 13, flex: 1 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 10 },
  emptyIcon: { fontSize: 52, marginBottom: 6 },
  emptyTitle: { color: '#0F172A', fontSize: 22, fontWeight: '700' },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyButton: {
    marginTop: 10, backgroundColor: '#0F172A', borderRadius: 16,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  emptyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 28, paddingBottom: 40, gap: 12,
  },
  modalTitle: { fontSize: 22, fontFamily: 'TurboDriverItalic', color: '#0F172A', marginBottom: 4 },
  inputLabel: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: '#F8F9FC', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: '#0F172A', fontSize: 15, borderWidth: 1, borderColor: '#F1F5F9',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, borderRadius: 16, paddingVertical: 16,
    backgroundColor: '#F1F5F9', alignItems: 'center',
  },
  cancelText: { color: '#64748B', fontSize: 15, fontWeight: '600' },
  createBtn: {
    flex: 1, borderRadius: 16, paddingVertical: 16,
    backgroundColor: '#0F172A', alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.4 },
  createText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  errorBox: { alignItems: 'center', paddingTop: 60, gap: 8 },
  errorTitle: { color: '#EF4444', fontSize: 18, fontWeight: '700' },
  errorSub: { color: '#94A3B8', fontSize: 14 },
});
