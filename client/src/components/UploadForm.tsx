import React from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Loader2, Plus } from 'lucide-react';

interface UploadFormProps {
  title: string;
  description: string;
  file: File | null;
  uploading: boolean;
  uploadProgress: number;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const UploadForm: React.FC<UploadFormProps> = ({
  title,
  description,
  file,
  uploading,
  uploadProgress,
  onTitleChange,
  onDescriptionChange,
  onFileChange,
  onSubmit,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 sm:p-6 shadow-sm dark:shadow-none transition-colors duration-200">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="w-8 h-8 bg-amber-600/10 dark:bg-amber-600/20 rounded-lg flex items-center justify-center">
          <Plus className="text-amber-600 dark:text-amber-500" size={18} />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-serif text-neutral-900 dark:text-white font-medium">{t('solutions.add_new')}</h3>
          <p className="text-neutral-500 dark:text-neutral-500 text-xs">新增方案档案</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left Column */}
        <div className="space-y-4 sm:space-y-5">
          {/* Title Input */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 sm:mb-2">
              {t('solutions.form.title')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all duration-200 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
              placeholder={t('solutions.form.title_placeholder')}
              required
            />
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 sm:mb-2">
              {t('solutions.form.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all duration-200 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 h-24 sm:h-28 resize-none"
              placeholder={t('solutions.form.description_placeholder')}
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4 sm:space-y-5">
          {/* File Upload */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 sm:mb-2">
              {t('solutions.form.document')}
            </label>
            <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg p-4 sm:p-6 md:p-8 text-center hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:border-amber-600/50 dark:hover:border-amber-600/50 transition-all duration-200 relative">
              <input
                type="file"
                onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.html,.xlsx,.xls,.png,.jpg,.jpeg"
              />
              <div className="flex flex-col items-center gap-3 text-neutral-500 dark:text-neutral-400">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${file ? 'bg-amber-100 dark:bg-amber-600/20 text-amber-600 dark:text-amber-500' : 'bg-neutral-200 dark:bg-neutral-800'}`}>
                  <Upload size={24} />
                </div>
                <div className="text-center">
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">{file ? file.name : t('solutions.form.drop_text')}</span>
                  {file && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700 disabled:bg-neutral-200 dark:disabled:bg-neutral-800 disabled:text-neutral-400 dark:disabled:text-neutral-600 disabled:cursor-not-allowed text-white py-2.5 sm:py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                {t('solutions.form.uploading')} {uploadProgress > 0 && `(${uploadProgress}%)`}
              </>
            ) : (
              <>
                <Plus size={18} />
                {t('solutions.form.upload_btn')}
              </>
            )}
          </button>

          {/* Progress Bar */}
          {uploading && uploadProgress > 0 && (
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-600 to-amber-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
