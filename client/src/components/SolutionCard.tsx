import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, FileText, Trash2 } from 'lucide-react';

interface Solution {
  id: string;
  title: string;
  description: string;
  collectionId: string;
  fileName: string;
  createdAt?: string;
  productLine?: string;
  version?: string;
  securityLevel?: string;
}

interface SolutionCardProps {
  solution: Solution;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  numeral?: string;
  index?: number;
  viewMode?: 'grid' | 'list';
  isSelected?: boolean;
  density?: 'compact' | 'comfortable';
}

const getArchiveLabel = (index: number) => {
  const labels = ['DOC', 'FAQ', 'SOP', 'KB', 'OPS', 'NOTE'];
  return `${labels[index % labels.length]}-${String(index + 1).padStart(4, '0')}`;
};

const getFileExtension = (fileName: string) => {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toUpperCase() ?? 'FILE' : 'FILE';
};

const formatCreatedAt = (createdAt?: string) => {
  if (!createdAt) {
    return 'Recently';
  }

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return 'Recently';
  }

  return parsed.toISOString().slice(0, 10);
};

const getSummary = (solution: Solution) => {
  const summary = solution.description?.trim();
  if (summary && summary !== solution.fileName) {
    return summary;
  }

  return solution.fileName;
};

const getCompactTags = (solution: Solution) => {
  const tags: string[] = [];

  if (solution.productLine && solution.productLine !== 'GENERAL') {
    tags.push(solution.productLine);
  }
  if (solution.version) {
    tags.push(solution.version);
  }
  if (solution.securityLevel && solution.securityLevel !== 'PUBLIC_CS') {
    tags.push(solution.securityLevel);
  }

  if (tags.length === 0) {
    tags.push(getFileExtension(solution.fileName));
  }

  return tags.slice(0, 2);
};

export const SolutionCard: React.FC<SolutionCardProps> = ({
  solution,
  onDelete,
  onClick,
  onOpenDetail,
  numeral = 'I',
  index = 0,
  viewMode = 'grid',
  isSelected = false,
  density = 'comfortable',
}) => {
  const { t, i18n } = useTranslation();
  const archiveLabel = getArchiveLabel(index);
  const extensionLabel = getFileExtension(solution.fileName);
  const summary = getSummary(solution);
  const compactTags = getCompactTags(solution);
  const visibleTags = density === 'compact' ? compactTags.slice(0, 1) : compactTags;
  const showSummary = density === 'comfortable';
  const createdAtLabel = formatCreatedAt(solution.createdAt);
  const processedLabel = i18n.language === 'zh' ? '已发布' : 'Published';

  const handleClick = () => {
    onClick?.(solution.id);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm(t('solutions.card.delete_confirm'))) {
      onDelete?.(solution.id);
    }
  };

  const handleOpenDetail = (event: React.MouseEvent) => {
    event.stopPropagation();
    onOpenDetail?.(solution.id);
  };

  if (viewMode === 'list') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`group w-full border text-left transition ${
          isSelected
            ? 'border-[var(--app-accent)]/55 bg-white shadow-[0_12px_30px_rgba(50,35,23,0.08)] dark:bg-[#26211d]'
            : 'border-stone-200/80 bg-[#fcfaf6] shadow-[0_8px_24px_rgba(50,35,23,0.04)] hover:border-stone-300 hover:bg-white dark:border-[#35302b] dark:bg-[#1f1c19] dark:hover:border-[#4a433c]'
        } ${density === 'compact' ? 'rounded-[16px] px-3 py-2.5' : 'rounded-[18px] px-3 py-3'}`}
        title={solution.title}
      >
        <div
          className={`grid ${
            density === 'compact' ? 'gap-2 md:gap-2.5' : 'gap-2.5 md:gap-3'
          } md:grid-cols-[88px_minmax(0,1.8fr)_minmax(0,1.1fr)_96px_84px_auto] md:items-center`}
        >
          <div className="hidden md:block">
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--app-accent)]">
              {archiveLabel}
            </p>
          </div>

          <div className="min-w-0">
            <p
              className={`line-clamp-1 font-serif font-semibold leading-[1.2] text-stone-900 dark:text-stone-100 ${
                density === 'compact' ? 'text-[0.95rem]' : 'text-[1rem]'
              }`}
            >
              {solution.title}
            </p>
            {showSummary && (
              <p className="mt-1 line-clamp-1 text-xs text-stone-500 dark:text-stone-400">
                {summary}
              </p>
            )}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-stone-200/75 bg-white/85 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-stone-500 dark:border-[#3a342e] dark:bg-[#27221e] dark:text-stone-300"
              >
                {tag}
              </span>
            ))}
            <span
              className={`rounded-full bg-[var(--app-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--app-accent)] ${
                density === 'compact' ? 'hidden sm:inline-flex' : ''
              }`}
            >
              {processedLabel}
            </span>
          </div>

          <p className="hidden text-xs text-stone-500 dark:text-stone-400 md:block">
            {createdAtLabel}
          </p>

          <p className="hidden text-xs uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500 md:block">
            {extensionLabel}
          </p>

          <div className="flex items-center justify-end gap-1">
            {onOpenDetail && (
              <button
                type="button"
                onClick={handleOpenDetail}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-[var(--app-accent)] dark:hover:bg-[#2d2823]"
                title={i18n.language === 'zh' ? '打开详情页' : 'Open detail'}
              >
                <ArrowUpRight size={15} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                title={t('solutions.card.delete')}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative w-full overflow-hidden rounded-[20px] border p-4 text-left transition ${
        isSelected
          ? 'border-[var(--app-accent)]/55 bg-white shadow-[0_14px_30px_rgba(50,35,23,0.09)] dark:bg-[#26211d]'
          : 'border-stone-200/80 bg-[#fcfaf6] shadow-[0_10px_24px_rgba(50,35,23,0.04)] hover:-translate-y-0.5 hover:border-stone-300 hover:bg-white dark:border-[#35302b] dark:bg-[#1f1c19] dark:hover:border-[#4a433c]'
      }`}
      title={solution.title}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--app-accent)] dark:border-[#35302b] dark:bg-[#241f1b]">
          <FileText size={11} />
          {archiveLabel}
        </div>
        <p className="text-xs uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
          {extensionLabel}
        </p>
      </div>

      <h3 className="mt-3 line-clamp-2 font-serif text-[1.08rem] font-semibold leading-[1.26] text-stone-900 dark:text-stone-100">
        {solution.title}
      </h3>

      <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
        {summary}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {compactTags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-stone-200/75 bg-white/85 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-stone-500 dark:border-[#3a342e] dark:bg-[#27221e] dark:text-stone-300"
          >
            {tag}
          </span>
        ))}
        <span className="rounded-full bg-[var(--app-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--app-accent)]">
          {processedLabel}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-stone-200/70 pt-3 dark:border-[#35302b]">
        <span className="text-xs text-stone-500 dark:text-stone-400">{createdAtLabel}</span>
        <div className="flex items-center gap-1">
          {onOpenDetail && (
            <button
              type="button"
              onClick={handleOpenDetail}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-[var(--app-accent)] dark:hover:bg-[#2d2823]"
              title={i18n.language === 'zh' ? '打开详情页' : 'Open detail'}
            >
              <ArrowUpRight size={14} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
              title={t('solutions.card.delete')}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <span className="pointer-events-none absolute right-4 top-4 hidden font-serif text-2xl text-stone-200 dark:text-stone-700 lg:block">
        {numeral}
      </span>
    </button>
  );
};
