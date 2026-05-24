import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Alert, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/src/api/client';
import { useState, useRef, useEffect } from 'react';
import {
  PlusIcon, FolderIcon, ClipboardIcon, CheckCircleIcon,
  AlertTriangleIcon, GithubIcon, StarIcon, GitForkIcon,
  MessageSquareIcon, MicIcon, Volume2Icon, GitCommitIcon
} from '@/src/components/Icons';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  techStack: string[];
  tasks: { id: string; title: string; status: string; priority: string }[];
  _count?: { tasks: number };
}

interface GitCommit {
  id: string;
  sha: string;
  message: string;
  authorLogin: string | null;
  committedAt: string;
}

interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  starCount: number;
  forkCount: number;
  openIssueCount: number;
  syncedAt: string | null;
  commits: GitCommit[];
  _count?: { commits: number };
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  isPlaying?: boolean;
  audio?: string | undefined;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE:    { bg: '#E2F5F0', text: '#10B981', label: 'Active' },
  PAUSED:    { bg: '#FEF3C7', text: '#D97706', label: 'Paused' },
  COMPLETED: { bg: '#EEF2F6', text: '#6366F1', label: 'Done' },
  ARCHIVED:  { bg: '#F1F5F9', text: '#64748B', label: 'Archived' },
};

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#EF4444', CRITICAL: '#DC2626', MEDIUM: '#F59E0B', LOW: '#94A3B8',
};

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3776AB',
  Go: '#00ADD8',
  Rust: '#DEC27B',
  HTML: '#E34F26',
  CSS: '#1572B6',
  Ruby: '#CC342D',
  Java: '#B07219',
};

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export default function ProjectsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'projects' | 'repos' | 'copilot'>('projects');
  
  // Create Project Modal State
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // AI Assistant Chat State
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Hey! I am your DevTrack AI Voice Assistant. Ask me anything about your active tasks, project statuses, or code commits.',
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [audioPlaybackId, setAudioPlaybackId] = useState<string | null>(null);

  // Repository Filtering and Searching State
  const [repoSearch, setRepoSearch] = useState('');
  const [repoFilter, setRepoFilter] = useState<'all' | 'owner' | 'contributor' | 'latest'>('all');

  // Sound References
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        void soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const stopAudio = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        // ignore
      }
      soundRef.current = null;
      setAudioPlaybackId(null);
    }
  };

  const playAudio = async (msgId: string, base64Audio: string) => {
    await stopAudio();
    try {
      setAudioPlaybackId(msgId);
      const fileUri = `${FileSystem.cacheDirectory}speech_${msgId}.mp3`;
      await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
          setAudioPlaybackId(null);
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.warn('Failed to play audio:', error);
      setAudioPlaybackId(null);
    }
  };

  // Queries
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get<Project[]>('/api/v1/projects');
      return res.data;
    },
  });

  const { data: repoData, isLoading: reposLoading, error: reposError } = useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      const res = await apiClient.get<{ repos: Repository[]; githubLogin: string | null }>('/api/v1/github/repositories');
      return res.data;
    },
  });

  const repos = repoData?.repos;
  const githubLogin = repoData?.githubLogin;

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/v1/projects', {
        name: newTitle.trim(),
        description: newDesc.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowModal(false); setNewTitle(''); setNewDesc('');
    },
    onError: (err) => Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create project'),
  });

  const chatMutation = useMutation({
    mutationFn: async (msg: string) => {
      const res = await apiClient.post<{ text: string; audio?: string }>('/api/v1/ai/assistant/chat', {
        message: msg,
      });
      return res.data;
    },
    onSuccess: (data) => {
      const newAiMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: 'ai',
        text: data.text,
        audio: data.audio,
      };
      setChatHistory((prev) => [...prev, newAiMsg]);

      // Play the real audio if available
      if (data.audio) {
        void playAudio(newAiMsg.id, data.audio);
      }
    },
    onError: () => {
      setChatHistory((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'ai',
          text: 'Oops, I had trouble retrieving your project details. Please check your internet connection.',
        },
      ]);
    },
    onSettled: () => {
      setIsTyping(false);
    },
  });

  const handleSendChat = () => {
    if (!chatMessage.trim()) return;
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: chatMessage.trim(),
    };
    setChatHistory((prev) => [...prev, userMsg]);
    setIsTyping(true);
    chatMutation.mutate(chatMessage.trim());
    setChatMessage('');
  };

  const handleMicPress = () => {
    // Microphone shortcut to ask a generic voice command
    const commands = [
      'Give me a summary of my active projects',
      'What are my highest priority tasks today?',
      'Check my latest GitHub commits',
    ];
    const randomCmd = commands[Math.floor(Math.random() * commands.length)]!;
    setChatMessage(randomCmd);
  };

  const togglePlayback = (msgId: string) => {
    if (audioPlaybackId === msgId) {
      void stopAudio();
    } else {
      const msg = chatHistory.find((c) => c.id === msgId);
      if (msg?.audio) {
        void playAudio(msgId, msg.audio);
      } else {
        setAudioPlaybackId(msgId);
        setTimeout(() => setAudioPlaybackId(null), 4000);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Title Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Workspace</Text>
          <Text style={styles.pageSubtitle}>Projects, code repos & AI voice copilot</Text>
        </View>
        {activeTab === 'projects' && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)} activeOpacity={0.8}>
            <PlusIcon size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'projects' && styles.tabActive]}
          onPress={() => setActiveTab('projects')}
        >
          <FolderIcon size={16} color={activeTab === 'projects' ? '#4F46E5' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'projects' && styles.tabTextActive]}>Projects</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'repos' && styles.tabActive]}
          onPress={() => setActiveTab('repos')}
        >
          <GithubIcon size={16} color={activeTab === 'repos' ? '#4F46E5' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'repos' && styles.tabTextActive]}>Repos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'copilot' && styles.tabActive]}
          onPress={() => setActiveTab('copilot')}
        >
          <MessageSquareIcon size={16} color={activeTab === 'copilot' ? '#4F46E5' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'copilot' && styles.tabTextActive]}>AI Assistant</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Contents */}
      {activeTab === 'projects' && (
        <View style={{ flex: 1 }}>
          {projectsLoading ? (
            <ActivityIndicator color="#4F46E5" style={{ marginTop: 40 }} />
          ) : projectsError ? (
            <View style={styles.errorBox}>
              <AlertTriangleIcon size={32} color="#EF4444" />
              <Text style={styles.errorTitle}>Failed to load projects</Text>
            </View>
          ) : (
            <FlatList
              data={projects}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <FolderIcon size={48} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No Projects Created</Text>
                  <Text style={styles.emptyText}>Create a new local project to start tracking related tasks and priorities.</Text>
                  <TouchableOpacity style={styles.emptyButton} onPress={() => setShowModal(true)} activeOpacity={0.8}>
                    <PlusIcon size={16} color="#FFF" />
                    <Text style={styles.emptyButtonText}>New Project</Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={({ item }) => {
                const st = STATUS_STYLE[item.status] ?? STATUS_STYLE['ACTIVE']!;
                const taskCount = item.tasks?.length ?? 0;
                return (
                  <View style={styles.projectCard}>
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <FolderIcon size={20} color="#4F46E5" />
                        <Text style={styles.projectName} numberOfLines={1}>{item.title}</Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                        <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
                      </View>
                    </View>
                    {item.description && (
                      <Text style={styles.projectDesc}>{item.description}</Text>
                    )}
                    <View style={styles.projectFooter}>
                      <ClipboardIcon size={14} color="#64748B" />
                      <Text style={styles.taskStats}>{taskCount} Task{taskCount !== 1 ? 's' : ''}</Text>
                      {item.tasks && item.tasks.length > 0 && (
                        <View style={styles.miniTasks}>
                          {item.tasks.slice(0, 2).map((t) => (
                            <View key={t.id} style={styles.miniTaskPill}>
                              <View style={[styles.taskPriorityDot, { backgroundColor: PRIORITY_COLOR[t.priority] ?? '#94A3B8' }]} />
                              <Text style={styles.miniTaskTitle} numberOfLines={1}>{t.title}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {activeTab === 'repos' && (
        <View style={{ flex: 1 }}>
          {reposLoading ? (
            <ActivityIndicator color="#4F46E5" style={{ marginTop: 40 }} />
          ) : reposError ? (
            <View style={styles.errorBox}>
              <AlertTriangleIcon size={32} color="#EF4444" />
              <Text style={styles.errorTitle}>Failed to load GitHub Repos</Text>
              <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                Please ensure you have connected your GitHub account in the profile tab.
              </Text>
            </View>
          ) : (() => {
            const filteredRepos = (repos ?? []).filter((repo) => {
              const matchesSearch = repoSearch.trim() === '' || 
                repo.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
                (repo.description && repo.description.toLowerCase().includes(repoSearch.toLowerCase()));

              if (!matchesSearch) return false;

              if (repoFilter === 'owner') {
                const login = githubLogin;
                return login ? repo.fullName.toLowerCase().startsWith(login.toLowerCase() + '/') : true;
              } else if (repoFilter === 'contributor') {
                const login = githubLogin;
                const isOwned = login ? repo.fullName.toLowerCase().startsWith(login.toLowerCase() + '/') : true;
                return !isOwned;
              }

              return true;
            });

            if (repoFilter === 'latest') {
              filteredRepos.sort((a, b) => {
                const dateA = a.syncedAt ? new Date(a.syncedAt).getTime() : 0;
                const dateB = b.syncedAt ? new Date(b.syncedAt).getTime() : 0;
                return dateB - dateA;
              });
            }

            return (
              <>
                {/* Search Bar */}
                <View style={styles.searchBarContainer}>
                  <TextInput
                    style={styles.searchBarInput}
                    placeholder="Search repositories by name or description..."
                    placeholderTextColor="#94A3B8"
                    value={repoSearch}
                    onChangeText={setRepoSearch}
                  />
                </View>

                {/* Filter Pills Row */}
                <View style={styles.filterPillsScroll}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}>
                    <TouchableOpacity
                      style={[styles.filterPill, repoFilter === 'all' && styles.filterPillActive]}
                      onPress={() => setRepoFilter('all')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.filterPillText, repoFilter === 'all' && styles.filterPillTextActive]}>All Repos</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.filterPill, repoFilter === 'owner' && styles.filterPillActive]}
                      onPress={() => setRepoFilter('owner')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.filterPillText, repoFilter === 'owner' && styles.filterPillTextActive]}>Owner</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.filterPill, repoFilter === 'contributor' && styles.filterPillActive]}
                      onPress={() => setRepoFilter('contributor')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.filterPillText, repoFilter === 'contributor' && styles.filterPillTextActive]}>Contributor</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.filterPill, repoFilter === 'latest' && styles.filterPillActive]}
                      onPress={() => setRepoFilter('latest')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.filterPillText, repoFilter === 'latest' && styles.filterPillTextActive]}>Latest Synced</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                <FlatList
                  data={filteredRepos}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={[styles.list, { paddingTop: 8 }]}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <GithubIcon size={48} color="#94A3B8" />
                      <Text style={styles.emptyTitle}>No Matching Repositories</Text>
                      <Text style={styles.emptyText}>Adjust your search query or filter options.</Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <View style={styles.repoCard}>
                      <View style={styles.repoHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <GithubIcon size={20} color="#0F172A" />
                          <Text style={styles.repoName} numberOfLines={1}>{item.name}</Text>
                        </View>
                        {item.language && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <View style={[styles.langDot, { backgroundColor: LANGUAGE_COLORS[item.language] ?? '#64748B' }]} />
                            <Text style={styles.repoLang}>{item.language}</Text>
                          </View>
                        )}
                      </View>

                      {item.description && (
                        <Text style={styles.repoDesc} numberOfLines={2}>{item.description}</Text>
                      )}

                      {/* Stars / Forks Stats */}
                      <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                          <StarIcon size={14} color="#F59E0B" />
                          <Text style={styles.statVal}>{item.starCount}</Text>
                        </View>
                        <View style={styles.statItem}>
                          <GitForkIcon size={14} color="#475569" />
                          <Text style={styles.statVal}>{item.forkCount}</Text>
                        </View>
                        <View style={styles.statItem}>
                          <ClipboardIcon size={14} color="#EF4444" />
                          <Text style={styles.statVal}>{item.openIssueCount} issues</Text>
                        </View>
                      </View>

                      {/* Commits Section */}
                      <View style={styles.commitsSection}>
                        <View style={styles.commitsHeaderRow}>
                          <GitCommitIcon size={14} color="#4F46E5" />
                          <Text style={styles.commitsTitle}>Synced Commits</Text>
                        </View>
                        {item.commits && item.commits.length > 0 ? (
                          item.commits.map((c) => (
                            <View key={c.id} style={styles.commitRow}>
                              <View style={styles.commitPill}>
                                <Text style={styles.commitSha}>{c.sha.slice(0, 7)}</Text>
                              </View>
                              <Text style={styles.commitMsg} numberOfLines={1}>{c.message}</Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.noCommitsText}>No recent commits synchronized.</Text>
                        )}
                      </View>
                    </View>
                  )}
                />
              </>
            );
          })()}
        </View>
      )}

      {activeTab === 'copilot' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={90}
        >
          <ScrollView
            style={styles.chatScroll}
            contentContainerStyle={styles.chatScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {chatHistory.map((msg) => {
              const isAi = msg.sender === 'ai';
              const isPlaying = audioPlaybackId === msg.id;
              return (
                <View key={msg.id} style={[styles.bubbleWrapper, isAi ? styles.aiWrapper : styles.userWrapper]}>
                  <View style={[styles.chatBubble, isAi ? styles.aiBubble : styles.userBubble]}>
                    <Text style={[styles.bubbleText, isAi ? styles.aiText : styles.userText]}>{msg.text}</Text>
                    {isAi && (
                      <TouchableOpacity
                        style={styles.audioTrigger}
                        onPress={() => togglePlayback(msg.id)}
                        activeOpacity={0.8}
                      >
                        <Volume2Icon size={16} color={isPlaying ? '#4F46E5' : '#94A3B8'} />
                        {isPlaying && (
                          <View style={styles.waveContainer}>
                            <View style={[styles.waveBar, styles.waveBar1]} />
                            <View style={[styles.waveBar, styles.waveBar2]} />
                            <View style={[styles.waveBar, styles.waveBar3]} />
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {isTyping && (
              <View style={[styles.bubbleWrapper, styles.aiWrapper]}>
                <View style={[styles.chatBubble, styles.aiBubble, styles.typingBubble]}>
                  <ActivityIndicator size="small" color="#4F46E5" />
                  <Text style={styles.typingText}>Consulting Nvidia AI RAG context...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Quick command hints */}
          <View style={styles.quickCommands}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                style={styles.quickCmdBtn}
                onPress={() => {
                  setChatMessage('Which projects are currently active?');
                }}
              >
                <Text style={styles.quickCmdText}>Active Projects</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickCmdBtn}
                onPress={() => {
                  setChatMessage('Show me recent GitHub repository commits');
                }}
              >
                <Text style={styles.quickCmdText}>Recent Commits</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickCmdBtn}
                onPress={() => {
                  setChatMessage('List high priority pending tasks');
                }}
              >
                <Text style={styles.quickCmdText}>Pending Tasks</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Input control */}
          <View style={styles.chatInputBar}>
            <TouchableOpacity style={styles.micBtn} onPress={handleMicPress} activeOpacity={0.8}>
              <MicIcon size={20} color="#4F46E5" />
            </TouchableOpacity>
            <TextInput
              style={styles.chatInput}
              value={chatMessage}
              onChangeText={setChatMessage}
              placeholder="Ask anything (Nvidia AI & ElevenLabs)..."
              placeholderTextColor="#94A3B8"
              onSubmitEditing={handleSendChat}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !chatMessage.trim() && styles.sendBtnDisabled]}
              onPress={handleSendChat}
              disabled={!chatMessage.trim() || isTyping}
              activeOpacity={0.8}
            >
              <Text style={styles.sendBtnText}>Ask</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* New Project Modal */}
      <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Project</Text>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="e.g. Portfolio Redesign"
              placeholderTextColor="#94A3B8"
              autoFocus
            />
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Write a brief overview of the project details."
              placeholderTextColor="#94A3B8"
              multiline numberOfLines={3}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9FE' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 18, paddingBottom: 12,
  },
  pageTitle: { fontSize: 32, fontFamily: 'TurboDriverItalic', color: '#0F172A' },
  pageSubtitle: { color: '#64748B', fontSize: 13, marginTop: 2, fontWeight: '500' },
  addButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F172A',
    justifyContent: 'center', alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#4F46E5',
  },
  list: { paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
  projectCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#EEF2F6', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  projectName: { color: '#0F172A', fontSize: 17, fontWeight: '700', flex: 1 },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  projectDesc: { color: '#475569', fontSize: 13, lineHeight: 18 },
  projectFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderTopWidth: 1, borderTopColor: '#F8F9FA', paddingTop: 10, marginTop: 4,
  },
  taskStats: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  miniTasks: { flexDirection: 'row', gap: 8, flex: 1, justifyContent: 'flex-end' },
  miniTaskPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    maxWidth: 100,
  },
  taskPriorityDot: { width: 5, height: 5, borderRadius: 2.5 },
  miniTaskTitle: { fontSize: 11, color: '#475569', fontWeight: '500' },

  repoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#EEF2F6', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  repoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  repoName: { color: '#0F172A', fontSize: 17, fontWeight: '700', flex: 1 },
  langDot: { width: 8, height: 8, borderRadius: 4 },
  repoLang: { color: '#475569', fontSize: 12, fontWeight: '600' },
  repoDesc: { color: '#64748B', fontSize: 13, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statVal: { color: '#475569', fontSize: 12, fontWeight: '600' },
  commitsSection: { gap: 6 },
  commitsHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  commitsTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  commitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commitPill: { backgroundColor: '#EEF2F6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  commitSha: { fontSize: 10, fontFamily: 'monospace', color: '#4F46E5', fontWeight: '700' },
  commitMsg: { fontSize: 12, color: '#475569', flex: 1 },
  noCommitsText: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },

  chatScroll: { flex: 1, paddingHorizontal: 20, backgroundColor: '#FAF9FE' },
  chatScrollContent: { paddingVertical: 16, gap: 14 },
  bubbleWrapper: { flexDirection: 'row', width: '100%' },
  aiWrapper: { justifyContent: 'flex-start' },
  userWrapper: { justifyContent: 'flex-end' },
  chatBubble: {
    maxWidth: '85%', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3,
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#EEF2F6',
  },
  userBubble: {
    backgroundColor: '#4F46E5',
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  aiText: { color: '#1E293B', fontWeight: '500' },
  userText: { color: '#FFFFFF', fontWeight: '500' },
  audioTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8,
  },
  waveContainer: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveBar: { width: 3, backgroundColor: '#4F46E5', borderRadius: 1 },
  waveBar1: { height: 12 },
  waveBar2: { height: 6 },
  waveBar3: { height: 10 },

  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  typingText: { fontSize: 12, color: '#64748B', fontWeight: '600' },

  quickCommands: {
    paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#FAF9FE',
  },
  quickCmdBtn: {
    backgroundColor: '#EEEFFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  quickCmdText: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },

  chatInputBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', gap: 10,
  },
  micBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2F6',
    justifyContent: 'center', alignItems: 'center',
  },
  chatInput: {
    flex: 1, height: 44, backgroundColor: '#F8FAFC', borderRadius: 22,
    paddingHorizontal: 16, color: '#0F172A', fontSize: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  sendBtn: {
    paddingHorizontal: 18, height: 44, borderRadius: 22, backgroundColor: '#4F46E5',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#94A3B8' },
  sendBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { color: '#0F172A', fontSize: 20, fontWeight: '700' },
  emptyText: { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  emptyButton: {
    marginTop: 8, backgroundColor: '#4F46E5', borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  emptyButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, gap: 12,
  },
  modalTitle: { fontSize: 22, fontFamily: 'TurboDriverItalic', color: '#0F172A', marginBottom: 4 },
  inputLabel: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: '#0F172A', fontSize: 14, borderWidth: 1, borderColor: '#E2E8F0',
  },
  textArea: { height: 70, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
  createBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, backgroundColor: '#4F46E5', alignItems: 'center' },
  createBtnDisabled: { opacity: 0.4 },
  createText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  errorBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30, gap: 10 },
  errorTitle: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
  searchBarContainer: {
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  searchBarInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillsScroll: {
    marginBottom: 12,
  },
  filterPill: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterPillActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E530',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#4F46E5',
  },
});
