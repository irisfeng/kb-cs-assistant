import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  FileStack,
  ShieldAlert,
  UploadCloud,
  X,
} from 'lucide-react';
import type { KnowledgeSubmission } from '../types/solution';

interface KnowledgeSubmissionCardProps {
  submission: KnowledgeSubmission;
  busy?: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPublish: (id: string) => void;
  onOpenPublishedAsset?: (id: string) => void;
}

const STATUS_STYLES: Record<
  KnowledgeSubmission['status'],
  { label: string; className: string }
> = {
  PENDING_REVIEW: {
    label: '待审核',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  APPROVED: {
    label: '待发布',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  REJECTED: {
    label: '已驳回',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  BLOCKED: {
    label: '需处理',
    className: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  PUBLISHED: {
    label: '已发布',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
};

const ACTION_STYLES: Record<string, { label: string; className: string }> = {
  IMPORT: {
    label: '可直接发布',
    className: 'bg-emerald-100 text-emerald-700',
  },
  IMPORT_INTERNAL_ONLY: {
    label: '仅内部发布',
    className: 'bg-sky-100 text-sky-700',
  },
  EXTRACT_THEN_IMPORT: {
    label: '需先抽取',
    className: 'bg-violet-100 text-violet-700',
  },
  SPLIT_OR_REDACT: {
    label: '需脱敏拆分',
    className: 'bg-orange-100 text-orange-700',
  },
  REVIEW_SOURCE_FILE: {
    label: '源文件异常',
    className: 'bg-rose-100 text-rose-700',
  },
};

export const KnowledgeSubmissionCard: React.FC<KnowledgeSubmissionCardProps> = ({
  submission,
  busy = false,
  onApprove,
  onReject,
  onPublish,
  onOpenPublishedAsset,
}) => {
  const statusMeta = STATUS_STYLES[submission.status];
  const actionMeta = ACTION_STYLES[submission.recommendedAction] || {
    label: submission.recommendedAction,
    className: 'bg-neutral-100 text-neutral-600',
  };
  const showReviewActions = submission.status === 'PENDING_REVIEW';
  const showPublishAction = submission.status === 'APPROVED';
  const isInternal = submission.audienceScope === 'INTERNAL_SUPPORT';

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-dark-border dark:bg-dark-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${actionMeta.className}`}>
              {actionMeta.label}
            </span>
            {isInternal && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                <ShieldAlert size={12} />
                内部支持
              </span>
            )}
          </div>

          <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-neutral-950 dark:text-white">
            {submission.title}
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-dark-textSecondary">
            {submission.fileName}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-dark-textSecondary">
          <FileStack size={14} />
          <span>{submission.submittedByRole === 'team_lead' ? '班长提报' : '客服提报'}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-neutral-600 dark:text-dark-textSecondary sm:grid-cols-2">
        <div className="rounded-2xl bg-stone-50 px-3 py-2 dark:bg-dark-bg">
          <span className="text-neutral-400">产品</span>
          <p className="mt-1 font-medium text-neutral-700 dark:text-dark-text">{submission.productName || '待识别'}</p>
        </div>
        <div className="rounded-2xl bg-stone-50 px-3 py-2 dark:bg-dark-bg">
          <span className="text-neutral-400">版本/日期</span>
          <p className="mt-1 font-medium text-neutral-700 dark:text-dark-text">
            {[submission.version || '未识别', submission.effectiveDate || '未识别'].join(' / ')}
          </p>
        </div>
      </div>

      {submission.reviewNote && (
        <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-600 dark:border-dark-border dark:bg-dark-bg dark:text-dark-textSecondary">
          {submission.reviewNote}
        </div>
      )}

      {submission.extractError && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{submission.extractError}</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {showReviewActions && (
          <>
            <button
              onClick={() => onApprove(submission.id)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-2xl bg-neutral-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
            >
              <Check size={14} />
              审核通过
            </button>
            <button
              onClick={() => onReject(submission.id)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-border dark:text-dark-textSecondary dark:hover:bg-dark-bg"
            >
              <X size={14} />
              驳回
            </button>
          </>
        )}

        {showPublishAction && (
          <button
            onClick={() => onPublish(submission.id)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-xs font-medium text-white transition hover:from-amber-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadCloud size={14} />
            发布入库
          </button>
        )}

        {submission.status === 'PUBLISHED' && submission.publishedSolutionId && onOpenPublishedAsset && (
          <button
            onClick={() => onOpenPublishedAsset(submission.publishedSolutionId)}
            className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-dark-border dark:text-dark-textSecondary dark:hover:bg-dark-bg"
          >
            <ArrowUpRight size={14} />
            查看已发布资产
          </button>
        )}
      </div>
    </div>
  );
};

export default KnowledgeSubmissionCard;
