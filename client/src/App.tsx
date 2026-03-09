import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  BookOpenText,
  FileText,
  Grid3x3,
  List,
  MessageSquareQuote,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  TrendingUp,
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { SolutionCard } from './components/SolutionCard';
import { SolutionPreviewDrawer } from './components/SolutionPreviewDrawer';
import { SolutionDetail } from './components/SolutionDetail';
import { UploadModal } from './components/UploadModal';
import { ChatInterface } from './components/ChatInterface';
import { CapabilityLibrary } from './components/CapabilityLibrary';
import { KnowledgeGovernanceView } from './components/KnowledgeGovernanceView';
import { Pagination } from './components/Pagination';
import { useToast } from './contexts/ToastContext';
import {
  clearChatHistory,
  getChatHistory,
  getOrCreateChatSessionId,
  removeSolutionChat,
  resetChatSessionId,
  saveChatHistory,
} from './utils/storage';
import type {
  ChatMessage,
  KnowledgeSubmission,
  Solution,
  ViewMode,
} from './types/solution';
import type { ProductCapability } from './types/capability';

const PAGE_SIZE_STORAGE_KEY = 'kb_items_per_page';
const LIST_DENSITY_STORAGE_KEY = 'kb_list_density';
const PAGE_SIZE_OPTIONS = [4, 6, 8] as const;
const COMPACT_PAGE_SIZE_OPTIONS = [4, 6] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
type SortOption = 'newest' | 'oldest' | 'title';
type ListDensity = 'compact' | 'comfortable';

const getDefaultPageSize = () => {
  if (typeof window === 'undefined') {
    return 6;
  }

  return window.innerWidth < 1024 ? 4 : 6;
};

const resolveInitialPageSize = (): PageSizeOption => {
  if (typeof window === 'undefined') {
    return 6;
  }

  const saved = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
  if (PAGE_SIZE_OPTIONS.includes(saved as PageSizeOption)) {
    return saved as PageSizeOption;
  }

  return getDefaultPageSize();
};

const resolveInitialListDensity = (): ListDensity => {
  if (typeof window === 'undefined') {
    return 'compact';
  }

  const saved = window.localStorage.getItem(LIST_DENSITY_STORAGE_KEY);
  if (saved === 'compact' || saved === 'comfortable') {
    return saved;
  }

  return 'compact';
};

type UploadStatus = 'idle' | 'queued' | 'processing' | 'success' | 'failed';

function getApiErrorMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const data = error.response?.data;
  if (!data) {
    return null;
  }

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  if (typeof data.details?.error === 'string' && data.details.error.trim()) {
    return data.details.error;
  }

  if (typeof data.code === 'string' && data.code.trim()) {
    return data.code;
  }

  return null;
}

