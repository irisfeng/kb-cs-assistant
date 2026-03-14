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

const STATUS_STYLES: Record<KnowledgeSubmission['status'], { label: string; className: string }> = {
  PENDING_REVIEW: {
    label: '待审核',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-300',
  },
  APPROVED: {
    label: '待发布',
    className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-500/10 dark:text-sky-300',
  },
  REJECTED: {
    label: '已驳回',
    className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-500/10 dark:text-rose-300',
  },
  BLOCKED: {
    label: '需处理',
    className: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-500/10 dark:text-orange-300',
  },
  PUBLISHED: {
    label: '已发布',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
};

const ACTION_STYLES: Record<string, { label: string; className: string }> = {
  IMPORT: {
    label: '可直接发布',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  IMPORT_INTERNAL_ONLY: {
    label: '仅内部发布',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  },
  EXTRACT_THEN_IMPORT: {
    label: '需先抽取',
    className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  },
  SPLIT_OR_REDACT: {
    label: '需脱敏拆分',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
  },
  REVIEW_SOURCE_FILE: {
    label: '源文件异常',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
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
    className: 'bg-stone-100 text-stone-600 dark:bg-[#312b27] dark:text-stone-300',
  };
  const showReviewActions = submission.status === 'PENDING_REVIEW';
  const showPublishAction = submission.status === 'APPROVED';
  const isInternal = submission.audienceScope === 'INTERNAL_SUPPORT';

  return (
    <div className="rounded-[24px] border border-stone-200/80 bg-white/85 p-4 shadow-[0_10px_30px_rgba(50,35,23,0.04)] dark:border-[#4a423b] dark:bg-[#2a2521]">
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
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-500/12 dark:text-slate-300">
                <ShieldAlert size={12} />
                内部支持
              </span>
            )}
          </div>

          <h3 className="mt-3 line-clamp-2 font-serif text-[1.2rem] font-semibold text-stone-950 dark:text-stone-100">
            {submission.title}
          </h3>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{submission.fileName}</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
          <FileStack size={14} />
          <span>{submission.submittedByRole === 'team_lead' ? '组长提报' : '客服提报'}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-stone-600 dark:text-stone-300 sm:grid-cols-2">
        <div className="rounded-[18px] bg-[#faf7f2] px-3 py-2 dark:bg-[#312b27]">
          <span className="text-stone-400">产品</span>
          <p className="mt-1 font-medium text-stone-700 dark:text-stone-100">
            {submission.productName || '待识别'}
          </p>
        </div>
        <div className="rounded-[18px] bg-[#faf7f2] px-3 py-2 dark:bg-[#312b27]">
          <span className="text-stone-400">版本 / 日期</span>
          <p className="mt-1 font-medium text-stone-700 dark:text-stone-100">
            {[submission.version || '未识别', submission.effectiveDate || '未识别'].join(' / ')}
          </p>
        </div>
      </div>

      {submission.reviewNote && (
        <div className="mt-3 rounded-[18px] border border-stone-200/80 bg-[#faf7f2] px-3 py-2 text-xs leading-6 text-stone-600 dark:border-[#4a423b] dark:bg-[#312b27] dark:text-stone-300">
          {submission.reviewNote}
        </div>
      )}

      {submission.extractError && (
        <div className="mt-3 flex items-start gap-2 rounded-[18px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700 dark:border-rose-900/50 dark:bg-rose-500/10 dark:text-rose-300">
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
              className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white"
            >
              <Check size={14} />
              审核通过
            </button>
            <button
              onClick={() => onReject(submission.id)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/80 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-[#faf7f2] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#4a423b] dark:bg-[#2a2521] dark:text-stone-300 dark:hover:bg-[#312b27]"
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
            className="inline-flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-3 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadCloud size={14} />
            发布入库
          </button>
        )}

        {submission.status === 'PUBLISHED' && submission.publishedSolutionId && onOpenPublishedAsset && (
          <button
            onClick={() => onOpenPublishedAsset(submission.publishedSolutionId)}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/80 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-[#faf7f2] dark:border-[#4a423b] dark:bg-[#2a2521] dark:text-stone-300 dark:hover:bg-[#312b27]"
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
