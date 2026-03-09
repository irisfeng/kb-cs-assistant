import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage = 8,
}) => {
  const { i18n } = useTranslation();
  const isChinese = i18n.language === 'zh';

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      for (let page = 1; page <= totalPages; page += 1) {
        pages.push(page);
      }
      return pages;
    }

    pages.push(1);

    if (currentPage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (currentPage < totalPages - 2) {
      pages.push('...');
    }

    pages.push(totalPages);
    return pages;
  };

  if (totalPages <= 1) {
    return null;
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems || currentPage * itemsPerPage);

  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-stone-200/80 px-1 pt-4 dark:border-[#35302b] sm:flex-row sm:items-center sm:justify-between">
      {totalItems ? (
        <div className="text-sm text-stone-500 dark:text-stone-400">
          {isChinese
            ? `显示 ${startItem} - ${endItem}，共 ${totalItems} 条`
            : `Showing ${startItem} - ${endItem} of ${totalItems}`}
        </div>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200/80 bg-white/80 text-stone-600 transition hover:border-stone-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#35302b] dark:bg-[#201d1a] dark:text-stone-300 dark:hover:border-[#4a433c]"
          title={isChinese ? '上一页' : 'Previous'}
        >
          <ChevronLeft size={15} />
        </button>

        <div className="hidden items-center gap-1.5 sm:flex">
          {getPageNumbers().map((page, index) =>
            typeof page === 'number' ? (
              <button
                key={`${page}-${index}`}
                onClick={() => onPageChange(page)}
                className={`min-w-[34px] rounded-full px-2.5 py-1.5 text-sm font-medium transition ${
                  currentPage === page
                    ? 'bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950'
                    : 'border border-stone-200/80 bg-white/80 text-stone-600 hover:border-stone-300 hover:bg-white dark:border-[#35302b] dark:bg-[#201d1a] dark:text-stone-300 dark:hover:border-[#4a433c]'
                }`}
              >
                {page}
              </button>
            ) : (
              <span key={`${page}-${index}`} className="px-1.5 text-stone-400">
                {page}
              </span>
            ),
          )}
        </div>

        <div className="px-2 text-sm text-stone-500 dark:text-stone-400 sm:hidden">
          {currentPage} / {totalPages}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200/80 bg-white/80 text-stone-600 transition hover:border-stone-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#35302b] dark:bg-[#201d1a] dark:text-stone-300 dark:hover:border-[#4a433c]"
          title={isChinese ? '下一页' : 'Next'}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};
