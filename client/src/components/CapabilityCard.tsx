import React from 'react';
import { useTranslation } from 'react-i18next';
import { Edit, ListChecks, MessageSquareQuote, Trash2 } from 'lucide-react';
import type { ProductCapability } from '../types/capability';

interface CapabilityCardProps {
  capability: ProductCapability;
  onEdit: (capability: ProductCapability) => void;
  onDelete: (id: string) => void;
  viewMode?: 'grid' | 'list';
  index?: number;
}

const getItemLabel = (index: number) => `SOP-${String(index + 1).padStart(4, '0')}`;

export const CapabilityCard: React.FC<CapabilityCardProps> = ({
  capability,
  onEdit,
  onDelete,
  viewMode = 'grid',
  index = 0,
}) => {
  const { t } = useTranslation();

  const triggerCount = capability.useCases?.length || 0;
  const ruleCount = capability.features?.length || 0;

  if (viewMode === 'list') {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md dark:border-dark-border dark:bg-dark-card">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <MessageSquareQuote size={20} />
          </div>

          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.22em] text-neutral-400">
                {getItemLabel(index)}
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                {capability.category}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
              {capability.name}
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-dark-textSecondary">
              {capability.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-stone-50 px-4 py-3 text-center dark:bg-dark-bg">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">
                {t('capabilities.card.features')}
              </p>
              <p className="mt-1 text-xl font-semibold">{ruleCount}</p>
            </div>
            <div className="rounded-2xl bg-stone-50 px-4 py-3 text-center dark:bg-dark-bg">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">
                {t('capabilities.card.useCases')}
              </p>
              <p className="mt-1 text-xl font-semibold">{triggerCount}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(capability)}
                className="rounded-2xl border border-neutral-200 p-3 text-neutral-500 transition hover:border-amber-300 hover:text-amber-700 dark:border-dark-border dark:hover:text-amber-400"
                title={t('capabilities.form.edit')}
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => onDelete(capability.id)}
                className="rounded-2xl border border-neutral-200 p-3 text-neutral-500 transition hover:border-red-200 hover:text-red-600 dark:border-dark-border dark:hover:text-red-400"
                title={t('capabilities.form.delete')}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg dark:border-dark-border dark:bg-dark-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-neutral-400">
            {getItemLabel(index)}
          </span>
          <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-neutral-950 dark:text-white">
            {capability.name}
          </h3>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
          <MessageSquareQuote size={20} />
        </div>
      </div>

      <div className="mt-3">
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
          {capability.category}
        </span>
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-neutral-500 dark:text-dark-textSecondary">
        {capability.description}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-stone-50 px-4 py-3 dark:bg-dark-bg">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-neutral-400">
            <ListChecks size={12} />
            {t('capabilities.card.features')}
          </div>
          <p className="mt-2 text-2xl font-semibold">{ruleCount}</p>
        </div>
        <div className="rounded-2xl bg-stone-50 px-4 py-3 dark:bg-dark-bg">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-neutral-400">
            <MessageSquareQuote size={12} />
            {t('capabilities.card.useCases')}
          </div>
          <p className="mt-2 text-2xl font-semibold">{triggerCount}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-neutral-100 pt-4 dark:border-dark-border">
        <button
          onClick={() => onEdit(capability)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-amber-500 dark:text-neutral-950 dark:hover:bg-amber-400"
        >
          <Edit size={14} />
          {t('capabilities.form.edit')}
        </button>
        <button
          onClick={() => onDelete(capability.id)}
          className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:border-red-200 hover:text-red-600 dark:border-dark-border dark:text-dark-textSecondary dark:hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};
