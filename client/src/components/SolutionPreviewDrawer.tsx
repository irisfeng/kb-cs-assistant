import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, FileText, X } from 'lucide-react';
import type { Solution } from '../types/solution';

interface SolutionPreviewDrawerProps {
  solution: Solution | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDetail: (id: string) => void;
}

const formatDate = (value?: string) => {
  if (!value) {
    return '--';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '--';
  }

  return parsed.toISOString().slice(0, 10);
};

const getFileExtension = (fileName: string) => {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toUpperCase() ?? 'FILE' : 'FILE';
};

export const SolutionPreviewDrawer: React.FC<SolutionPreviewDrawerProps> = ({
  solution,
  isOpen,
  onClose,
  onOpenDetail,
}) => {
  const { i18n } = useTranslation();
  const isChinese = i18n.language === 'zh';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onEsc);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !solution) {
    return null;
  }

  const summary = solution.description?.trim() || solution.fileName;
  const extension = getFileExtension(solution.fileName);

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label={isChinese ? '关闭预览' : 'Close preview'}
      />

      <aside className="absolute right-0 top-0 h-full w-full max-w-[440px] border-l border-stone-200/80 bg-[var(--app-surface)] p-5 shadow-[0_30px_70px_rgba(0,0,0,0.18)] dark:border-[#3a342e] dark:bg-[#241f1b] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--app-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--app-accent)]">
            <FileText size={14} />
            {isChinese ? '文档预览' : 'Document preview'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-[#2c2722] dark:hover:text-stone-100"
            aria-label={isChinese ? '关闭' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>

        <h3 className="mt-4 font-serif text-[1.5rem] font-semibold leading-tight text-stone-950 dark:text-stone-50">
          {solution.title}
        </h3>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-stone-200/80 bg-[#faf7f2] px-3 py-3 dark:border-[#3a342e] dark:bg-[#2a2521]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
              {isChinese ? '类型' : 'Type'}
            </p>
            <p className="mt-1 text-sm font-medium">{extension}</p>
          </div>
          <div className="rounded-2xl border border-stone-200/80 bg-[#faf7f2] px-3 py-3 dark:border-[#3a342e] dark:bg-[#2a2521]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
              {isChinese ? '创建时间' : 'Created'}
            </p>
            <p className="mt-1 text-sm font-medium">{formatDate(solution.createdAt)}</p>
          </div>
          <div className="rounded-2xl border border-stone-200/80 bg-[#faf7f2] px-3 py-3 dark:border-[#3a342e] dark:bg-[#2a2521]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
              {isChinese ? '产品线' : 'Product line'}
            </p>
            <p className="mt-1 text-sm font-medium">
              {solution.productLine && solution.productLine !== 'GENERAL'
                ? solution.productLine
                : '--'}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200/80 bg-[#faf7f2] px-3 py-3 dark:border-[#3a342e] dark:bg-[#2a2521]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
              {isChinese ? '版本' : 'Version'}
            </p>
            <p className="mt-1 text-sm font-medium">{solution.version || '--'}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-stone-200/80 bg-[#faf7f2] px-4 py-4 dark:border-[#3a342e] dark:bg-[#2a2521]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
            {isChinese ? '文件名' : 'File name'}
          </p>
          <p className="mt-2 break-all text-sm text-stone-700 dark:text-stone-200">
            {solution.fileName}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-stone-200/80 bg-[#faf7f2] px-4 py-4 dark:border-[#3a342e] dark:bg-[#2a2521]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
            {isChinese ? '摘要' : 'Summary'}
          </p>
          <p className="mt-2 text-sm leading-7 text-stone-700 dark:text-stone-200">{summary}</p>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => onOpenDetail(solution.id)}
            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white"
          >
            <ArrowUpRight size={15} />
            {isChinese ? '打开完整详情' : 'Open full detail'}
          </button>
        </div>
      </aside>
    </div>
  );
};
