import React from 'react';
import { FileText, ChevronRight } from 'lucide-react';

interface CitationCardProps {
  citation: {
    id: string;
    q: string;
    solutionId: string;
    solutionTitle: string;
  };
  onSolutionClick: (id: string) => void;
}

export const CitationCard: React.FC<CitationCardProps> = ({
  citation,
  onSolutionClick
}) => {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3 border border-neutral-200 dark:border-neutral-800">
      {/* Solution Title (clickable) */}
      <button
        onClick={() => onSolutionClick(citation.solutionId)}
        className="flex items-center gap-2 text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 text-sm font-medium mb-2 transition-colors"
      >
        <FileText size={14} />
        <span>{citation.solutionTitle}</span>
        <ChevronRight size={14} />
      </button>

      {/* Citation Content */}
      <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
        {citation.q}
      </p>
    </div>
  );
};
