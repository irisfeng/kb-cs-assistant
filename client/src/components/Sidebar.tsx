import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Languages,
  LifeBuoy,
  MessageSquareQuote,
  Moon,
  Sun,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { ViewMode } from '../types/solution';

interface SidebarProps {
  view: ViewMode;
  setView: (view: 'solutions' | 'upload' | 'capabilities' | 'governance') => void;
  toggleLanguage: () => void;
  currentLang: string;
  onUploadClick?: () => void;
}

interface NavItem {
  id: 'solutions' | 'upload' | 'capabilities' | 'governance';
  icon: LucideIcon;
  label: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  view,
  setView,
  toggleLanguage,
  currentLang,
  onUploadClick,
}) => {
  const { t } = useTranslation();
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar } = useTheme();
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const syncCompact = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsCompact(event.matches);
    };

    syncCompact(mediaQuery);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncCompact);
      return () => mediaQuery.removeEventListener('change', syncCompact);
    }

    mediaQuery.addListener(syncCompact);
    return () => mediaQuery.removeListener(syncCompact);
  }, []);

  const isCollapsed = sidebarCollapsed || isCompact;
  const isChinese = currentLang === 'zh';
  const sidebarSummary = isChinese
    ? '统一管理客服知识、SOP 和标准回复，让一线团队更快、更稳地协同。'
    : 'Keep knowledge, SOPs, and standard replies aligned for every support agent.';

  const navItems: NavItem[] = [
    { id: 'solutions', icon: BookOpenText, label: t('app.nav.solutions') },
    { id: 'upload', icon: Upload, label: t('app.nav.upload') },
    { id: 'capabilities', icon: MessageSquareQuote, label: t('app.nav.capabilities') },
    { id: 'governance', icon: ClipboardCheck, label: isChinese ? '知识治理' : 'Governance' },
  ];

  const tooltipClass =
    'pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-xl bg-stone-950 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100 dark:bg-stone-100 dark:text-stone-950';

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col border-r border-stone-200/80 bg-[var(--app-sidebar)] backdrop-blur transition-all duration-300 dark:border-[#2f2b28] dark:bg-[var(--app-sidebar)] ${
        isCollapsed ? 'w-[78px] items-center' : 'w-[286px]'
      }`}
    >
      <div
        className={`border-b border-stone-200/80 dark:border-[#2f2b28] ${
          isCollapsed
            ? 'flex w-full flex-col items-center px-0 py-3'
            : 'flex items-center justify-between px-4 py-5'
        }`}
      >
        {isCollapsed ? (
          !isCompact && (
            <button
              onClick={toggleSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-stone-200/80 bg-white/82 text-stone-500 transition hover:bg-white hover:text-stone-900 dark:border-[#3b342e] dark:bg-[#26211d] dark:text-stone-400 dark:hover:bg-[#2f2925] dark:hover:text-stone-100"
              title={t('app.sidebar.expand')}
            >
              <ChevronRight size={16} />
            </button>
          )
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[20px] border border-stone-200/80 bg-white/90 text-[var(--app-accent)] shadow-[0_10px_30px_rgba(47,31,21,0.08)] dark:border-[#3f3832] dark:bg-[#231f1c]">
                <LifeBuoy size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.28em] text-stone-500 dark:text-stone-400">
                  Service Desk
                </p>
                <h1 className="truncate font-serif text-xl font-semibold text-stone-900 dark:text-stone-100">
                  {isChinese ? '客服知识助手' : 'KnowDesk'}
                </h1>
              </div>
            </div>

            {!isCompact && (
              <button
                onClick={toggleSidebar}
                className="rounded-2xl p-2 text-stone-500 transition hover:bg-white/80 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-[#2b2622] dark:hover:text-stone-100"
                title={t('app.sidebar.collapse')}
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </>
        )}
      </div>

      {!isCollapsed && (
        <div className="mx-4 mt-4 rounded-[26px] border border-stone-200/80 bg-white/78 p-4 shadow-[0_16px_36px_rgba(50,35,23,0.05)] dark:border-[#3b342e] dark:bg-[#211d19]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--app-accent)]">
            Workspace
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">
            {sidebarSummary}
          </p>
        </div>
      )}

      <nav
        className={`flex-1 ${
          isCollapsed ? 'flex w-full justify-center px-0 py-5' : 'space-y-2 px-3 py-5'
        }`}
      >
        <div
          className={
            isCollapsed
              ? 'flex flex-col items-center gap-3 rounded-[28px] border border-stone-200/70 bg-white/44 p-2 shadow-[0_14px_34px_rgba(50,35,23,0.06)] dark:border-[#3b342e] dark:bg-[#211d19]'
              : 'space-y-2'
          }
        >
          {navItems.map((item) => {
            const isUploadAction = item.id === 'upload';
            const isActive = view === item.id && !isUploadAction;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => (isUploadAction ? onUploadClick?.() : setView(item.id))}
                className={`group relative flex w-full items-center gap-3 rounded-[22px] border px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'border-stone-200 bg-white text-stone-950 shadow-[0_12px_30px_rgba(50,35,23,0.08)] dark:border-[#45403a] dark:bg-[#2a2521] dark:text-stone-100'
                    : 'border-transparent text-stone-600 hover:border-stone-200/70 hover:bg-white/78 hover:text-stone-900 dark:text-stone-400 dark:hover:border-[#3b342e] dark:hover:bg-[#2b2622] dark:hover:text-stone-100'
                } ${isCollapsed ? 'h-12 w-12 justify-center rounded-[18px] px-0 py-0' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  size={18}
                  className={`shrink-0 ${isActive ? 'text-[var(--app-accent)]' : ''}`}
                />
                {!isCollapsed && <span className="truncate text-left">{item.label}</span>}
                {isCollapsed && <span className={tooltipClass}>{item.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      <div
        className={`border-t border-stone-200/80 dark:border-[#2f2b28] ${
          isCollapsed ? 'flex w-full flex-col items-center gap-2 px-0 py-4' : 'px-3 py-3'
        }`}
      >
        <button
          onClick={toggleTheme}
          className={`group flex w-full items-center gap-3 rounded-[20px] border border-transparent px-4 py-3 text-sm font-medium text-stone-600 transition hover:border-stone-200/70 hover:bg-white/70 hover:text-stone-900 dark:text-stone-400 dark:hover:border-[#3b342e] dark:hover:bg-[#2b2622] dark:hover:text-stone-100 ${
            isCollapsed
              ? 'h-11 w-11 justify-center rounded-[18px] px-0 py-0 hover:bg-white/78 dark:hover:bg-[#2b2622]'
              : 'mb-2'
          }`}
          title={
            isCollapsed
              ? theme === 'dark'
                ? t('app.theme.light')
                : t('app.theme.dark')
              : undefined
          }
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {!isCollapsed && (
            <span>{theme === 'dark' ? t('app.theme.light') : t('app.theme.dark')}</span>
          )}
          {isCollapsed && (
            <span className={tooltipClass}>
              {theme === 'dark' ? t('app.theme.light') : t('app.theme.dark')}
            </span>
          )}
        </button>

        <button
          onClick={toggleLanguage}
          className={`group flex w-full items-center gap-3 rounded-[20px] border border-transparent px-4 py-3 text-sm font-medium text-stone-600 transition hover:border-stone-200/70 hover:bg-white/70 hover:text-stone-900 dark:text-stone-400 dark:hover:border-[#3b342e] dark:hover:bg-[#2b2622] dark:hover:text-stone-100 ${
            isCollapsed
              ? 'h-11 w-11 justify-center rounded-[18px] px-0 py-0 hover:bg-white/78 dark:hover:bg-[#2b2622]'
              : ''
          }`}
          title={
            isCollapsed
              ? isChinese
                ? t('app.language.english')
                : t('app.language.chinese')
              : undefined
          }
        >
          <Languages size={18} />
          {!isCollapsed && (
            <span>{isChinese ? t('app.language.english') : t('app.language.chinese')}</span>
          )}
          {isCollapsed && (
            <span className={tooltipClass}>
              {isChinese ? t('app.language.english') : t('app.language.chinese')}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};
