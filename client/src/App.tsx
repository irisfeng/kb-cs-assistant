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
import { SolutionDetail } from './components/SolutionDetail';
import { UploadModal } from './components/UploadModal';
import { ChatInterface } from './components/ChatInterface';
import { CapabilityLibrary } from './components/CapabilityLibrary';
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
import type { ChatMessage, Solution, ViewMode } from './types/solution';
import type { ProductCapability } from './types/capability';

const ITEMS_PER_PAGE = 12;
type UploadStatus = 'idle' | 'queued' | 'processing' | 'success' | 'failed';

function App() {
  const { t, i18n } = useTranslation();
  const { showSuccess, showError } = useToast();

  const [view, setView] = useState<ViewMode>('solutions');
  const [selectedSolutionId, setSelectedSolutionId] = useState<string | null>(null);

  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [capabilities, setCapabilities] = useState<ProductCapability[]>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadStatusMessage, setUploadStatusMessage] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

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
    void Promise.all([fetchSolutions(), fetchSupportAssets()]);
  }, []);

  useEffect(() => {
    if (view === 'upload') {
      setShowUploadModal(true);
      setView('solutions');
    }
  }, [view]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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

  const handleSolutionClick = (id: string) => {
    setSelectedSolutionId(id);
    setView('solution-detail');
  };

  const handleBackFromDetail = () => {
    setSelectedSolutionId(null);
    setView('solutions');
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
      i18n.language === 'zh' ? '文件已进入上传队列，正在发送到服务端。' : 'The file has entered the upload queue.',
    );

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);

    try {
      await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
            if (progress >= 100) {
              setUploadStatus('processing');
              setUploadStatusMessage(
                i18n.language === 'zh'
                  ? '文件上传完成，正在解析内容并写入知识库。'
                  : 'Upload complete. Parsing and indexing the document now.',
              );
            }
          }
        },
      });

      setUploadStatus('success');
      setUploadStatusMessage(
        i18n.language === 'zh'
          ? '资料已成功入库，可以开始检索和问答。'
          : 'The document was indexed successfully and is ready for Q&A.',
      );
      setUploading(false);
      setTitle('');
      setDescription('');
      setFile(null);
      showSuccess(t('solutions.form.success'));
      await fetchSolutions();
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      setUploadProgress(0);
      setShowUploadModal(false);
      setUploadStatus('idle');
      setUploadStatusMessage('');
    } catch (error) {
      console.error('Upload failed', error);
      setUploadProgress(0);
      setUploadStatus('failed');
      setUploadStatusMessage(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : i18n.language === 'zh'
            ? '上传失败，请检查文件内容或稍后重试。'
            : 'Upload failed. Please retry in a moment.',
      );
      showError(t('solutions.form.fail'));
    } finally {
      setUploading(false);
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

  const filteredSolutions = solutions.filter((solution) => {
    const query = searchQuery.toLowerCase();
    return (
      solution.title.toLowerCase().includes(query) ||
      solution.description.toLowerCase().includes(query) ||
      solution.fileName.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(filteredSolutions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const displayedSolutions = filteredSolutions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const suggestedPrompts = [
    t('chat.quick.refund'),
    t('chat.quick.escalation'),
    t('chat.quick.complaint'),
    t('chat.quick.activation'),
  ];
  const isChinese = i18n.language === 'zh';
  const knowledgeSummary = isChinese
    ? '\u7edf\u4e00\u7ba1\u7406\u5ba2\u670d\u77e5\u8bc6\u6587\u6863\u3001FAQ \u548c\u64cd\u4f5c\u8bf4\u660e\uff0c\u652f\u6301\u68c0\u7d22\u3001\u95ee\u7b54\u4e0e SOP \u534f\u4f5c\u3002'
    : 'Manage support documents, FAQs, and SOP guidance in one workspace for search and Q&A.';
  const coreScenarioLabel = isChinese ? '\u6838\u5fc3\u573a\u666f' : 'Core Scenarios';
  const assistantReadyLabel = isChinese ? '\u5c31\u7eea' : 'Ready';

  const heroCards = [
    {
      icon: ShieldCheck,
      title: isChinese ? 'SLA / \u8865\u507f\u89c4\u5219' : 'SLA / Compensation',
      description: t('app.home.panel_items.sla'),
    },
    {
      icon: TimerReset,
      title: isChinese ? '\u8f6c\u4eba\u5de5 / \u5347\u7ea7\u6d41' : 'Handoff / Escalation',
      description: t('app.home.panel_items.handoff'),
    },
    {
      icon: TrendingUp,
      title: isChinese ? '\u591a\u6e20\u9053\u7edf\u4e00\u53e3\u5f84' : 'Channel Consistency',
      description: t('app.home.panel_items.consistency'),
    },
  ];

  const getRomanNumeral = (index: number) => {
    const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return numerals[index] || String(index + 1);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f2ea] text-neutral-900 dark:bg-dark-bg dark:text-dark-text">
      <Sidebar
        view={view}
        setView={setView}
        toggleLanguage={toggleLanguage}
        currentLang={i18n.language}
        onUploadClick={() => setShowUploadModal(true)}
      />

      <main className="flex flex-1 flex-col overflow-y-auto">
        {view === 'solution-detail' && selectedSolutionId ? (
          <SolutionDetail solutionId={selectedSolutionId} onBack={handleBackFromDetail} />
        ) : view === 'capabilities' ? (
          <CapabilityLibrary />
        ) : (
          <div className="pb-12">
            <section className="border-b border-neutral-200 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_35%),linear-gradient(180deg,#fffdf9_0%,#f7f1e7_100%)] dark:border-dark-border dark:bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_28%),linear-gradient(180deg,#1e1e22_0%,#151518_100%)]">
              <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[1.4fr_0.9fr] lg:px-8 lg:py-10">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-medium text-amber-700 shadow-sm backdrop-blur dark:border-amber-900/60 dark:bg-white/5 dark:text-amber-400">
                    <Sparkles size={14} />
                    {t('app.home.badge')}
                  </div>
                  <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white lg:text-5xl">
                    {t('app.home.hero_title')}
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-600 dark:text-dark-textSecondary lg:text-base">
                    {knowledgeSummary}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-3xl bg-neutral-950 px-5 py-4 text-white shadow-xl shadow-neutral-950/10 dark:bg-white dark:text-neutral-950">
                      <p className="text-xs uppercase tracking-[0.25em] text-white/60 dark:text-neutral-500">
                        {t('app.home.knowledge_count')}
                      </p>
                      <p className="mt-3 text-3xl font-semibold">{solutions.length}</p>
                    </div>
                    <div className="rounded-3xl border border-white/70 bg-white/70 px-5 py-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs uppercase tracking-[0.25em] text-neutral-400">
                        {t('app.home.sop_count')}
                      </p>
                      <p className="mt-3 text-3xl font-semibold">{capabilities.length}</p>
                    </div>
                    <div className="rounded-3xl border border-white/70 bg-white/70 px-5 py-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs uppercase tracking-[0.25em] text-neutral-400">
                        {coreScenarioLabel}
                      </p>
                      <p className="mt-3 text-3xl font-semibold">5</p>
                    </div>
                    <div className="rounded-3xl border border-white/70 bg-white/70 px-5 py-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs uppercase tracking-[0.25em] text-neutral-400">
                        {t('app.home.assistant_ready')}
                      </p>
                      <p className="mt-3 text-3xl font-semibold">24/7</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  {heroCards.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                          <card.icon size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{card.title}</p>
                          <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-dark-textSecondary">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
              <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                          <BookOpenText size={20} />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-amber-600">
                            {t('app.home.archive_subtitle')}
                          </p>
                          <h2 className="text-xl font-semibold text-neutral-950 dark:text-white">
                            {t('app.home.archive_title')}
                          </h2>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-neutral-500 dark:text-dark-textSecondary">
                        {knowledgeSummary}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-amber-500 dark:text-neutral-950 dark:hover:bg-amber-400"
                      >
                        <Plus size={16} />
                        {t('app.home.new_solution')}
                      </button>

                      <div className="flex items-center gap-1 rounded-2xl border border-neutral-200 bg-neutral-50 p-1 dark:border-dark-border dark:bg-dark-bg">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`rounded-xl p-2 transition ${
                            viewMode === 'grid'
                              ? 'bg-white text-neutral-950 shadow-sm dark:bg-dark-card dark:text-dark-text'
                              : 'text-neutral-400'
                          }`}
                          title={t('app.home.grid_view')}
                        >
                          <Grid3x3 size={16} />
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`rounded-xl p-2 transition ${
                            viewMode === 'list'
                              ? 'bg-white text-neutral-950 shadow-sm dark:bg-dark-card dark:text-dark-text'
                              : 'text-neutral-400'
                          }`}
                          title={t('app.home.list_view')}
                        >
                          <List size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="grid flex-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-stone-50 px-4 py-3 dark:bg-dark-bg">
                        <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">
                          {t('app.home.stat_documents')}
                        </p>
                        <p className="mt-2 text-2xl font-semibold">{solutions.length}</p>
                      </div>
                      <div className="rounded-2xl bg-stone-50 px-4 py-3 dark:bg-dark-bg">
                        <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">
                          {t('app.home.stat_filtered')}
                        </p>
                        <p className="mt-2 text-2xl font-semibold">{filteredSolutions.length}</p>
                      </div>
                      <div className="rounded-2xl bg-stone-50 px-4 py-3 dark:bg-dark-bg">
                        <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">
                          {t('app.home.stat_assistant')}
                        </p>
                        <p className="mt-2 text-2xl font-semibold">{assistantReadyLabel}</p>
                      </div>
                    </div>

                    <div className="relative w-full md:max-w-xs">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={t('app.home.search_placeholder')}
                        className="w-full rounded-2xl border border-neutral-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
                      />
                    </div>
                  </div>

                  <div className="mt-6">
                    {filteredSolutions.length > 0 ? (
                      <>
                        <div
                          className={
                            viewMode === 'grid'
                              ? 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4'
                              : 'flex flex-col gap-3'
                          }
                        >
                          {displayedSolutions.map((solution, index) => (
                            <SolutionCard
                              key={solution.id}
                              solution={solution}
                              onDelete={handleDelete}
                              onClick={handleSolutionClick}
                              numeral={String(getRomanNumeral(startIndex + index))}
                              index={startIndex + index}
                              viewMode={viewMode}
                            />
                          ))}
                        </div>

                        {totalPages > 1 && (
                          <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            totalItems={filteredSolutions.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                          />
                        )}
                      </>
                    ) : (
                      <div className="rounded-[28px] border-2 border-dashed border-neutral-200 px-6 py-16 text-center dark:border-dark-border">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-stone-100 dark:bg-dark-bg">
                          <FileText size={36} className="text-neutral-400" />
                        </div>
                        <p className="mt-5 text-lg font-medium">{t('app.home.empty_title')}</p>
                        <p className="mt-2 text-sm text-neutral-500 dark:text-dark-textSecondary">
                          {t('app.home.empty_hint')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                        <MessageSquareQuote size={20} />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-neutral-400">
                          {t('app.home.panel_title')}
                        </p>
                        <h3 className="text-lg font-semibold text-neutral-950 dark:text-white">
                          {t('app.home.quick_prompts_title')}
                        </h3>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {suggestedPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => setInput(prompt)}
                          className="rounded-full border border-neutral-200 px-3 py-2 text-left text-xs leading-5 text-neutral-700 transition hover:border-amber-300 hover:bg-amber-50 dark:border-dark-border dark:text-dark-textSecondary dark:hover:bg-amber-500/10"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
                    <h3 className="text-lg font-semibold text-neutral-950 dark:text-white">
                      {t('app.home.workflow_title')}
                    </h3>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl bg-stone-50 p-4 dark:bg-dark-bg">
                        <p className="text-sm font-medium">{t('app.home.workflow_items.faq')}</p>
                      </div>
                      <div className="rounded-2xl bg-stone-50 p-4 dark:bg-dark-bg">
                        <p className="text-sm font-medium">{t('app.home.workflow_items.product')}</p>
                      </div>
                      <div className="rounded-2xl bg-stone-50 p-4 dark:bg-dark-bg">
                        <p className="text-sm font-medium">{t('app.home.workflow_items.sop')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="border-t border-neutral-200 bg-white/80 py-8 backdrop-blur dark:border-dark-border dark:bg-dark-card/60">
              <div className="mx-auto max-w-7xl px-5 lg:px-8">
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
              </div>
            </section>
          </div>
        )}
      </main>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title={title}
        description={description}
        file={file}
        uploading={uploading}
        uploadProgress={uploadProgress}
        uploadStatus={uploadStatus}
        uploadStatusMessage={uploadStatusMessage}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onFileChange={setFile}
        onSubmit={handleUpload}
      />
    </div>
  );
}

export default App;
