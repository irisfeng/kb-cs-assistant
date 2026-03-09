import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  RotateCcw,
  Send,
  Trash2,
  User,
  Workflow,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import mermaid from 'mermaid';
import type { ChatMessage, EnhancedCitation, Solution } from '../types/solution';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

interface ChatInterfaceProps {
  messages: ChatMessage[];
  input: string;
  chatLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  solutions?: Solution[];
  onSolutionClick?: (id: string) => void;
  onClearChat?: () => void;
  onResend?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage) => void;
  onDelete?: (index: number) => void;
}

const SUPPORT_SECTION_TITLES = [
  '建议回复',
  '处理步骤',
  '核验要点',
  '升级建议',
  '引用依据',
] as const;

type SupportSectionTitle = (typeof SUPPORT_SECTION_TITLES)[number];

interface SupportSection {
  title: SupportSectionTitle;
  content: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  input,
  chatLoading,
  onInputChange,
  onSubmit,
  solutions = [],
  onSolutionClick = () => {},
  onClearChat,
  onResend,
  onEdit,
  onDelete,
}) => {
  const { t, i18n } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [expandedCitations, setExpandedCitations] = useState<Set<number>>(new Set());
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);
  const [mermaidCharts, setMermaidCharts] = useState<Map<string, string>>(new Map());
  void onEdit;

  useEffect(() => {
    const renderMermaidCharts = async () => {
      const nextCharts = new Map(mermaidCharts);

      for (const message of messages) {
        if (message.role !== 'assistant') {
          continue;
        }

        const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
        let match;

        while ((match = mermaidRegex.exec(message.content)) !== null) {
          const code = match[1].trim();
          if (nextCharts.has(code)) {
            continue;
          }

          try {
            const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            const { svg } = await mermaid.render(id, code);
            nextCharts.set(code, svg);
          } catch (error) {
            console.error('Mermaid render error:', error);
            nextCharts.set(code, `<div class="p-4 text-red-500">${t('chat.mermaid_error')}</div>`);
          }
        }
      }

      setMermaidCharts(nextCharts);
    };

    void renderMermaidCharts();
  }, [messages, t]);

  const toggleCitations = (index: number) => {
    setExpandedCitations((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showSuccess(t('chat.copy_success'));
    } catch {
      showError(t('chat.copy_failed'));
    }
  };

  const handleCopyCode = async (code: string, key: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeKey(key);
      showSuccess(t('chat.copy_success'));
      window.setTimeout(() => setCopiedCodeKey(null), 2000);
    } catch {
      showError(t('chat.copy_failed'));
    }
  };

  const markdownComponents: any = {
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-2 text-sm leading-7 last:mb-0">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="my-2 list-disc space-y-1 pl-5 text-sm">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="my-2 list-decimal space-y-1 pl-5 text-sm">{children}</ol>
    ),
    img: ({ src, alt }: { src?: string; alt?: string }) => (
      <img src={src} alt={alt || ''} className="my-3 max-w-full rounded-xl" loading="lazy" />
    ),
    code: ({ inline, className, children }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeString = String(children).replace(/\n$/, '');
      const codeKey = `${language}-${codeString.slice(0, 24)}`;

      if (language === 'mermaid') {
        return (
          <div className="my-4 overflow-hidden rounded-2xl border border-stone-200/80 bg-white dark:border-[#35302b] dark:bg-[#1f1c19]">
            <div className="flex items-center justify-between border-b border-stone-200/80 bg-[#faf7f2] px-4 py-2 dark:border-[#35302b] dark:bg-[#25211d]">
              <div className="flex items-center gap-2 text-xs font-medium text-stone-500 dark:text-stone-300">
                <Workflow size={14} />
                Mermaid
              </div>
            </div>
            <div
              className="flex items-center justify-center p-4"
              dangerouslySetInnerHTML={{ __html: mermaidCharts.get(codeString) || 'Loading...' }}
            />
          </div>
        );
      }

      if (!match && inline) {
        return (
          <code className="rounded bg-[var(--app-accent-soft)] px-1.5 py-0.5 text-xs text-[var(--app-accent)]">
            {children}
          </code>
        );
      }

      return (
        <div className="my-3 overflow-hidden rounded-2xl border border-stone-200/80 bg-neutral-950 dark:border-[#35302b]">
          <div className="flex items-center justify-between border-b border-neutral-700 bg-neutral-900 px-4 py-2">
            <span className="text-xs uppercase tracking-[0.18em] text-neutral-400">
              {language || 'text'}
            </span>
            <button
              onClick={() => void handleCopyCode(codeString, codeKey)}
              className="flex items-center gap-1 text-xs text-neutral-300 transition hover:text-white"
            >
              {copiedCodeKey === codeKey ? <Check size={12} /> : <Copy size={12} />}
              {t('chat.copy')}
            </button>
          </div>
          <SyntaxHighlighter
            style={oneDark}
            language={language}
            PreTag="div"
            customStyle={{ margin: 0, background: '#0a0a0a' }}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    },
  };

  const formatTime = (value?: string) => {
    const date = value ? new Date(value) : new Date();
    return date.toLocaleTimeString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCitationLabel = (citation: EnhancedCitation) =>
    citation.solutionTitle || citation.sourceName || citation.fileName || citation.source || '当前知识片段';

  const getCitationExcerpt = (citation: EnhancedCitation) =>
    citation.q || citation.a || citation.source || '';

  const parseSupportSections = (content: string): SupportSection[] | null => {
    const headingRegex = /^##\s*(建议回复|处理步骤|核验要点|升级建议|引用依据)\s*$/gm;
    const matches = [...content.matchAll(headingRegex)];

    if (matches.length < 2) {
      return null;
    }

    const sections = matches.map((match, index) => {
      const title = match[1] as SupportSectionTitle;
      const start = (match.index ?? 0) + match[0].length;
      const end = index + 1 < matches.length ? matches[index + 1].index ?? content.length : content.length;
      return {
        title,
        content: content.slice(start, end).trim(),
      };
    });

    return sections.every((section) => SUPPORT_SECTION_TITLES.includes(section.title)) ? sections : null;
  };

  const getSupportSectionStyle = (title: SupportSectionTitle) => {
    switch (title) {
      case '建议回复':
        return 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-500/10';
      case '处理步骤':
        return 'border-sky-200 bg-sky-50/80 dark:border-sky-900/50 dark:bg-sky-500/10';
      case '核验要点':
        return 'border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-500/10';
      case '升级建议':
        return 'border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-500/10';
      case '引用依据':
        return 'border-violet-200 bg-violet-50/80 dark:border-violet-900/50 dark:bg-violet-500/10';
      default:
        return 'border-stone-200 bg-[#faf7f2] dark:border-[#35302b] dark:bg-[#241f1b]';
    }
  };

  return (
    <div className="overflow-hidden rounded-[34px] border border-stone-200/80 bg-white/88 shadow-[0_24px_60px_rgba(50,35,23,0.06)] backdrop-blur dark:border-[#2f2b28] dark:bg-[#1b1917]/90">
      <div className="border-b border-stone-200/80 px-5 py-5 dark:border-[#2f2b28]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
              <Bot size={22} />
            </div>
            <div>
              <h2 className="font-serif text-[1.55rem] font-semibold text-stone-950 dark:text-stone-50">
                {t('chat.title')}
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-300">{t('chat.subtitle')}</p>
            </div>
          </div>

          {messages.length > 0 && onClearChat && (
            <button
              onClick={onClearChat}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/80 px-4 py-2 text-sm text-stone-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-[#35302b] dark:bg-[#201d1a] dark:text-stone-300 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            >
              <Trash2 size={16} />
              {t('chat.clear')}
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[720px] overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-4xl space-y-5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-stone-200/80 bg-[#faf7f2] px-6 py-16 text-center dark:border-[#35302b] dark:bg-[#201d1a]">
              <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-white/85 text-[var(--app-accent)] dark:bg-[#27231f]">
                <Bot size={34} />
              </div>
              <h3 className="mt-5 font-serif text-[1.55rem] font-semibold text-stone-900 dark:text-stone-100">
                {t('chat.title')}
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-7 text-stone-500 dark:text-stone-300">
                {t('chat.empty_state')}
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex max-w-[92%] gap-3 ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] ${
                      message.role === 'user'
                        ? 'bg-[#f3e5d0] text-stone-800 dark:bg-[#2a231d] dark:text-stone-100'
                        : 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                    }`}
                  >
                    {message.role === 'user' ? <User size={17} /> : <Bot size={17} />}
                  </div>

                  <div className="min-w-0">
                    <div
                      className={`rounded-[26px] border px-5 py-4 shadow-[0_10px_28px_rgba(50,35,23,0.04)] ${
                        message.role === 'user'
                          ? 'rounded-tr-lg border-[#ddc6a4] bg-[#f8eee1] text-stone-900 dark:border-[#5a4837] dark:bg-[#241f1b] dark:text-stone-100'
                          : 'rounded-tl-lg border-stone-200/80 bg-[#fcfaf6] text-stone-800 dark:border-[#35302b] dark:bg-[#201d1a] dark:text-stone-100'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        (() => {
                          const sections = parseSupportSections(message.content);

                          if (!sections || sections.length === 0) {
                            return (
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                {message.content || t('chat.thinking')}
                              </ReactMarkdown>
                            );
                          }

                          return (
                            <div className="grid gap-3">
                              {sections.map((section) => (
                                <section
                                  key={section.title}
                                  className={`rounded-2xl border p-4 ${getSupportSectionStyle(section.title)}`}
                                >
                                  <h4 className="mb-2 text-sm font-semibold tracking-wide text-stone-900 dark:text-stone-100">
                                    {section.title}
                                  </h4>
                                  <div className="text-sm text-stone-700 dark:text-stone-200">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                      {section.content || '-'}
                                    </ReactMarkdown>
                                  </div>
                                </section>
                              ))}
                            </div>
                          );
                        })()
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                      )}

                      <div
                        className={`mt-3 text-xs ${
                          message.role === 'user' ? 'text-stone-500 dark:text-stone-400' : 'text-stone-400'
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void handleCopy(message.content)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-stone-500 transition hover:bg-white hover:text-stone-800 dark:text-stone-400 dark:hover:bg-[#26221e] dark:hover:text-stone-100"
                      >
                        <Copy size={12} />
                        {t('chat.copy')}
                      </button>

                      {message.role === 'user' && onResend && (
                        <button
                          onClick={() => onResend(message)}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-stone-500 transition hover:bg-white hover:text-stone-800 dark:text-stone-400 dark:hover:bg-[#26221e] dark:hover:text-stone-100"
                        >
                          <RotateCcw size={12} />
                          {t('chat.resend')}
                        </button>
                      )}

                      {message.role === 'user' && onDelete && (
                        <button
                          onClick={() => onDelete(index)}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-stone-500 transition hover:bg-red-50 hover:text-red-600 dark:text-stone-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                        >
                          <Trash2 size={12} />
                          {t('chat.delete')}
                        </button>
                      )}
                    </div>

                    {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleCitations(index)}
                          className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/80 px-3 py-1.5 text-xs text-stone-600 transition hover:border-stone-300 hover:text-stone-900 dark:border-[#35302b] dark:bg-[#201d1a] dark:text-stone-300 dark:hover:text-stone-100"
                        >
                          <FileText size={12} />
                          {t('chat.sources')} ({message.citations.length})
                          {expandedCitations.has(index) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        {expandedCitations.has(index) && (
                          <div className="mt-3 space-y-2">
                            {message.citations.map((citation, citationIndex) => (
                              <div
                                key={citation.id || `${index}-${citationIndex}`}
                                className="rounded-[22px] border border-stone-200/80 bg-white/85 p-4 dark:border-[#35302b] dark:bg-[#201d1a]"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-xs font-semibold text-[var(--app-accent)]">
                                    {citationIndex + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                      <span className="rounded-full bg-[var(--app-accent-soft)] px-2 py-1 font-medium text-[var(--app-accent)]">
                                        {getCitationLabel(citation)}
                                      </span>
                                      {typeof citation.chunkIndex === 'number' && (
                                        <span className="text-stone-400">片段 #{citation.chunkIndex + 1}</span>
                                      )}
                                      {typeof citation.score === 'number' && (
                                        <span className="text-stone-400">命中 {Math.round(citation.score * 100)}%</span>
                                      )}
                                    </div>
                                    <div className="text-sm leading-7 text-stone-700 dark:text-stone-300">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                        {getCitationExcerpt(citation)}
                                      </ReactMarkdown>
                                    </div>
                                    {citation.a && citation.a !== citation.q && (
                                      <p className="mt-2 line-clamp-3 text-xs leading-6 text-stone-500 dark:text-stone-400">
                                        {citation.a}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {message.role === 'assistant' && message.relatedSolutions && message.relatedSolutions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.relatedSolutions.map((solutionId) => {
                          const solution = solutions.find((item) => item.id === solutionId);
                          if (!solution) {
                            return null;
                          }

                          return (
                            <button
                              key={solutionId}
                              onClick={() => onSolutionClick(solutionId)}
                              className="rounded-full border border-stone-200/80 bg-white/80 px-3 py-2 text-xs font-medium text-stone-700 transition hover:border-stone-300 hover:bg-white dark:border-[#35302b] dark:bg-[#201d1a] dark:text-stone-300 dark:hover:text-stone-100"
                            >
                              {solution.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border-t border-stone-200/80 bg-[#f7f3ee] px-5 py-4 dark:border-[#2f2b28] dark:bg-[#171513]">
        <div className="mx-auto max-w-4xl">
          <form onSubmit={onSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              className="w-full rounded-full border border-stone-200/80 bg-white px-5 py-3.5 pr-16 text-sm text-stone-800 outline-none transition focus:border-stone-300 dark:border-[#35302b] dark:bg-[#201d1a] dark:text-stone-100 dark:focus:border-[#4a433c]"
              placeholder={t('chat.placeholder')}
              disabled={chatLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || chatLoading}
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-stone-950 text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white dark:disabled:bg-stone-700"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
