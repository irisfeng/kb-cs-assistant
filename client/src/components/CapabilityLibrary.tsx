import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Filter,
  LayoutGrid,
  List,
  MessageSquareQuote,
  Plus,
  Search,
} from 'lucide-react';
import type { ProductCapability } from '../types/capability';
import { CapabilityCard } from './CapabilityCard';
import { CapabilityForm } from './CapabilityForm';
import { useToast } from '../contexts/ToastContext';

type CardViewMode = 'grid' | 'list';

const CUSTOMER_SERVICE_CATEGORIES = [
  '退款与售后',
  '订单与物流',
  '投诉安抚',
  '产品使用',
  '账号与权限',
  '升级与转人工',
  '其他',
];

export const CapabilityLibrary: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [capabilities, setCapabilities] = useState<ProductCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCapability, setEditingCapability] = useState<ProductCapability | null>(null);
  const [viewMode, setViewMode] = useState<CardViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const loadCapabilities = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/capabilities');
      if (!response.ok) {
        throw new Error('Failed to load capabilities');
      }

      const data = await response.json();
      setCapabilities(data);
    } catch (error) {
      console.error('Load capabilities error:', error);
      showToast(t('chat.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCapabilities();
  }, []);

  const handleSave = async (data: Partial<ProductCapability>) => {
    try {
      const isEditing = Boolean(editingCapability);
      const response = await fetch(
        isEditing ? `/api/capabilities/${editingCapability?.id}` : '/api/capabilities',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );

      if (response.status === 409) {
        const errorData = await response.json();
        showToast(errorData.error || t('capabilities.duplicate_error'), 'error');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to save capability');
      }

      showToast(t('capabilities.success'), 'success');
      setShowForm(false);
      setEditingCapability(null);
      await loadCapabilities();
    } catch (error) {
      console.error('Save capability error:', error);
      showToast(t('chat.error'), 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('capabilities.card.delete_confirm'))) {
      return;
    }

    try {
      const response = await fetch(`/api/capabilities/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to delete capability');
      }

      showToast(t('capabilities.delete_success'), 'success');
      await loadCapabilities();
    } catch (error) {
      console.error('Delete capability error:', error);
      showToast(t('chat.error'), 'error');
    }
  };

  const filteredCapabilities = useMemo(() => {
    return capabilities.filter((capability) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        capability.name.toLowerCase().includes(query) ||
        capability.description.toLowerCase().includes(query) ||
        capability.features.some((item) => item.toLowerCase().includes(query));
      const matchesCategory = !selectedCategory || capability.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [capabilities, searchQuery, selectedCategory]);

  const groupedCapabilities = useMemo(() => {
    return filteredCapabilities.reduce<Record<string, ProductCapability[]>>((groups, capability) => {
      if (!groups[capability.category]) {
        groups[capability.category] = [];
      }
      groups[capability.category].push(capability);
      return groups;
    }, {});
  }, [filteredCapabilities]);

  const categories = useMemo(
    () => [...new Set([...CUSTOMER_SERVICE_CATEGORIES, ...capabilities.map((item) => item.category)])],
    [capabilities],
  );

  const rulePointCount = filteredCapabilities.reduce(
    (sum, capability) => sum + (capability.features?.length || 0),
    0,
  );

  if (showForm) {
    return (
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <CapabilityForm
          capability={editingCapability}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingCapability(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl shadow-amber-500/20">
            <MessageSquareQuote size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              {t('capabilities.title')}
            </h1>
            <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-dark-textSecondary">
              {t('capabilities.description')}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-amber-500 dark:text-neutral-950 dark:hover:bg-amber-400"
        >
          <Plus size={18} />
          {t('capabilities.add_new')}
        </button>
      </div>

      {!loading && capabilities.length > 0 && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">
                {t('capabilities.stats.total')}
              </p>
              <p className="mt-3 text-3xl font-semibold">{capabilities.length}</p>
            </div>
            <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">
                {t('capabilities.stats.categories')}
              </p>
              <p className="mt-3 text-3xl font-semibold">{Object.keys(groupedCapabilities).length}</p>
            </div>
            <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">
                {t('capabilities.stats.points')}
              </p>
              <p className="mt-3 text-3xl font-semibold">{rulePointCount}</p>
            </div>
            <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">
                {t('capabilities.stats.visible')}
              </p>
              <p className="mt-3 text-3xl font-semibold">{filteredCapabilities.length}</p>
            </div>
          </div>

          <div className="mb-6 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('capabilities.search_placeholder')}
                  className="w-full rounded-2xl border border-neutral-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
                />
              </div>

              <div className="relative min-w-[220px]">
                <Filter
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full appearance-none rounded-2xl border border-neutral-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-dark-border dark:bg-dark-bg"
                >
                  <option value="">{t('capabilities.all_categories')}</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-2xl border border-neutral-200 bg-stone-50 p-1 dark:border-dark-border dark:bg-dark-bg">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`rounded-xl p-2 transition ${
                      viewMode === 'grid'
                        ? 'bg-white text-neutral-950 shadow-sm dark:bg-dark-card dark:text-dark-text'
                        : 'text-neutral-400'
                    }`}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`rounded-xl p-2 transition ${
                      viewMode === 'list'
                        ? 'bg-white text-neutral-950 shadow-sm dark:bg-dark-card dark:text-dark-text'
                        : 'text-neutral-400'
                    }`}
                  >
                    <List size={16} />
                  </button>
                </div>

                {(searchQuery || selectedCategory) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('');
                    }}
                    className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-dark-border dark:text-dark-textSecondary dark:hover:bg-dark-border"
                  >
                    {t('capabilities.clear_filters')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 h-16 w-16 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600 dark:border-amber-900/40 dark:border-t-amber-500" />
          <p className="text-sm text-neutral-500 dark:text-dark-textSecondary">Loading...</p>
        </div>
      ) : capabilities.length === 0 ? (
        <div className="rounded-[32px] border-2 border-dashed border-neutral-200 bg-white px-6 py-20 text-center dark:border-dark-border dark:bg-dark-card">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <MessageSquareQuote size={36} />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-neutral-950 dark:text-white">
            {t('capabilities.empty_state')}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-500 dark:text-dark-textSecondary">
            {t('capabilities.empty_hint')}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-amber-500 dark:text-neutral-950 dark:hover:bg-amber-400"
          >
            <Plus size={18} />
            {t('capabilities.add_new')}
          </button>
        </div>
      ) : filteredCapabilities.length === 0 ? (
        <div className="rounded-[32px] border border-dashed border-neutral-200 bg-white px-6 py-16 text-center dark:border-dark-border dark:bg-dark-card">
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
            {t('capabilities.search_placeholder')}
          </h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-dark-textSecondary">
            {t('capabilities.clear_filters')}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredCapabilities.map((capability, index) => (
            <CapabilityCard
              key={capability.id}
              capability={capability}
              onEdit={(item) => {
                setEditingCapability(item);
                setShowForm(true);
              }}
              onDelete={handleDelete}
              viewMode="list"
              index={index}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedCapabilities).map(([category, items]) => (
            <section key={category}>
              <div className="mb-4 flex items-center gap-3">
                <div className="h-6 w-1 rounded-full bg-amber-500" />
                <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
                  {category}
                </h2>
                <span className="text-sm text-neutral-400">({items.length})</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((capability) => (
                  <CapabilityCard
                    key={capability.id}
                    capability={capability}
                    onEdit={(item) => {
                      setEditingCapability(item);
                      setShowForm(true);
                    }}
                    onDelete={handleDelete}
                    viewMode="grid"
                    index={filteredCapabilities.indexOf(capability)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
