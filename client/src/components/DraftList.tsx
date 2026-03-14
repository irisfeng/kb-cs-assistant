import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Calendar,
  Clock,
  Edit3,
  FileText,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { DraftSolution } from '../types/solution';
import { useToast } from '../contexts/ToastContext';

interface DraftListProps {
  onSelectDraft: (draft: DraftSolution) => void;
  onNewDraft: () => void;
}

export const DraftList: React.FC<DraftListProps> = ({ onSelectDraft, onNewDraft }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState<DraftSolution[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDrafts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/drafts');
      if (!response.ok) {
        throw new Error('Failed to load drafts');
      }

      const data: DraftSolution[] = await response.json();
      setDrafts(
        data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      );
    } catch (error) {
      console.error('Load drafts error:', error);
      showToast(t('drafts.delete_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDrafts();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(t('drafts.delete_confirm', { title }))) {
      return;
    }

    try {
      const response = await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to delete draft');
      }

      showToast(t('drafts.delete_success'), 'success');
      await loadDrafts();
    } catch (error) {
      console.error('Delete draft error:', error);
      showToast(t('drafts.delete_failed'), 'error');
    }
  };

  const stats = useMemo(() => {
    const draftItems = drafts.filter((item) => item.status === 'draft' || item.status === 'outline');
    const generatingItems = drafts.filter((item) => item.status === 'generating');
    const completedItems = drafts.filter(
      (item) => item.status === 'completed' || item.status === 'published',
    );

    return {
      draftCount: draftItems.length,
      generatingCount: generatingItems.length,
      completedCount: completedItems.length,
    };
  }, [drafts]);

  const formatDate = (value: string) => {
    const date = new Date(value);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const getStatusLabel = (status: DraftSolution['status']) => {
    if (status === 'draft' || status === 'outline') {
      return t('drafts.status.draft');
    }
    if (status === 'generating') {
      return t('drafts.status.generating');
    }
    return t('drafts.status.completed');
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl shadow-amber-500/20">
            <Sparkles size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              {t('drafts.title')}
            </h1>
            <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-dark-textSecondary">
              {t('drafts.subtitle')}
            </p>
          </div>
        </div>

        <button
          onClick={onNewDraft}
          className="inline-flex items-center gap-2 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-amber-500 dark:text-neutral-950 dark:hover:bg-amber-400"
        >
          <Plus size={18} />
          {t('drafts.new')}
        </button>
      </div>

      {!loading && drafts.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">
              {t('drafts.status.draft')}
            </p>
            <p className="mt-3 text-3xl font-semibold">{stats.draftCount}</p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">
              {t('drafts.status.generating')}
            </p>
            <p className="mt-3 text-3xl font-semibold">{stats.generatingCount}</p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">
              {t('drafts.status.completed')}
            </p>
            <p className="mt-3 text-3xl font-semibold">{stats.completedCount}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 h-16 w-16 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600 dark:border-amber-900/40 dark:border-t-amber-500" />
          <p className="text-sm text-neutral-500 dark:text-dark-textSecondary">{t('drafts.loading')}</p>
        </div>
      ) : drafts.length === 0 ? (
        <div className="rounded-[32px] border-2 border-dashed border-neutral-200 bg-white px-6 py-20 text-center dark:border-dark-border dark:bg-dark-card">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <Sparkles size={36} />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-neutral-950 dark:text-white">
            {t('drafts.empty_title')}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-500 dark:text-dark-textSecondary">
            {t('drafts.empty_hint')}
          </p>
          <button
            onClick={onNewDraft}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-amber-500 dark:text-neutral-950 dark:hover:bg-amber-400"
          >
            <Plus size={18} />
            {t('drafts.new')}
          </button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {drafts.map((draft) => (
            <article
              key={draft.id}
              className="group cursor-pointer overflow-hidden rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg dark:border-dark-border dark:bg-dark-card"
              onClick={() => onSelectDraft(draft)}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                  <FileText size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 text-lg font-semibold text-neutral-950 dark:text-white">
                      {draft.title}
                    </h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        draft.status === 'draft' || draft.status === 'outline'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                          : draft.status === 'generating'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                      }`}
                    >
                      {getStatusLabel(draft.status)}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-500 dark:text-dark-textSecondary">
                    {draft.requirements}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                    <div className="inline-flex items-center gap-1.5">
                      <Clock size={12} />
                      {formatDate(draft.updatedAt)}
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <Calendar size={12} />
                      v{draft.version}
                    </div>
                    {draft.industry && (
                      <div className="inline-flex items-center gap-1.5">
                        <Building2 size={12} />
                        {draft.industry}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 border-t border-neutral-100 pt-4 dark:border-dark-border">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectDraft(draft);
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-amber-500 dark:text-neutral-950 dark:hover:bg-amber-400"
                >
                  <Edit3 size={14} />
                  Edit
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDelete(draft.id, draft.title);
                  }}
                  className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:border-red-200 hover:text-red-600 dark:border-dark-border dark:text-dark-textSecondary dark:hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
