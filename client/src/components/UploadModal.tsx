import React, { useEffect, useRef } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Plus,
  Upload,
  X,
} from 'lucide-react';

type UploadStatus = 'idle' | 'queued' | 'processing' | 'success' | 'failed';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  submittedByRole: 'agent' | 'team_lead';
  file: File | null;
  uploading: boolean;
  uploadProgress: number;
  uploadStatus: UploadStatus;
  uploadStatusMessage: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmittedByRoleChange: (value: 'agent' | 'team_lead') => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const STATUS_STYLES: Record<
  Exclude<UploadStatus, 'idle'>,
  { label: string; className: string; icon: React.ReactNode }
> = {
  queued: {
    label: 'Queued',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-400',
    icon: <Clock3 size={14} />,
  },
  processing: {
    label: 'Processing',
    className:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-500/10 dark:text-sky-400',
    icon: <Loader2 size={14} className="animate-spin" />,
  },
  success: {
    label: 'Success',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-400',
    icon: <CheckCircle2 size={14} />,
  },
  failed: {
    label: 'Failed',
    className:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-500/10 dark:text-rose-400',
    icon: <AlertCircle size={14} />,
  },
};

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  submittedByRole,
  file,
  uploading,
  uploadProgress,
  uploadStatus,
  uploadStatusMessage,
  onTitleChange,
  onDescriptionChange,
  onSubmittedByRoleChange,
  onFileChange,
  onSubmit,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !uploading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, uploading]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && !uploading) {
      onClose();
    }
  };

  const statusMeta = uploadStatus === 'idle' ? null : STATUS_STYLES[uploadStatus];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      onClick={handleBackdropClick}
    >
      <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm dark:bg-neutral-900/80" />

      <div
        ref={modalRef}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/20">
              <Upload size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                提交知识变更
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                进入待审核队列，由班长或知识管理员审核后发布
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="rounded-xl p-2 text-neutral-400 transition-all hover:bg-neutral-100 hover:text-neutral-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            title="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form onSubmit={onSubmit} className="space-y-6">
            {statusMeta && (
              <div className={`rounded-2xl border px-4 py-3 ${statusMeta.className}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {statusMeta.icon}
                  <span>{statusMeta.label}</span>
                  {uploadStatus === 'processing' && uploadProgress > 0 && (
                    <span className="text-xs opacity-80">{uploadProgress}%</span>
                  )}
                </div>
                {uploadStatusMessage && (
                  <p className="mt-2 text-xs leading-5 opacity-90">{uploadStatusMessage}</p>
                )}
              </div>
            )}

            <div>
              <label className="mb-2.5 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <span className="h-4 w-1 rounded-full bg-amber-600" />
                资料标题
                <span className="text-amber-600">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 transition-all placeholder-neutral-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
                placeholder="例如：退款政策 FAQ / 售后处理流程"
                required
                disabled={uploading}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="mb-2.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                提交身份
              </label>
              <select
                value={submittedByRole}
                onChange={(event) =>
                  onSubmittedByRoleChange(event.target.value as 'agent' | 'team_lead')
                }
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 transition-all focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                disabled={uploading}
              >
                <option value="agent">普通客服</option>
                <option value="team_lead">班长</option>
              </select>
            </div>

            <div>
              <label className="mb-2.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                资料说明
              </label>
              <textarea
                name="description"
                value={description}
                onChange={(event) => onDescriptionChange(event.target.value)}
                className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 transition-all placeholder-neutral-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
                placeholder="简要说明该资料适用的客服场景、流程范围和使用对象。"
                rows={3}
                disabled={uploading}
              />
            </div>

            <div>
              <label className="mb-2.5 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <span className="h-4 w-1 rounded-full bg-amber-600" />
                上传文件
                <span className="text-amber-600">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                name="file"
                onChange={(event) => onFileChange(event.target.files?.[0] || null)}
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.html,.xlsx,.xls,.png,.jpg,.jpeg"
                disabled={uploading}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={uploading ? undefined : () => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if ((event.key === 'Enter' || event.key === ' ') && !uploading) {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
                  file
                    ? 'border-amber-400 bg-amber-50/50 dark:border-amber-600/50 dark:bg-amber-900/10'
                    : 'border-neutral-300 hover:border-amber-400/50 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:border-amber-600/50 dark:hover:bg-neutral-800/50'
                } ${uploading ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all ${
                      file
                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-600/20 dark:text-amber-500'
                        : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
                    }`}
                  >
                    {file ? <FileText size={32} /> : <Upload size={32} />}
                  </div>
                  <div className="text-center">
                    {file ? (
                      <div>
                        <p className="mb-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          {file.name}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                        {!uploading && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onFileChange(null);
                              fileInputRef.current?.click();
                            }}
                            className="mt-2 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400"
                          >
                            更换文件
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="mb-1 text-sm text-neutral-700 dark:text-neutral-300">
                          点击选择文件，或将文件拖拽到这里
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          支持 PDF、Word、PPT、Excel、Markdown 和图片等格式
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {(uploading || uploadStatus === 'success') && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      uploadStatus === 'success'
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                        : 'bg-gradient-to-r from-amber-500 to-amber-600'
                    }`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {uploadStatus === 'processing'
                    ? '文件已上传，正在执行识别与审核预处理。'
                    : `上传进度 ${uploadProgress}%`}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="rounded-xl px-5 py-2.5 text-sm font-medium text-neutral-600 transition-all hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={uploading || !file || !title.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-amber-500/20 transition-all duration-200 hover:from-amber-600 hover:to-amber-700 hover:shadow-xl hover:shadow-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-lg"
              >
                {uploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {uploadStatus === 'queued' ? '排队上传中' : '处理中'}
                    {uploadProgress > 0 && ` (${uploadProgress}%)`}
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    提交审核
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
