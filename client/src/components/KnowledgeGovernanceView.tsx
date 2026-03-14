import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock3, FolderKanban, ShieldAlert, UploadCloud } from 'lucide-react';
import { KnowledgeSubmissionCard } from './KnowledgeSubmissionCard';
import type { KnowledgeSubmission } from '../types/solution';

interface KnowledgeGovernanceViewProps {
  submissions: KnowledgeSubmission[];
  busySubmissionId?: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPublish: (id: string) => void;
  onOpenPublishedAsset: (id: string) => void;
}

export const KnowledgeGovernanceView: React.FC<KnowledgeGovernanceViewProps> = ({
  submissions,
  busySubmissionId,
  onApprove,
  onReject,
  onPublish,
  onOpenPublishedAsset,
}) => {
  const { i18n } = useTranslation();
  const isChinese = i18n.language === 'zh';

  const orderedSubmissions = [...submissions].sort((left, right) => {
    return new Date(right.submittedAt || 0).getTime() - new Date(left.submittedAt || 0).getTime();
  });

  const activeQueue = orderedSubmissions.filter((submission) =>
    ['PENDING_REVIEW', 'APPROVED', 'BLOCKED'].includes(submission.status),
  );
  const historyQueue = orderedSubmissions.filter((submission) =>
    ['PUBLISHED', 'REJECTED'].includes(submission.status),
  );
  const pendingReviewCount = orderedSubmissions.filter(
    (submission) => submission.status === 'PENDING_REVIEW',
  ).length;
  const approvedCount = orderedSubmissions.filter(
    (submission) => submission.status === 'APPROVED',
  ).length;
  const blockedCount = orderedSubmissions.filter(
    (submission) => submission.status === 'BLOCKED',
  ).length;
  const publishedCount = orderedSubmissions.filter(
    (submission) => submission.status === 'PUBLISHED',
  ).length;

  const panelClass =
    'rounded-[32px] border border-stone-200/80 bg-white/88 shadow-[0_24px_60px_rgba(50,35,23,0.06)] backdrop-blur dark:border-[#4a423b] dark:bg-[#221e1b]/92';

  return (
    <div className="mx-auto max-w-7xl px-5 py-6 lg:px-10">
      <div className={`${panelClass} p-7 sm:p-8`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--app-accent)]">
              Knowledge governance
            </p>
            <h1 className="mt-4 font-serif text-[2.3rem] font-semibold leading-tight text-stone-950 dark:text-stone-50">
              {isChinese ? '知识提报与审核' : 'Knowledge submissions and review'}
            </h1>
            <p className="mt-3 text-sm leading-7 text-stone-500 dark:text-stone-300">
              {isChinese
                ? '这里承接资料提报、审核、发布与历史记录。首页不再堆完整队列，只保留轻量入口。'
                : 'This workspace handles submissions, review, publishing, and history. The home page now only keeps a lightweight entry.'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[24px] border border-stone-200/70 bg-[#faf7f2] px-4 py-4 dark:border-[#35302b] dark:bg-[#201d1a]">
              <div className="flex items-center gap-2 text-[var(--app-accent)]">
                <Clock3 size={16} />
                <span className="text-xs font-medium uppercase tracking-[0.22em]">
                  {isChinese ? '待审核' : 'Pending'}
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold">{pendingReviewCount}</p>
            </div>
            <div className="rounded-[24px] border border-stone-200/70 bg-[#faf7f2] px-4 py-4 dark:border-[#35302b] dark:bg-[#201d1a]">
              <div className="flex items-center gap-2 text-sky-600 dark:text-sky-300">
                <UploadCloud size={16} />
                <span className="text-xs font-medium uppercase tracking-[0.22em]">
                  {isChinese ? '待发布' : 'Approved'}
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold">{approvedCount}</p>
            </div>
            <div className="rounded-[24px] border border-stone-200/70 bg-[#faf7f2] px-4 py-4 dark:border-[#35302b] dark:bg-[#201d1a]">
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-300">
                <ShieldAlert size={16} />
                <span className="text-xs font-medium uppercase tracking-[0.22em]">
                  {isChinese ? '阻塞项' : 'Blocked'}
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold">{blockedCount}</p>
            </div>
            <div className="rounded-[24px] border border-stone-200/70 bg-[#faf7f2] px-4 py-4 dark:border-[#35302b] dark:bg-[#201d1a]">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 size={16} />
                <span className="text-xs font-medium uppercase tracking-[0.22em]">
                  {isChinese ? '已发布' : 'Published'}
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold">{publishedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <section className={`${panelClass} p-6`}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
              <FolderKanban size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
                Active queue
              </p>
              <h2 className="font-serif text-[1.55rem] font-semibold text-stone-950 dark:text-stone-50">
                {isChinese ? '待处理提报' : 'Active submissions'}
              </h2>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {activeQueue.length > 0 ? (
              activeQueue.map((submission) => (
                <KnowledgeSubmissionCard
                  key={submission.id}
                  submission={submission}
                  busy={busySubmissionId === submission.id}
                  onApprove={onApprove}
                  onReject={onReject}
                  onPublish={onPublish}
                  onOpenPublishedAsset={onOpenPublishedAsset}
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-stone-200/80 bg-[#faf7f2] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-[#35302b] dark:bg-[#201d1a] dark:text-stone-300">
                {isChinese ? '当前没有待处理提报。' : 'There are no active submissions right now.'}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className={`${panelClass} p-5`}>
            <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
              Review policy
            </p>
            <div className="mt-4 space-y-3">
              {[
                isChinese ? '待审核只保留给审核人处理，不再占用首页首屏。' : 'Pending review stays in the governance workspace, not on the home screen.',
                isChinese ? '待发布和阻塞项集中在这里跟进，避免和知识检索混杂。' : 'Approved and blocked items stay here so governance does not compete with retrieval.',
                isChinese ? '已发布与已驳回作为历史记录归档，便于回看。' : 'Published and rejected items remain visible as history for audits and follow-up.',
              ].map((item, index) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-[20px] border border-stone-200/70 bg-[#faf7f2] px-4 py-4 dark:border-[#35302b] dark:bg-[#201d1a]"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-xs font-semibold text-[var(--app-accent)]">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-7 text-stone-700 dark:text-stone-300">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={`${panelClass} p-5`}>
            <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
              History
            </p>
            <h3 className="mt-2 font-serif text-[1.35rem] font-semibold text-stone-950 dark:text-stone-50">
              {isChinese ? '最近归档' : 'Recent history'}
            </h3>
            <div className="mt-4 space-y-3">
              {historyQueue.length > 0 ? (
                historyQueue.slice(0, 6).map((submission) => (
                  <div
                    key={submission.id}
                    className="rounded-[20px] border border-stone-200/70 bg-[#faf7f2] px-4 py-4 dark:border-[#35302b] dark:bg-[#201d1a]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-medium text-stone-900 dark:text-stone-100">
                        {submission.title}
                      </p>
                      <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] text-stone-500 dark:bg-[#26221e] dark:text-stone-300">
                        {submission.status === 'PUBLISHED'
                          ? isChinese
                            ? '已发布'
                            : 'Published'
                          : isChinese
                            ? '已驳回'
                            : 'Rejected'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-stone-500 dark:text-stone-400">
                      {submission.fileName}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-stone-200/70 bg-[#faf7f2] px-4 py-6 text-sm leading-7 text-stone-500 dark:border-[#35302b] dark:bg-[#201d1a] dark:text-stone-300">
                  {isChinese ? '暂无历史记录。' : 'No history yet.'}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