function App() {
  const { t, i18n } = useTranslation();
  const { showSuccess, showError } = useToast();

  const [view, setView] = useState<ViewMode>('solutions');
  const [selectedSolutionId, setSelectedSolutionId] = useState<string | null>(null);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [submissions, setSubmissions] = useState<KnowledgeSubmission[]>([]);
  const [capabilities, setCapabilities] = useState<ProductCapability[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadStatusMessage, setUploadStatusMessage] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [itemsPerPage, setItemsPerPage] = useState<PageSizeOption>(() => resolveInitialPageSize());
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [listDensity, setListDensity] = useState<ListDensity>(() => resolveInitialListDensity());
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );
  const [isXlViewport, setIsXlViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : false,
  );
  const [previewSolutionId, setPreviewSolutionId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submittedByRole, setSubmittedByRole] = useState<'agent' | 'team_lead'>('agent');
  const [file, setFile] = useState<File | null>(null);
  const [submissionActionId, setSubmissionActionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [globalSessionId, setGlobalSessionId] = useState(() => getOrCreateChatSessionId('global'));

  useEffect(() => {
    const savedHistory = getChatHistory('global');
    if (savedHistory.length > 0) {
      setMessages(savedHistory);
    }
  }, []);

  useEffect(() => {
    saveChatHistory('global', messages);
  }, [messages]);

  useEffect(() => {
    void Promise.all([fetchSolutions(), fetchSubmissions(), fetchSupportAssets()]);
  }, []);

  useEffect(() => {
    const solutionId = new URLSearchParams(window.location.search).get('solution');
    if (solutionId) {
      setSelectedSolutionId(solutionId);
      setView('solution-detail');
    }
  }, []);

  useEffect(() => {
    if (view === 'upload') {
      setShowUploadModal(true);
      setView('solutions');
    }
  }, [view]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage, sortBy]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(itemsPerPage));
  }, [itemsPerPage]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(LIST_DENSITY_STORAGE_KEY, listDensity);
  }, [listDensity]);

  useEffect(() => {
    if (viewMode !== 'list') {
      setPreviewSolutionId(null);
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const syncCompact = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsCompactViewport(event.matches);
    };

    syncCompact(mediaQuery);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncCompact);
      return () => mediaQuery.removeEventListener('change', syncCompact);
    }

    mediaQuery.addListener(syncCompact);
    return () => mediaQuery.removeListener(syncCompact);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const syncViewport = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsXlViewport(event.matches);
    };

    syncViewport(mediaQuery);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport);
      return () => mediaQuery.removeEventListener('change', syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    void i18n.changeLanguage(newLang);
  };

  const fetchSolutions = async () => {
    try {
      const res = await axios.get('/api/solutions');
      setSolutions(res.data);
    } catch (error) {
      console.error('Failed to fetch solutions', error);
      showError(t('solutions.form.fail'));
    }
  };

  const fetchSubmissions = async () => {
    try {
      const res = await axios.get('/api/knowledge/submissions');
      setSubmissions(res.data);
    } catch (error) {
      console.error('Failed to fetch knowledge submissions', error);
    }
  };

  const fetchSupportAssets = async () => {
    try {
      const capabilitiesRes = await axios.get('/api/capabilities');
      setCapabilities(capabilitiesRes.data);
    } catch (error) {
      console.error('Failed to fetch support assets', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/api/solutions/${id}`);
      removeSolutionChat(id);
      showSuccess(t('solutions.card.delete_success'));
      await fetchSolutions();
    } catch (error) {
      console.error('Delete failed', error);
      showError(t('solutions.form.fail'));
    }
  };

  const syncSolutionUrl = (id: string | null) => {
    const nextUrl = new URL(window.location.href);
    if (id) {
      nextUrl.searchParams.set('solution', id);
    } else {
      nextUrl.searchParams.delete('solution');
    }
    window.history.replaceState({}, '', nextUrl);
  };

  const handleSolutionClick = (id: string) => {
    setSelectedSolutionId(id);
    setView('solution-detail');
    syncSolutionUrl(id);
  };

  const handleHomeSolutionClick = (id: string) => {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('solution', id);
    window.open(nextUrl.toString(), '_blank', 'noopener,noreferrer');
  };

  const handleBackFromDetail = () => {
    setSelectedSolutionId(null);
    setView('solutions');
    syncSolutionUrl(null);
  };

  const handleClearGlobalChat = () => {
    if (!window.confirm(t('chat.clear_confirm'))) {
      return;
    }

    if (clearChatHistory('global')) {
      setMessages([]);
      setGlobalSessionId(resetChatSessionId('global'));
      showSuccess(t('chat.clear_success'));
      return;
    }

    showError(t('chat.clear_failed'));
  };

  const rewindConversationTo = (message: ChatMessage) => {
    setInput(message.content);
    const messageIndex = messages.findIndex((item) => item === message);
    if (messageIndex >= 0) {
      setMessages(messages.slice(0, messageIndex));
    }
  };

  const handleDeleteMessage = (index: number) => {
    if (!window.confirm(t('chat.delete_confirm'))) {
      return;
    }

    setMessages(messages.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !title.trim()) {
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('queued');
    setUploadStatusMessage(
      i18n.language === 'zh'
        ? '知识变更已进入提交队列，正在发送到服务端。'
        : 'The knowledge change request has entered the submission queue.',
    );

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('submittedByRole', submittedByRole);

    try {
      await axios.post('/api/knowledge/submissions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) {
            return;
          }

          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
          if (progress >= 100) {
            setUploadStatus('processing');
            setUploadStatusMessage(
              i18n.language === 'zh'
                ? '文件上传完成，系统正在识别元数据并生成待审核记录。'
                : 'Upload complete. Building the review record now.',
            );
          }
        },
      });

      setUploadStatus('success');
      setUploadStatusMessage(
        i18n.language === 'zh'
          ? '资料已提交成功，当前处于待审核状态。'
          : 'The document was submitted successfully and is now pending review.',
      );
      setTitle('');
      setDescription('');
      setSubmittedByRole('agent');
      setFile(null);
      showSuccess(i18n.language === 'zh' ? '知识提报已提交' : 'Knowledge submission created');
      await fetchSubmissions();
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      setUploadProgress(0);
      setShowUploadModal(false);
      setUploadStatus('idle');
      setUploadStatusMessage('');
    } catch (error) {
      const errorMessage = getApiErrorMessage(error);
      console.error('Upload failed', error);
      setUploadProgress(0);
      setUploadStatus('failed');
      setUploadStatusMessage(
        errorMessage
          ? errorMessage
          : i18n.language === 'zh'
            ? '提交失败，请检查文件内容或稍后重试。'
            : 'Submission failed. Please retry in a moment.',
      );
      showError(errorMessage || (i18n.language === 'zh' ? '知识提报失败' : 'Knowledge submission failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmissionReview = async (submissionId: string, decision: 'approve' | 'reject') => {
    try {
      setSubmissionActionId(submissionId);
      await axios.patch(`/api/knowledge/submissions/${submissionId}/review`, {
        decision,
        reviewedBy: 'team_lead',
      });
      await fetchSubmissions();
      showSuccess(
        decision === 'approve'
          ? i18n.language === 'zh'
            ? '提报已完成审核'
            : 'Submission reviewed'
          : i18n.language === 'zh'
            ? '提报已驳回'
            : 'Submission rejected',
      );
    } catch (error) {
      console.error('Knowledge submission review failed', error);
      showError(getApiErrorMessage(error) || (i18n.language === 'zh' ? '审核失败' : 'Review failed'));
    } finally {
      setSubmissionActionId(null);
    }
  };

  const handleSubmissionPublish = async (submissionId: string) => {
    try {
      setSubmissionActionId(submissionId);
      await axios.post(`/api/knowledge/submissions/${submissionId}/publish`);
      await Promise.all([fetchSubmissions(), fetchSolutions()]);
      showSuccess(i18n.language === 'zh' ? '知识已发布入库' : 'Knowledge published');
    } catch (error) {
      console.error('Knowledge submission publish failed', error);
      showError(getApiErrorMessage(error) || (i18n.language === 'zh' ? '发布失败' : 'Publish failed'));
    } finally {
      setSubmissionActionId(null);
    }
  };

  const handleChat = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim()) {
      return;
    }

    const nextMessages = [...messages, { role: 'user' as const, content: input }];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, sessionId: globalSessionId }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let assistantMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');

        for (const line of lines) {
          if (!line.startsWith('data: ')) {
            continue;
          }

          const data = line.slice(6);
          if (data === '[DONE]') {
            setChatLoading(false);
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              setMessages([...nextMessages, { role: 'assistant', content: t('chat.error') }]);
              setChatLoading(false);
              return;
            }

            if (parsed.content) {
              assistantMessage += parsed.content;
              setMessages((previous) => {
                const updated = [...previous];
                const lastMessage = updated[updated.length - 1];
                if (lastMessage?.role === 'assistant') {
                  lastMessage.content = assistantMessage;
                }
                return updated;
              });
            }

            if (parsed.isComplete || parsed.citations) {
              setMessages((previous) => {
                const updated = [...previous];
                const lastMessage = updated[updated.length - 1];
                if (lastMessage?.role === 'assistant') {
                  lastMessage.citations = parsed.citations || [];
                  lastMessage.relatedSolutions = parsed.relatedSolutions || [];
                }
                return updated;
              });
            }
          } catch (parseError) {
            const message =
              parseError instanceof Error ? parseError.message : 'Unknown parse error';
            console.log('[Chat] JSON parse error:', message);
          }
        }
      }
    } catch (error) {
      console.error('Chat failed', error);
      setMessages([...nextMessages, { role: 'assistant', content: t('chat.error') }]);
    } finally {
      setChatLoading(false);
    }
  };

  const availablePageSizes: readonly PageSizeOption[] = isCompactViewport
    ? COMPACT_PAGE_SIZE_OPTIONS
    : PAGE_SIZE_OPTIONS;

  useEffect(() => {
    if (!availablePageSizes.includes(itemsPerPage)) {
      setItemsPerPage(availablePageSizes[availablePageSizes.length - 1]);
    }
  }, [availablePageSizes, itemsPerPage]);

  const filteredSolutions = solutions.filter((solution) => {
    const query = searchQuery.toLowerCase();
    return (
      solution.title.toLowerCase().includes(query) ||
      solution.description.toLowerCase().includes(query) ||
      solution.fileName.toLowerCase().includes(query)
    );
  });

  const sortedSolutions = [...filteredSolutions].sort((left, right) => {
    if (sortBy === 'title') {
      return left.title.localeCompare(right.title, i18n.language === 'zh' ? 'zh-CN' : 'en');
    }

    const leftDate = new Date(left.createdAt || 0).getTime();
    const rightDate = new Date(right.createdAt || 0).getTime();
    if (sortBy === 'oldest') {
      return leftDate - rightDate;
    }
    return rightDate - leftDate;
  });

  const totalPages = Math.ceil(sortedSolutions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedSolutions = sortedSolutions.slice(startIndex, startIndex + itemsPerPage);
  const previewSolution = previewSolutionId
    ? sortedSolutions.find((item) => item.id === previewSolutionId) || null
    : null;
  const pendingSubmissions = submissions.filter((submission) =>
    ['PENDING_REVIEW', 'APPROVED', 'BLOCKED'].includes(submission.status),
  );
  const isFocusBrowseMode =
    viewMode === 'list' && (sortedSolutions.length >= 10 || searchQuery.trim().length > 0);
  const dashboardGridTemplate =
    isXlViewport && !isFocusBrowseMode ? 'minmax(0,1.35fr) 360px' : 'minmax(0,1fr)';

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (previewSolutionId && !previewSolution) {
      setPreviewSolutionId(null);
    }
  }, [previewSolutionId, previewSolution]);

  const suggestedPrompts = [
    t('chat.quick.refund'),
    t('chat.quick.escalation'),
    t('chat.quick.complaint'),
    t('chat.quick.activation'),
  ];
  const isChinese = i18n.language === 'zh';
  const knowledgeSummary = isChinese
    ? '统一管理客服知识文档、FAQ 和操作说明，支持检索、问答与 SOP 协作。'
    : 'Manage support documents, FAQs, and SOP guidance in one workspace for search and Q&A.';
  const assistantReadyLabel = isChinese ? '就绪' : 'Ready';
  const submitKnowledgeLabel = isChinese ? '提交知识变更' : 'Submit Knowledge Change';
  const pendingReviewLabel = isChinese ? '待审核' : 'Pending review';
  const knowledgeWorkflowLabel = isChinese ? '知识提报与审核' : 'Knowledge submission queue';
  const sourceMaterialCards = [
    t('app.home.workflow_items.faq'),
    t('app.home.workflow_items.product'),
    t('app.home.workflow_items.sop'),
  ];

  const heroCards = [
    { icon: ShieldCheck, title: isChinese ? 'SLA 与补偿口径' : 'SLA & compensation', description: t('app.home.panel_items.sla') },
    { icon: TimerReset, title: isChinese ? '人工接管与升级' : 'Escalation handoff', description: t('app.home.panel_items.handoff') },
    { icon: TrendingUp, title: isChinese ? '渠道一致性' : 'Channel consistency', description: t('app.home.panel_items.consistency') },
  ];

  const overviewStats = [
    { label: t('app.home.knowledge_count'), value: solutions.length, accent: 'bg-[#f7ecd8] text-stone-900 dark:bg-[#2a231d] dark:text-stone-100' },
    { label: t('app.home.sop_count'), value: capabilities.length, accent: 'bg-[#fbf7f0] text-stone-900 dark:bg-[#201d1a] dark:text-stone-100' },
    { label: pendingReviewLabel, value: pendingSubmissions.length, accent: 'bg-[#fbf7f0] text-stone-900 dark:bg-[#201d1a] dark:text-stone-100' },
    { label: t('app.home.assistant_ready'), value: '24/7', accent: 'bg-[#fbf7f0] text-stone-900 dark:bg-[#201d1a] dark:text-stone-100' },
  ];

  const primaryPanelClass =
    'rounded-[34px] border border-stone-200/80 bg-white/88 shadow-[0_24px_60px_rgba(50,35,23,0.06)] backdrop-blur dark:border-[#4a423b] dark:bg-[#221e1b]/92';
  const secondaryPanelClass =
    'rounded-[28px] border border-stone-200/70 bg-[#fbf8f3]/92 shadow-[0_18px_45px_rgba(50,35,23,0.05)] dark:border-[#4a423b] dark:bg-[#2a2521]/92';

  const getRomanNumeral = (index: number) => {
    const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return numerals[index] || String(index + 1);
  };

  const renderDashboard = () => (
    <>
      <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-[rgba(245,241,234,0.82)] backdrop-blur dark:border-[#2f2b28] dark:bg-[rgba(18,17,15,0.8)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-stone-500 dark:text-stone-400">
              {t('app.home.archive_subtitle')}
            </p>
            <p className="mt-1 text-sm font-medium text-stone-800 dark:text-stone-100">
              {t('app.title')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-stone-200/80 bg-white/85 px-3 py-1.5 text-xs font-medium text-stone-600 dark:border-[#35302b] dark:bg-[#1f1c19] dark:text-stone-300 sm:inline-flex">
              {pendingSubmissions.length} {pendingReviewLabel}
            </span>
            <span className="rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-300">
              {assistantReadyLabel}
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-2 pt-6 lg:px-10 lg:pt-8">
        <div
          className="grid gap-5 transition-[grid-template-columns] duration-500 ease-out"
          style={{ gridTemplateColumns: dashboardGridTemplate }}
        >
          <div className={`${primaryPanelClass} p-7 sm:p-8 lg:p-10`}>
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/85 px-3 py-1.5 text-xs font-medium tracking-[0.14em] text-[var(--app-accent)] dark:border-[#35302b] dark:bg-[#1f1c19]">
              <Sparkles size={14} />
              {t('app.home.badge')}
            </div>

            <h1 className="mt-6 max-w-4xl font-serif text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.03em] text-stone-950 dark:text-stone-50 sm:text-[3.3rem]">
              {t('app.home.hero_title')}
            </h1>

            <p className="mt-5 max-w-2xl text-[15px] leading-8 text-stone-600 dark:text-stone-300">
              {knowledgeSummary}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white"
              >
                <Plus size={16} />
                {submitKnowledgeLabel}
              </button>
              <div className="rounded-full border border-stone-200/80 bg-white/80 px-4 py-3 text-sm text-stone-600 dark:border-[#35302b] dark:bg-[#1f1c19] dark:text-stone-300">
                {filteredSolutions.length} {t('app.home.stat_filtered')}
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {overviewStats.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-[26px] border border-stone-200/70 px-5 py-4 dark:border-[#35302b] ${item.accent}`}
                >
                  <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
                    {item.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`grid gap-4 transition-[max-height,opacity,transform] duration-500 ease-out ${
              isFocusBrowseMode
                ? 'pointer-events-none max-h-0 -translate-x-4 overflow-hidden opacity-0'
                : 'max-h-[1200px] translate-x-0 opacity-100'
            }`}
          >
            {heroCards.map((card) => (
              <div key={card.title} className={`${secondaryPanelClass} p-5`}>
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                    <card.icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-serif text-[1.35rem] font-semibold text-stone-900 dark:text-stone-100">
                      {card.title}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-stone-600 dark:text-stone-300">
                      {card.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-5 lg:px-10">
        <div
          className="grid gap-5 transition-[grid-template-columns] duration-500 ease-out"
          style={{ gridTemplateColumns: dashboardGridTemplate }}
        >
          <div className={`${primaryPanelClass} p-6 sm:p-7`}>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                    <BookOpenText size={19} />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
                      {t('app.home.archive_subtitle')}
                    </p>
                    <h2 className="font-serif text-[1.7rem] font-semibold text-stone-950 dark:text-stone-50">
                      {t('app.home.archive_title')}
                    </h2>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-stone-600 dark:text-stone-300">
                  {knowledgeSummary}
                </p>
              </div>

              <div className="sticky top-14 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--app-surface)]/94 px-1 py-1 backdrop-blur dark:bg-[#201c19]/94">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white"
                >
                  <Plus size={16} />
                  {submitKnowledgeLabel}
                </button>

                <div className="flex items-center gap-1 rounded-full border border-stone-200/80 bg-[#f8f4ee] p-1 dark:border-[#35302b] dark:bg-[#201d1a]">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`rounded-full p-2.5 transition ${
                      viewMode === 'grid'
                        ? 'bg-white text-stone-950 shadow-sm dark:bg-[#2a2622] dark:text-stone-50'
                        : 'text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200'
                    }`}
                    title={t('app.home.grid_view')}
                  >
                    <Grid3x3 size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`rounded-full p-2.5 transition ${
                      viewMode === 'list'
                        ? 'bg-white text-stone-950 shadow-sm dark:bg-[#2a2622] dark:text-stone-50'
                        : 'text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200'
                    }`}
                    title={t('app.home.list_view')}
                  >
                    <List size={16} />
                  </button>
                </div>

                <div className="inline-flex items-center gap-1 rounded-full border border-stone-200/80 bg-[#f8f4ee] p-1 dark:border-[#35302b] dark:bg-[#201d1a]">
                  <span className="pl-2 pr-1 text-[11px] font-medium text-stone-500 dark:text-stone-400">
                    {isChinese ? '每页' : 'Per page'}
                  </span>
                  {availablePageSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setItemsPerPage(size)}
                      className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                        itemsPerPage === size
                          ? 'bg-white text-stone-950 shadow-sm dark:bg-[#2a2622] dark:text-stone-50'
                          : 'text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200'
                      }`}
                      title={isChinese ? `每页 ${size} 条` : `${size} per page`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <label className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-[#f8f4ee] px-3 py-1.5 text-xs text-stone-500 dark:border-[#35302b] dark:bg-[#201d1a] dark:text-stone-400">
                  <span>{isChinese ? '排序' : 'Sort'}</span>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as SortOption)}
                    className="bg-transparent text-xs font-medium text-stone-700 outline-none dark:text-stone-200"
                  >
                    <option value="newest">{isChinese ? '最新优先' : 'Newest'}</option>
                    <option value="oldest">{isChinese ? '最早优先' : 'Oldest'}</option>
                    <option value="title">{isChinese ? '按标题' : 'Title'}</option>
                  </select>
                </label>

                {viewMode === 'list' && (
                  <div className="inline-flex items-center gap-1 rounded-full border border-stone-200/80 bg-[#f8f4ee] p-1 dark:border-[#35302b] dark:bg-[#201d1a]">
                    <span className="pl-2 pr-1 text-[11px] font-medium text-stone-500 dark:text-stone-400">
                      Density
                    </span>
                    <button
                      onClick={() => setListDensity('compact')}
                      className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                        listDensity === 'compact'
                          ? 'bg-white text-stone-950 shadow-sm dark:bg-[#2a2622] dark:text-stone-50'
                          : 'text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200'
                      }`}
                      title="Compact list density"
                    >
                      Compact
                    </button>
                    <button
                      onClick={() => setListDensity('comfortable')}
                      className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                        listDensity === 'comfortable'
                          ? 'bg-white text-stone-950 shadow-sm dark:bg-[#2a2622] dark:text-stone-50'
                          : 'text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200'
                      }`}
                      title="Comfortable list density"
                    >
                      Comfortable
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isFocusBrowseMode && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/90 px-3 py-1 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-300">
                {isChinese
                  ? '已启用专注浏览模式：右侧信息栏已收起，优先展示文档列表。'
                  : 'Focus browse mode is active: the right rail is hidden to prioritize documents.'}
              </div>
            )}

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-stone-200/70 bg-[#faf7f2] px-4 py-4 dark:border-[#35302b] dark:bg-[#201d1a]">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
                    {t('app.home.stat_documents')}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{solutions.length}</p>
                </div>
                <div className="rounded-[24px] border border-stone-200/70 bg-[#faf7f2] px-4 py-4 dark:border-[#35302b] dark:bg-[#201d1a]">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
                    {t('app.home.stat_filtered')}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{filteredSolutions.length}</p>
                </div>
                <div className="rounded-[24px] border border-stone-200/70 bg-[#faf7f2] px-4 py-4 dark:border-[#35302b] dark:bg-[#201d1a]">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
                    {t('app.home.stat_assistant')}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{assistantReadyLabel}</p>
                </div>
              </div>

              <label className="relative block">
                <Search
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('app.home.search_placeholder')}
                  className="w-full rounded-full border border-stone-200/80 bg-[#faf7f2] py-3.5 pl-11 pr-4 text-sm text-stone-800 outline-none transition focus:border-stone-300 focus:bg-white dark:border-[#35302b] dark:bg-[#201d1a] dark:text-stone-100 dark:focus:border-[#4b443d]"
                />
              </label>
            </div>

            <div className="mt-7">
              {filteredSolutions.length > 0 ? (
                <>
                  {viewMode === 'list' && (
                    <div className="mb-2 hidden grid-cols-[88px_minmax(0,1.8fr)_minmax(0,1.1fr)_96px_84px_auto] items-center gap-3 px-3 text-[10px] uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500 md:grid">
                      <span>{isChinese ? '编号' : 'ID'}</span>
                      <span>{isChinese ? '标题' : 'Title'}</span>
                      <span>{isChinese ? '标签' : 'Tags'}</span>
                      <span>{isChinese ? '日期' : 'Date'}</span>
                      <span>{isChinese ? '类型' : 'Type'}</span>
                      <span className="text-right">{isChinese ? '操作' : 'Actions'}</span>
                    </div>
                  )}

                  <div
                    className={
                      viewMode === 'grid'
                        ? 'grid gap-3 sm:grid-cols-2 2xl:grid-cols-3'
                        : listDensity === 'compact'
                          ? 'flex flex-col gap-2'
                          : 'flex flex-col gap-2.5'
                    }
                  >
                    {displayedSolutions.map((solution, index) => (
                      <SolutionCard
                        key={solution.id}
                        solution={solution}
                        onDelete={handleDelete}
                        onClick={viewMode === 'list' ? setPreviewSolutionId : handleHomeSolutionClick}
                        onOpenDetail={handleHomeSolutionClick}
                        numeral={String(getRomanNumeral(startIndex + index))}
                        index={startIndex + index}
                        viewMode={viewMode}
                        isSelected={solution.id === previewSolutionId}
                        density={listDensity}
                      />
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      totalItems={sortedSolutions.length}
                      itemsPerPage={itemsPerPage}
                    />
                  )}
                </>
              ) : (
                <div className="rounded-[30px] border border-dashed border-stone-200/80 bg-[#faf7f2] px-6 py-16 text-center dark:border-[#35302b] dark:bg-[#201d1a]">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-white/85 text-stone-400 dark:bg-[#27231f]">
                    <FileText size={34} />
                  </div>
                  <p className="mt-5 font-serif text-[1.6rem] font-semibold text-stone-900 dark:text-stone-100">
                    {t('app.home.empty_title')}
                  </p>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-stone-500 dark:text-stone-300">
                    {t('app.home.empty_hint')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div
            className={`grid gap-4 transition-[max-height,opacity,transform] duration-500 ease-out ${
              isFocusBrowseMode
                ? 'pointer-events-none max-h-0 -translate-x-4 overflow-hidden opacity-0'
                : 'max-h-[2200px] translate-x-0 opacity-100'
            }`}
          >
            <div className={`${secondaryPanelClass} p-5`}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                  <MessageSquareQuote size={18} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
                    {t('app.home.panel_title')}
                  </p>
                  <h3 className="font-serif text-[1.45rem] font-semibold text-stone-900 dark:text-stone-100">
                    {t('app.home.quick_prompts_title')}
                  </h3>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="rounded-full border border-stone-200/80 bg-white/85 px-3 py-2 text-left text-xs leading-5 text-stone-700 transition hover:border-stone-300 hover:bg-white dark:border-[#35302b] dark:bg-[#1f1c19] dark:text-stone-300 dark:hover:border-[#4a433c]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className={`${secondaryPanelClass} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
                    Queue overview
                  </p>
                  <h3 className="font-serif text-[1.45rem] font-semibold text-stone-900 dark:text-stone-100">
                    {knowledgeWorkflowLabel}
                  </h3>
                </div>
                <span className="rounded-full border border-stone-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-600 dark:border-[#35302b] dark:bg-[#1f1c19] dark:text-stone-300">
                  {pendingSubmissions.length} {pendingReviewLabel}
                </span>
              </div>

              <p className="mt-3 text-sm leading-7 text-stone-500 dark:text-stone-300">
                {isChinese
                  ? '治理流程已经从首页长列表里移出，只保留一个轻入口，避免干扰知识检索。'
                  : 'Governance no longer occupies the home page with a long queue. Only a light entry stays here.'}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-[20px] border border-stone-200/70 bg-white/80 px-3 py-3 dark:border-[#35302b] dark:bg-[#1f1c19]">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">
                    {isChinese ? '待审核' : 'Pending'}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{submissions.filter((item) => item.status === 'PENDING_REVIEW').length}</p>
                </div>
                <div className="rounded-[20px] border border-stone-200/70 bg-white/80 px-3 py-3 dark:border-[#35302b] dark:bg-[#1f1c19]">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">
                    {isChinese ? '待发布' : 'Approved'}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{submissions.filter((item) => item.status === 'APPROVED').length}</p>
                </div>
                <div className="rounded-[20px] border border-stone-200/70 bg-white/80 px-3 py-3 dark:border-[#35302b] dark:bg-[#1f1c19]">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">
                    {isChinese ? '阻塞项' : 'Blocked'}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{submissions.filter((item) => item.status === 'BLOCKED').length}</p>
                </div>
              </div>

              <button
                onClick={() => setView('governance')}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white"
              >
                {isChinese ? '进入治理队列' : 'Open governance queue'}
              </button>
            </div>

            <div className={`${secondaryPanelClass} p-5`}>
              <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
                {t('app.home.workflow_title')}
              </p>
              <div className="mt-4 space-y-3">
                {sourceMaterialCards.map((item, index) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-[24px] border border-stone-200/70 bg-white/80 px-4 py-4 dark:border-[#35302b] dark:bg-[#1f1c19]"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-xs font-semibold text-[var(--app-accent)]">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-7 text-stone-700 dark:text-stone-300">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-10 pt-1 lg:px-10">
        <ChatInterface
          messages={messages}
          input={input}
          chatLoading={chatLoading}
          onInputChange={setInput}
          onSubmit={handleChat}
          solutions={solutions}
          onSolutionClick={handleSolutionClick}
          onClearChat={handleClearGlobalChat}
          onResend={rewindConversationTo}
          onEdit={rewindConversationTo}
          onDelete={handleDeleteMessage}
        />
      </section>

      <SolutionPreviewDrawer
        solution={previewSolution}
        isOpen={viewMode === 'list' && Boolean(previewSolution)}
        onClose={() => setPreviewSolutionId(null)}
        onOpenDetail={handleHomeSolutionClick}
      />
    </>
  );

  return (
    <div className="flex min-h-screen bg-[var(--app-canvas)] text-stone-900 dark:bg-[var(--app-canvas)] dark:text-stone-100">
      <Sidebar
        view={view}
        setView={setView}
        toggleLanguage={toggleLanguage}
        currentLang={i18n.language}
        onUploadClick={() => setShowUploadModal(true)}
      />

      <main className="min-w-0 flex-1 overflow-y-auto">
        {view === 'solution-detail' && selectedSolutionId ? (
          <SolutionDetail solutionId={selectedSolutionId} onBack={handleBackFromDetail} />
        ) : view === 'capabilities' ? (
          <div className="px-4 py-4 sm:px-6 lg:px-8">
            <CapabilityLibrary />
          </div>
        ) : view === 'governance' ? (
          <KnowledgeGovernanceView
            submissions={submissions}
            busySubmissionId={submissionActionId}
            onApprove={(id) => void handleSubmissionReview(id, 'approve')}
            onReject={(id) => void handleSubmissionReview(id, 'reject')}
            onPublish={(id) => void handleSubmissionPublish(id)}
            onOpenPublishedAsset={handleSolutionClick}
          />
        ) : (
          renderDashboard()
        )}
      </main>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title={title}
        description={description}
        submittedByRole={submittedByRole}
        file={file}
        uploading={uploading}
        uploadProgress={uploadProgress}
        uploadStatus={uploadStatus}
        uploadStatusMessage={uploadStatusMessage}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onSubmittedByRoleChange={setSubmittedByRole}
        onFileChange={setFile}
        onSubmit={handleUpload}
      />
    </div>
  );
}

export default App;
