import React, { useMemo } from 'react';
import { FileText, FileCode, Table, File, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { DocumentChunk } from '../types/solution';

interface DocumentPreviewProps {
  chunks: DocumentChunk[];
  loading?: boolean;
  fileName?: string;
  fullText?: string;
  source?: 'local' | 'fastgpt';
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  chunks,
  loading,
  fileName,
  fullText = '',
  source = 'fastgpt'
}) => {
  // Detect file format
  const fileFormat = useMemo(() => {
    if (!fileName) return 'unknown';
    const ext = fileName.toLowerCase().split('.').pop();
    return ext || 'unknown';
  }, [fileName]);

  // Get format info
  const formatInfo = useMemo(() => {
    const formatMap: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
      md: { icon: <FileCode size={16} />, label: 'Markdown', color: 'text-blue-600 dark:text-blue-400' },
      pdf: { icon: <FileText size={16} />, label: 'PDF', color: 'text-red-600 dark:text-red-400' },
      doc: { icon: <FileText size={16} />, label: 'Word', color: 'text-blue-700 dark:text-blue-500' },
      docx: { icon: <FileText size={16} />, label: 'Word', color: 'text-blue-700 dark:text-blue-500' },
      ppt: { icon: <FileText size={16} />, label: 'PPT', color: 'text-orange-600 dark:text-orange-400' },
      pptx: { icon: <FileText size={16} />, label: 'PPT', color: 'text-orange-600 dark:text-orange-400' },
      xlsx: { icon: <Table size={16} />, label: 'Excel', color: 'text-green-600 dark:text-green-400' },
      xls: { icon: <Table size={16} />, label: 'Excel', color: 'text-green-600 dark:text-green-400' },
      csv: { icon: <Table size={16} />, label: 'CSV', color: 'text-green-600 dark:text-green-400' },
      txt: { icon: <File size={16} />, label: 'TXT', color: 'text-neutral-600 dark:text-neutral-400' },
      html: { icon: <FileCode size={16} />, label: 'HTML', color: 'text-orange-500 dark:text-orange-400' },
    };
    return formatMap[fileFormat] || { icon: <File size={16} />, label: fileFormat.toUpperCase(), color: 'text-neutral-500' };
  }, [fileFormat]);

  // Combine all chunks into full text (for FastGPT source)
  const chunksFullText = chunks.map(chunk => chunk.q).join('\n\n');

  // Use fullText if provided (local source), otherwise use chunks
  // Clean up the text: remove excessive separators and empty lines
  const displayFullText = (fullText || chunksFullText)
    .replace(/\n---\n\n---\n/g, '\n\n')  // Remove duplicate separators
    .replace(/\n---\n/g, '\n\n')         // Replace single separator with blank line
    .replace(/\n{4,}/g, '\n\n\n')        // Limit consecutive empty lines to 2
    .trim();

  // Handle download
  const handleDownload = () => {
    const blob = new Blob([displayFullText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName?.replace(/\.[^/.]+$/, '') + '.md' || 'document.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-neutral-200 dark:bg-neutral-800 rounded-lg h-8 w-1/3"></div>
        <div className="animate-pulse bg-neutral-200 dark:bg-neutral-800 rounded-lg h-64"></div>
      </div>
    );
  }

  // Empty state - check if we have any content (fullText OR chunks)
  const hasContent = displayFullText.trim().length > 0 || chunks.length > 0;
  if (!hasContent) {
    return (
      <div className="text-center py-20 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg">
        <FileText className="text-neutral-400 dark:text-neutral-600 mx-auto mb-4" size={48} />
        <p className="text-neutral-500 dark:text-neutral-500">暂无文档内容</p>
      </div>
    );
  }

  // Calculate stats
  const wordCount = displayFullText.length;
  const imageCount = (displayFullText.match(/!\[/g) || []).length;
  const headingCount = (displayFullText.match(/^#{1,6}\s/gm) || []).length;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header with Format Tag and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Format Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 ${formatInfo.color}`}>
            {formatInfo.icon}
            <span className="text-sm font-medium">{formatInfo.label}</span>
          </div>

          {/* Document Stats */}
          <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
            {wordCount > 0 && (
              <span>{wordCount.toLocaleString()} 字符</span>
            )}
            {headingCount > 0 && (
              <span>{headingCount} 个标题</span>
            )}
            {imageCount > 0 && (
              <span>{imageCount} 张图片</span>
            )}
            {source === 'local' && (
              <span className="text-amber-600 dark:text-amber-500">● 高清解析</span>
            )}
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-amber-600 dark:hover:text-amber-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <Download size={14} />
          下载
        </button>
      </div>

      {/* Document Content */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
        {/* Center the document with optimal reading width - responsive */}
        <div
          className="w-full max-w-none sm:max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto overflow-auto"
          style={{ maxHeight: 'min(72vh, 1100px)' }}
        >
          <div className="document-content px-3 sm:px-4 md:px-6">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                // Custom heading styles - responsive
                h1: ({ children }) => (
                  <h1 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white mt-4 sm:mt-6 mb-2 sm:mb-3 pb-2 border-b border-neutral-200 dark:border-neutral-800 first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-white mt-3 sm:mt-5 mb-2 pb-1.5 border-b border-neutral-200 dark:border-neutral-800">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white mt-3 sm:mt-4 mb-2">
                    {children}
                  </h3>
                ),
                h4: ({ children }) => (
                  <h4 className="text-sm font-medium text-neutral-900 dark:text-white mt-2 sm:mt-3 mb-1.5">
                    {children}
                  </h4>
                ),
                // Paragraph with better spacing - responsive
                p: ({ children }) => (
                  <p className="text-xs sm:text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 my-2 sm:my-3">
                    {children}
                  </p>
                ),
                // List styles - responsive
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 my-2 sm:my-3 text-neutral-700 dark:text-neutral-300 text-xs sm:text-sm">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 my-2 sm:my-3 text-neutral-700 dark:text-neutral-300 text-xs sm:text-sm">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="ml-3 sm:ml-4">{children}</li>
                ),
                // Code block with syntax - responsive
                pre: ({ children }) => (
                  <pre className="bg-neutral-100 dark:bg-neutral-950 rounded-lg p-2 sm:p-3 my-2 sm:my-3 overflow-x-auto border border-neutral-200 dark:border-neutral-800">
                    <code className="text-xs text-neutral-800 dark:text-neutral-200 font-mono">
                      {children}
                    </code>
                  </pre>
                ),
                // Inline code - responsive
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-neutral-100 dark:bg-neutral-950 px-1 py-0.5 rounded text-xs text-amber-700 dark:text-amber-400 font-mono">
                      {children}
                    </code>
                  ) : (
                    <code className={className}>{children}</code>
                  );
                },
                // Blockquote - responsive
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-amber-600 dark:border-amber-500 pl-2 sm:pl-3 my-2 sm:my-3 italic text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 py-1.5 sm:py-2 text-xs sm:text-sm">
                    {children}
                  </blockquote>
                ),
                // Table styles - responsive
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2 sm:my-3">
                    <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-neutral-50 dark:bg-neutral-900">
                    {children}
                  </thead>
                ),
                tbody: ({ children }) => (
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {children}
                  </tbody>
                ),
                tr: ({ children }) => (
                  <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                    {children}
                  </tr>
                ),
                th: ({ children }) => (
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300">
                    {children}
                  </td>
                ),
                // Horizontal rule
                hr: () => (
                  <hr className="my-4 sm:my-6 border-t border-neutral-200 dark:border-neutral-800" />
                ),
                // Image styles - responsive
                img: ({ src, alt }) => (
                  <img
                    src={src}
                    alt={alt}
                    className="w-full max-w-md sm:max-w-lg h-auto rounded-lg my-3 sm:my-4 shadow-sm"
                    loading="lazy"
                  />
                ),
                // Link styles
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
                // Strong
                strong: ({ children }) => (
                  <strong className="font-semibold text-neutral-900 dark:text-white">
                    {children}
                  </strong>
                ),
              }}
            >
              {displayFullText}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-neutral-400 dark:text-neutral-600">
        {source === 'local' ? (
          <span>由 MinerU 智能解析 • 保留原始格式和图片</span>
        ) : (
          <span>来自 FastGPT 知识库 • {chunks.length} 个知识块</span>
        )}
      </div>
    </div>
  );
};
