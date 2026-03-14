import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Calendar, Download, FileText } from 'lucide-react';
import { DocumentPreview } from './DocumentPreview';
import { SolutionChat } from './SolutionChat';
import { useToast } from '../contexts/ToastContext';
import type { SolutionDetail as SolutionDetailType, PreviewData } from '../types/solution';
import { getSolutionProductDisplayName } from '../utils/productLabels';

interface SolutionDetailProps {
  solutionId: string;
  onBack: () => void;
}

export const SolutionDetail: React.FC<SolutionDetailProps> = ({
  solutionId,
  onBack
}) => {
  const { t } = useTranslation();
  const { showError } = useToast();
  const [solution, setSolution] = useState<SolutionDetailType | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchSolutionDetail();
  }, [solutionId]);

  useEffect(() => {
    if (solution) {
      fetchPreviewData();
    }
  }, [solution]);

  const fetchSolutionDetail = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/solutions/${solutionId}`);
      setSolution(res.data);
    } catch (error) {
      console.error('Failed to fetch solution detail:', error);
      showError('获取方案详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviewData = async () => {
    try {
      setPreviewLoading(true);
      const res = await axios.get(`/api/solutions/${solutionId}/preview`);
      setPreviewData(res.data);
    } catch (error) {
      console.error('Failed to fetch preview:', error);
      showError('获取文档预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadOriginal = () => {
    if (!solution?.originalFilePath) {
      return;
    }

    const link = document.createElement('a');
    link.href = solution.originalFilePath;
    link.download = solution.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2"></div>
          <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!solution) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <p className="text-neutral-500">方案未找到</p>
      </div>
    );
  }

  const chunkCount = previewData?.chunkCount || 0;
  const productLabel = getSolutionProductDisplayName(solution);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-amber-600 dark:hover:text-amber-500 mb-4 sm:mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-xs sm:text-sm">{t('solutionDetail.back') || '返回方案列表'}</span>
        </button>

        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="text-white" size={20} />
          </div>

          <div className="flex-1 w-full">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-serif text-neutral-900 dark:text-white font-light mb-2 sm:mb-3">
              {solution.title}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base lg:text-lg font-light mb-3 sm:mb-4">
              {solution.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:gap-6 text-xs sm:text-sm text-neutral-500 dark:text-neutral-500">
              {productLabel && (
                <div className="bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 px-3 py-1 rounded-full">
                  {productLabel}
                </div>
              )}
              <div className="flex items-center gap-2">
                <FileText size={14} />
                <span>{solution.fileName}</span>
              </div>
              {solution.createdAt && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} />
                  <span>{new Date(solution.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              )}
              <div className="bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded-full">
                {chunkCount > 0 ? `${chunkCount} 个知识块` : '已解析'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)] xl:gap-8">
        <section className="min-w-0 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-serif text-neutral-900 dark:text-white font-light">
                {t('solutionDetail.preview.title') || '文档预览'}
              </h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                默认展示解析内容，便于直接核对知识块、图文结果和问答依据。
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm">
                解析内容
              </span>
              {solution.originalFilePath && (
                <button
                  onClick={handleDownloadOriginal}
                  className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 transition hover:border-amber-300 hover:text-amber-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-amber-700 dark:hover:text-amber-400"
                >
                  <Download size={14} />
                  下载原件
                </button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px]">
            <DocumentPreview
              chunks={previewData?.chunks || []}
              fullText={previewData?.text || ''}
              source={previewData?.source || 'fastgpt'}
              loading={previewLoading}
              fileName={solution.fileName}
            />
          </div>
        </section>

        <aside className="min-w-0 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
          <div className="mb-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
            <p className="text-xs uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">
              Document Copilot
            </p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950 dark:text-white">
              针对当前文档提问
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              问答范围限定在当前资料，适合验证客服口径、步骤与图文说明是否一致。
            </p>
          </div>

          <SolutionChat solutionId={solutionId} solutionTitle={solution.title} />
        </aside>
      </div>
    </div>
  );
};
