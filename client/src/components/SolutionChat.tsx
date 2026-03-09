import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, ChevronDown, ChevronUp, FileText, Send, Trash2, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from '../contexts/ToastContext';
import {
  clearChatHistory,
  getChatHistory,
  getOrCreateChatSessionId,
  resetChatSessionId,
  saveChatHistory,
} from '../utils/storage';
import type { ChatMessage, EnhancedCitation } from '../types/solution';

interface SolutionChatProps {
  solutionId: string;
  solutionTitle: string;
}

export const SolutionChat: React.FC<SolutionChatProps> = ({
  solutionId,
  solutionTitle,
}) => {
  const { t } = useTranslation();
  const { showError, showSuccess } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() =>
    getOrCreateChatSessionId('solution', solutionId),
  );
  const [expandedCitations, setExpandedCitations] = useState<Set<number>>(new Set());
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const citationRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const savedHistory = getChatHistory('solution', solutionId);
    setSessionId(getOrCreateChatSessionId('solution', solutionId));
    setMessages(savedHistory);
  }, [solutionId]);

  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory('solution', messages, solutionId, solutionTitle);
    }
  }, [messages, solutionId, solutionTitle]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (highlightedCitation === null) {
      return;
    }

    const citationElement = citationRefs.current[highlightedCitation];
    if (!citationElement) {
      return;
    }

    citationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => setHighlightedCitation(null), 2000);
    return () => window.clearTimeout(timer);
  }, [highlightedCitation]);

  const markdownComponents: Components = {
    p: ({ children }) => (
      <p className="mb-2 text-sm font-light leading-relaxed last:mb-0">{children}</p>
    ),
    img: ({ src, alt }) => (
      <img src={src} alt={alt || ''} className="my-2 h-auto max-w-full rounded-lg" loading="lazy" />
    ),
    ul: ({ children }) => (
      <ul className="my-2 list-inside list-disc text-sm">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-2 list-inside list-decimal text-sm">{children}</ol>
    ),
    code: (props) =>
      (props as { inline?: boolean }).inline ? (
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
          {props.children}
        </code>
      ) : (
        <code className="block overflow-x-auto rounded bg-neutral-100 p-2 text-xs dark:bg-neutral-800">
          {props.children}
        </code>
      ),
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  const getCitationLabel = (citation: EnhancedCitation) =>
    citation.sourceName || citation.fileName || citation.source || solutionTitle;

  const getCitationExcerpt = (citation: EnhancedCitation) =>
    citation.q || citation.a || citation.source || '引用内容';

  const handleClearChat = () => {
    if (!window.confirm(t('chat.clear_confirm') || '确认清空对话记录？此操作无法撤销。')) {
      return;
    }

    if (clearChatHistory('solution', solutionId)) {
      setMessages([]);
      setSessionId(resetChatSessionId('solution', solutionId));
      showSuccess(t('chat.clear_success') || '对话已清空');
      return;
    }

    showError(t('chat.clear_failed') || '清空失败，请稍后重试');
  };

  const toggleCitations = (messageIndex: number) => {
    setExpandedCitations((previous) => {
      const next = new Set(previous);
      if (next.has(messageIndex)) {
        next.delete(messageIndex);
      } else {
        next.add(messageIndex);
      }
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || loading) {
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: input }];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`/api/solutions/${solutionId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: nextMessages, sessionId }),
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
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.error) {
              setMessages([...nextMessages, { role: 'assistant', content: t('chat.error') }]);
              setLoading(false);
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

            if (parsed.citations || parsed.isComplete) {
              setMessages((previous) => {
                const updated = [...previous];
                const lastMessage = updated[updated.length - 1];
                if (lastMessage?.role === 'assistant') {
                  lastMessage.citations = parsed.citations || [];
                }
                return updated;
              });
            }
          } catch (parseError) {
            const message =
              parseError instanceof Error ? parseError.message : 'Unknown parse error';
            console.log('[SolutionChat] JSON parse error:', message);
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...nextMessages, { role: 'assistant', content: t('chat.error') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[600px] flex-col">
      <div className="mb-4 flex-1 space-y-4 overflow-y-auto pr-2">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-neutral-400 dark:text-neutral-600">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <Bot size={32} />
            </div>
            <p className="mb-2 text-lg text-neutral-500 dark:text-neutral-500">
              关于《{solutionTitle}》
            </p>
            <p className="text-sm">我可以回答与当前知识文档相关的问题。</p>
          </div>
        )}

        {messages.map((message, messageIndex) => (
          <div
            key={messageIndex}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`flex max-w-[85%] gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                  message.role === 'user'
                    ? 'bg-amber-600'
                    : 'border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="text-white" size={16} />
                ) : (
                  <Bot className="text-amber-600 dark:text-amber-500" size={16} />
                )}
              </div>

              <div
                className={`rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'rounded-br-none bg-amber-600 text-white'
                    : 'rounded-bl-none border border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
                }`}
              >
                <div className="text-sm font-light leading-relaxed">
                  {message.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  )}
                  {loading && message.role === 'assistant' && message.content === '' && (
                    <span className="ml-1 inline-block">
                      <span className="inline-block h-4 w-1 animate-pulse bg-amber-600"></span>
                    </span>
                  )}
                </div>

                <div
                  className={`mt-1 text-xs opacity-60 ${
                    message.role === 'user' ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                >
                  {message.timestamp ? formatTime(new Date(message.timestamp)) : formatTime(new Date())}
                </div>

                {message.role === 'assistant' &&
                  message.citations &&
                  message.citations.length > 0 && (
                    <div className="mt-3 border-t border-neutral-200 pt-2 dark:border-neutral-700">
                      <button
                        onClick={() => toggleCitations(messageIndex)}
                        className="flex items-center gap-2 text-xs text-neutral-500 transition-colors hover:text-amber-600 dark:text-neutral-400 dark:hover:text-amber-500"
                      >
                        <FileText size={14} />
                        <span>鍙傝€冩潵婧?({message.citations.length} 鏉?</span>
                        {expandedCitations.has(messageIndex) ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>

                      {expandedCitations.has(messageIndex) && (
                        <div className="mt-3 space-y-2">
                          {message.citations.map((citation, citationIndex) => (
                            <div
                              key={citationIndex}
                              ref={(element) => {
                                citationRefs.current[citationIndex] = element;
                              }}
                              className={`rounded-lg border bg-neutral-50 p-3 transition-all dark:bg-neutral-800/50 ${
                                highlightedCitation === citationIndex
                                  ? 'border-amber-500 ring-1 ring-amber-500 dark:border-amber-400 dark:ring-amber-400'
                                  : 'border-neutral-200 dark:border-neutral-700'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-amber-50 text-xs font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-500">
                                  {citationIndex + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-500">
                                      {getCitationLabel(citation)}
                                    </span>
                                    {typeof citation.chunkIndex === 'number' && (
                                      <span className="text-neutral-400">
                                        鐗囨 #{citation.chunkIndex + 1}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      components={markdownComponents}
                                    >
                                      {getCitationExcerpt(citation)}
                                    </ReactMarkdown>
                                  </div>
                                  {citation.a && citation.a !== citation.q && (
                                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                                      {citation.a}
                                    </p>
                                  )}
                                  {typeof citation.score === 'number' && (
                                    <p className="mt-1 text-xs text-neutral-400">
                                      鐩稿叧搴?{Math.round(citation.score * 100)}%
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
              </div>
            </div>
          </div>
        ))}

        {loading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === 'assistant' &&
          messages[messages.length - 1].content === '' && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                  <Bot className="text-amber-600 dark:text-amber-500" size={16} />
                </div>
                <div className="rounded-lg rounded-bl-none border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex gap-1">
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-amber-600"
                      style={{ animationDelay: '0ms' }}
                    ></div>
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-amber-600"
                      style={{ animationDelay: '150ms' }}
                    ></div>
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-amber-600"
                      style={{ animationDelay: '300ms' }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length > 0 && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={handleClearChat}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-500 transition-all hover:bg-red-50 hover:text-red-500 dark:text-neutral-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <Trash2 size={16} />
            <span>{t('chat.clear') || '娓呯┖瀵硅瘽'}</span>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 bg-white px-5 py-4 pr-14 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-transparent focus:ring-2 focus:ring-amber-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          placeholder={t('solutionDetail.chat.placeholder') || '璇疯緭鍏ユ偍鐨勯棶棰?..'}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="absolute right-2 top-2 rounded-lg bg-amber-600 p-2.5 text-white transition-all hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 dark:disabled:bg-neutral-800"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

