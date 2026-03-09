import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProductCapability, ProductCapabilityFormData } from '../types/capability';

const CUSTOMER_SERVICE_CATEGORIES = [
  '退款与售后',
  '订单与物流',
  '投诉安抚',
  '产品使用',
  '账号与权限',
  '升级与转人工',
  '其他',
];

interface CapabilityFormProps {
  capability?: ProductCapability | null;
  onSave: (data: Partial<ProductCapability>) => void;
  onCancel: () => void;
}

export const CapabilityForm: React.FC<CapabilityFormProps> = ({
  capability,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ProductCapabilityFormData>({
    name: '',
    category: '',
    description: '',
    features: '',
    useCases: '',
    benefits: '',
    specs: '',
    performance: '',
  });

  useEffect(() => {
    if (!capability) {
      return;
    }

    setFormData({
      name: capability.name || '',
      category: capability.category || '',
      description: capability.description || '',
      features: (capability.features || []).join('\n'),
      useCases: (capability.useCases || []).join('\n'),
      benefits: (capability.benefits || []).join('\n'),
      specs: JSON.stringify(capability.specs || [], null, 2),
      performance: JSON.stringify(capability.performance || {}, null, 2),
    });
  }, [capability]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const parseArray = (value: string) =>
    value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

  const parseJSON = (value: string, fallback: unknown) => {
    try {
      return JSON.parse(value || '{}');
    } catch {
      return fallback;
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    onSave({
      name: formData.name,
      category: formData.category,
      description: formData.description,
      features: parseArray(formData.features),
      useCases: parseArray(formData.useCases),
      benefits: parseArray(formData.benefits),
      specs: parseJSON(formData.specs, []),
      performance: parseJSON(formData.performance, {}),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm dark:border-dark-border dark:bg-dark-card">
        <h2 className="text-2xl font-semibold text-neutral-950 dark:text-white">
          {capability ? t('capabilities.form.edit') : t('capabilities.add_new')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-dark-textSecondary">
          {t('capabilities.description')}
        </p>
      </div>

      <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm dark:border-dark-border dark:bg-dark-card">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('capabilities.form.name')}
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t('capabilities.form.name_placeholder')}
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('capabilities.form.category')}
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
              required
            >
              <option value="">{t('capabilities.form.category_placeholder')}</option>
              {CUSTOMER_SERVICE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('capabilities.form.description')}
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder={t('capabilities.form.description_placeholder')}
            rows={4}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
            required
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm dark:border-dark-border dark:bg-dark-card">
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('capabilities.form.features')}
          </label>
          <textarea
            name="features"
            value={formData.features}
            onChange={handleChange}
            placeholder={t('capabilities.form.features_placeholder')}
            rows={9}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
          />
        </div>

        <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm dark:border-dark-border dark:bg-dark-card">
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('capabilities.form.useCases')}
          </label>
          <textarea
            name="useCases"
            value={formData.useCases}
            onChange={handleChange}
            placeholder={t('capabilities.form.useCases_placeholder')}
            rows={9}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
          />
        </div>

        <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm dark:border-dark-border dark:bg-dark-card">
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('capabilities.form.benefits')}
          </label>
          <textarea
            name="benefits"
            value={formData.benefits}
            onChange={handleChange}
            placeholder={t('capabilities.form.benefits_placeholder')}
            rows={9}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm dark:border-dark-border dark:bg-dark-card">
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('capabilities.form.specs')}
          </label>
          <textarea
            name="specs"
            value={formData.specs}
            onChange={handleChange}
            placeholder={t('capabilities.form.specs_placeholder')}
            rows={6}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
          />
        </div>

        <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm dark:border-dark-border dark:bg-dark-card">
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('capabilities.form.performance')}
          </label>
          <textarea
            name="performance"
            value={formData.performance}
            onChange={handleChange}
            placeholder={t('capabilities.form.performance_placeholder')}
            rows={6}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-neutral-200 px-5 py-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-dark-border dark:text-dark-textSecondary dark:hover:bg-dark-border"
        >
          {t('capabilities.form.cancel')}
        </button>
        <button
          type="submit"
          className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-amber-500 dark:text-neutral-950 dark:hover:bg-amber-400"
        >
          {t('capabilities.form.submit')}
        </button>
      </div>
    </form>
  );
};
