import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Circle, Lightbulb, Loader2, Sparkles } from 'lucide-react';
import type { DraftSolution, SolutionRequirementForm } from '../types/solution';
import { useToast } from '../contexts/ToastContext';

interface SolutionGeneratorProps {
  onGenerated: (draft: DraftSolution) => void;
  onBack?: () => void;
}

export const SolutionGenerator: React.FC<SolutionGeneratorProps> = ({
  onGenerated,
  onBack,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<SolutionRequirementForm>({
    requirements: '',
    industry: '',
    customerType: '',
    expectedFeatures: '',
    additionalNotes: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const steps = useMemo(() => {
    const hasRequirements = formData.requirements.trim().length > 0;
    const hasOptional =
      (formData.industry ?? '').trim().length > 0 ||
      (formData.customerType ?? '').trim().length > 0 ||
      (formData.expectedFeatures ?? '').trim().length > 0 ||
      (formData.additionalNotes ?? '').trim().length > 0;

    return {
      hasRequirements,
      hasOptional,
    };
  }, [formData]);

  const completion = useMemo(() => {
    let value = 0;
    if (steps.hasRequirements) {
      value += 60;
    }
    if (steps.hasOptional) {
      value += 40;
    }
    return value;
  }, [steps]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      requirements: '',
      industry: '',
      customerType: '',
      expectedFeatures: '',
      additionalNotes: '',
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.requirements.trim()) {
      showToast(t('generator.requirements_error'), 'error');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch('/api/drafts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generate playbook failed');
      }

      const draft: DraftSolution = await response.json();
      showToast(t('generator.success'), 'success');
      onGenerated(draft);
      resetForm();
    } catch (error) {
      console.error('Generate solution error:', error);
      showToast(error instanceof Error ? error.message : t('chat.error'), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-8 flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-2xl border border-neutral-200 p-3 text-neutral-600 transition hover:bg-neutral-50 dark:border-dark-border dark:text-dark-textSecondary dark:hover:bg-dark-border"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl shadow-amber-500/20">
            <Sparkles size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              {t('generator.title')}
            </h1>
            <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-dark-textSecondary">
              {t('generator.description')}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-[28px] border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 dark:border-amber-900/40 dark:from-amber-900/20 dark:to-orange-900/10">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-amber-900 dark:text-amber-300">
            {t('generator.progress')}
          </span>
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            {completion}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-300"
            style={{ width: `${completion}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <div
            className={`inline-flex items-center gap-2 ${
              steps.hasRequirements
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-amber-900/50 dark:text-amber-300/50'
            }`}
          >
            {steps.hasRequirements ? <Check size={14} /> : <Circle size={14} />}
            {t('generator.required_step')}
          </div>
          <div
            className={`inline-flex items-center gap-2 ${
              steps.hasOptional
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-amber-900/50 dark:text-amber-300/50'
            }`}
          >
            {steps.hasOptional ? <Check size={14} /> : <Circle size={14} />}
            {t('generator.optional_step')}
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-sm dark:border-dark-border dark:bg-dark-card"
      >
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('generator.requirements')}
          </label>
          <textarea
            name="requirements"
            value={formData.requirements}
            onChange={handleChange}
            placeholder={t('generator.requirements_placeholder')}
            rows={7}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
            required
          />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('generator.industry')}
            </label>
            <input
              type="text"
              name="industry"
              value={formData.industry}
              onChange={handleChange}
              placeholder={t('generator.industry_placeholder')}
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('generator.customer_type')}
            </label>
            <input
              type="text"
              name="customerType"
              value={formData.customerType}
              onChange={handleChange}
              placeholder={t('generator.customer_type_placeholder')}
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('generator.expected_features')}
          </label>
          <textarea
            name="expectedFeatures"
            value={formData.expectedFeatures}
            onChange={handleChange}
            placeholder={t('generator.expected_features_placeholder')}
            rows={4}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
          />
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('generator.additional_notes')}
          </label>
          <textarea
            name="additionalNotes"
            value={formData.additionalNotes}
            onChange={handleChange}
            placeholder={t('generator.additional_notes_placeholder')}
            rows={4}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
          />
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="submit"
            disabled={isGenerating || !formData.requirements.trim()}
            className="inline-flex items-center gap-2 rounded-2xl bg-neutral-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 dark:bg-amber-500 dark:text-neutral-950 dark:hover:bg-amber-400 dark:disabled:bg-neutral-700"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {isGenerating ? t('generator.generating') : t('generator.generate')}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-[28px] border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 dark:border-amber-900/40 dark:from-amber-900/20 dark:to-orange-900/10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <Lightbulb size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              {t('generator.tips_title')}
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-900/90 dark:text-amber-300/90">
              <li>{t('generator.tips.specific')}</li>
              <li>{t('generator.tips.context')}</li>
              <li>{t('generator.tips.editable')}</li>
              <li>{t('generator.tips.retry')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
