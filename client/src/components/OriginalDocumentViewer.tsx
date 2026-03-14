import React, { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink, FileImage, FileType2, Code, AlertCircle } from 'lucide-react';

interface OriginalDocumentViewerProps {
  filePath: string;
  fileName: string;
}

export const OriginalDocumentViewer: React.FC<OriginalDocumentViewerProps> = ({
  filePath,
  fileName
}) => {
  const [textContent, setTextContent] = useState<string>('');
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  const fileExt = fileName.toLowerCase().split('.').pop();

  // 判断文档类型
  const isPdf = fileExt === 'pdf';
  const isOffice = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(fileExt || '');
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(fileExt || '');
  const isText = ['txt', 'md', 'csv', 'json', 'xml', 'log', 'html', 'css', 'js', 'ts', 'jsx', 'tsx'].includes(fileExt || '');
  const isCode = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'cs', 'swift', 'kt'].includes(fileExt || '');

  // 文件类型标签样式 - 统一中性色调
  const getFileTypeLabel = () => {
    if (isPdf) return { label: 'PDF', icon: <FileType2 size={12} />, color: 'text-neutral-500 dark:text-neutral-400' };
    if (isOffice) {
      const type = fileExt?.startsWith('doc') ? 'Word' : fileExt?.startsWith('ppt') ? 'PPT' : fileExt?.startsWith('xls') ? 'Excel' : 'Office';
      return { label: type, icon: <FileText size={12} />, color: 'text-neutral-500 dark:text-neutral-400' };
    }
    if (isImage) return { label: 'Image', icon: <FileImage size={12} />, color: 'text-neutral-500 dark:text-neutral-400' };
    if (isCode) return { label: 'Code', icon: <Code size={12} />, color: 'text-neutral-500 dark:text-neutral-400' };
    if (isText) return { label: 'Text', icon: <FileText size={12} />, color: 'text-neutral-500 dark:text-neutral-400' };
    return { label: fileExt?.toUpperCase() || 'File', icon: <FileText size={12} />, color: 'text-neutral-500 dark:text-neutral-400' };
  };

  const fileType = getFileTypeLabel();

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = filePath;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    window.open(filePath, '_blank');
  };

  // 加载文本文件内容
  useEffect(() => {
    if (isText || isCode) {
      setTextLoading(true);
      fetch(filePath)
        .then(res => {
          if (!res.ok) throw new Error('加载失败');
          return res.text();
        })
        .then(text => {
          setTextContent(text);
          setTextLoading(false);
        })
        .catch(err => {
          setTextError(err.message);
          setTextLoading(false);
        });
    }
  }, [filePath, isText, isCode]);

  // ========== 通用工具栏 ==========
  const Toolbar = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {/* 文件名 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            Original File
          </span>
          <span className="text-neutral-300 dark:text-neutral-600">|</span>
          <span className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">
            {fileName}
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        {children}
      </div>
    </div>
  );

  // ========== PDF 预览 ==========
  if (isPdf) {
    return (
      <div className="space-y-0">
        <Toolbar>
          <button
            onClick={handleOpenNewTab}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400
              bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700
              hover:border-amber-300 dark:hover:border-amber-700 hover:text-amber-700 dark:hover:text-amber-500
              rounded-lg transition-all duration-200"
            title="在新标签页打开"
          >
            <ExternalLink size={14} />
            新标签页
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white
              bg-amber-600 hover:bg-amber-700
              rounded-lg transition-all duration-200 shadow-sm hover:shadow"
          >
            <Download size={14} />
            下载
          </button>
        </Toolbar>

        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm" style={{ height: 'clamp(400px, 60vh, 800px)' }}>
          <iframe
            src={filePath}
            className="w-full h-full border-0"
            title={fileName}
          />
        </div>
      </div>
    );
  }

  // ========== Office 文档预览 ==========
  if (isOffice) {
    const [viewerError, setViewerError] = useState(false);

    // 检测是否在本地开发环境
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // 使用 Microsoft Office Online 在线预览
    // 需要完整的 URL（包括协议和域名）
    const getOfficeViewerUrl = () => {
      // 获取当前页面完整 URL 作为基础
      const baseUrl = window.location.origin;
      const fullFileUrl = `${baseUrl}${filePath}`;
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullFileUrl)}`;
    };

    // 如果是本地环境，直接显示提示，不尝试加载 iframe
    if (isLocalhost) {
      return (
        <div className="space-y-0">
          <Toolbar>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white
                bg-amber-600 hover:bg-amber-700
                rounded-lg transition-all duration-200 shadow-sm hover:shadow"
            >
              <Download size={14} />
              下载
            </button>
          </Toolbar>

          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800 p-16 min-h-[500px]
            flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-900 rounded-2xl flex items-center justify-center mb-6">
              <FileText size={32} className="text-neutral-400 dark:text-neutral-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2 font-serif">
              {fileName}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
              {fileType.label} 文档
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-6 max-w-sm">
              Office 文档在线预览需要部署到公网服务器才能使用
            </p>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-8 max-w-md space-y-1">
              <p>💡 提示：请切换到「<span className="text-amber-600 dark:text-amber-500 font-medium">解析内容</span>」标签页查看解析后的 Markdown 内容</p>
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white
                bg-amber-600 hover:bg-amber-700
                rounded-lg transition-all duration-200 shadow-sm hover:shadow"
            >
              <Download size={16} />
              下载 {fileType.label} 文件
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-0">
        <Toolbar>
          <button
            onClick={handleOpenNewTab}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400
              bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700
              hover:border-amber-300 dark:hover:border-amber-700 hover:text-amber-700 dark:hover:text-amber-500
              rounded-lg transition-all duration-200"
            title="在新窗口打开 Office Online 预览"
          >
            <ExternalLink size={14} />
            新窗口打开
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white
              bg-amber-600 hover:bg-amber-700
              rounded-lg transition-all duration-200 shadow-sm hover:shadow"
          >
            <Download size={14} />
            下载
          </button>
        </Toolbar>

        {!viewerError ? (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm" style={{ height: 'clamp(400px, 60vh, 800px)' }}>
            <iframe
              src={getOfficeViewerUrl()}
              className="w-full h-full border-0"
              title={`预览: ${fileName}`}
              frameBorder="0"
              onError={() => setViewerError(true)}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800 p-16 min-h-[500px]
            flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2 font-serif">
              预览加载失败
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 max-w-sm">
              无法加载在线预览，可能是文件格式不支持或网络问题
            </p>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white
                bg-amber-600 hover:bg-amber-700
                rounded-lg transition-all duration-200 shadow-sm hover:shadow"
            >
              <Download size={16} />
              下载文件
            </button>
          </div>
        )}
      </div>
    );
  }

  // ========== 图片预览 ==========
  if (isImage) {
    return (
      <div className="space-y-0">
        <Toolbar>
          <button
            onClick={handleOpenNewTab}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400
              bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700
              hover:border-amber-300 dark:hover:border-amber-700 hover:text-amber-700 dark:hover:text-amber-500
              rounded-lg transition-all duration-200"
          >
            <ExternalLink size={14} />
            查看大图
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white
              bg-amber-600 hover:bg-amber-700
              rounded-lg transition-all duration-200 shadow-sm hover:shadow"
          >
            <Download size={14} />
            下载
          </button>
        </Toolbar>

        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 lg:p-8 shadow-sm">
          <div className="flex items-center justify-center">
            <img
              src={filePath}
              alt={fileName}
              className="w-full h-auto rounded-lg shadow-md object-contain"
            />
          </div>
        </div>
      </div>
    );
  }

  // ========== 代码/文本文件预览 ==========
  if (isText || isCode) {
    return (
      <div className="space-y-0">
        <Toolbar>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white
              bg-amber-600 hover:bg-amber-700
              rounded-lg transition-all duration-200 shadow-sm hover:shadow"
          >
            <Download size={14} />
            下载
          </button>
        </Toolbar>

        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
          {textLoading && (
            <div className="flex items-center justify-center py-32 text-neutral-400 dark:text-neutral-600">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-600 border-t-transparent mr-3"></div>
              <span className="text-sm">加载中...</span>
            </div>
          )}

          {textError && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center mb-4">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <p className="text-sm text-red-500 mb-6">加载失败: {textError}</p>
              <button
                onClick={handleDownload}
                className="px-5 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all"
              >
                下载文件查看
              </button>
            </div>
          )}

          {!textLoading && !textError && (
            <div className="p-4 sm:p-6 overflow-auto" style={{ maxHeight: 'clamp(300px, 60vh, 800px)' }}>
              <pre className={`text-xs sm:text-sm ${isCode ? 'font-mono' : 'font-serif'} whitespace-pre-wrap break-words
                text-neutral-700 dark:text-neutral-300 leading-relaxed`}>
                {textContent}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== 不支持的格式 ==========
  return (
    <div className="space-y-0">
      <Toolbar>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white
            bg-amber-600 hover:bg-amber-700
            rounded-lg transition-all duration-200 shadow-sm hover:shadow"
        >
          <Download size={14} />
          下载
        </button>
      </Toolbar>

      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800 p-16 min-h-[500px]
        flex flex-col items-center justify-center text-center shadow-sm">
        <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-900 rounded-2xl flex items-center justify-center mb-6">
          <FileText size={32} className="text-neutral-400 dark:text-neutral-600" />
        </div>
        <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2 font-serif">
          {fileName}
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 max-w-md">
          此文件格式暂不支持在线预览，请下载后使用相应软件打开
        </p>
      </div>
    </div>
  );
};
