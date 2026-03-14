import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Save, Trash2, FileText, Eye, Edit3, CheckCircle, AlertCircle, ChevronDown, Sparkles, Loader2, X, Copy, Check, RefreshCw } from 'lucide-react';
import type { DraftOutlineSlide, DraftSlideImage, DraftSolution } from '../types/solution';
import { useToast } from '../contexts/ToastContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface GenerationProgress {
  total: number;
  completed: number;
  failed: number;
  slides: Record<string, { status: string; url: string | null; error: string | null }>;
}

const SLIDE_LAYOUT_OPTIONS = [
  { key: '', name: 'Auto' },
  { key: 'left-circle', name: 'Left Circle' },
  { key: 'right-rounded', name: 'Right Rounded' },
  { key: 'top-banner', name: 'Top Banner' },
  { key: 'left-float', name: 'Left Float' },
  { key: 'text-only', name: 'Text Only' },
  { key: 'right-circle', name: 'Right Circle' },
];

// Available PPT styles
const PPT_STYLES = [
  { key: 'minimal', name: 'Minimal', icon: 'M', recommended: true },
  { key: 'corporate', name: 'Corporate', icon: 'C' },
  { key: 'blueprint', name: 'Blueprint', icon: 'B' },
  { key: 'sketch', name: 'Sketch', icon: 'S' },
  { key: 'editorial', name: 'Editorial', icon: 'E' },
  { key: 'chalkboard', name: 'Chalkboard', icon: 'K' },
  { key: 'notion', name: 'Notion', icon: 'N' },
  { key: 'darkAtmospheric', name: 'Dark', icon: 'D' },
  { key: 'editorialInfographic', name: 'Infographic', icon: 'I' },
  { key: 'fantasyAnimation', name: 'Fantasy', icon: 'F' },
  { key: 'intuitionMachine', name: 'Intuition', icon: 'T' },
  { key: 'pixelArt', name: 'Pixel Art', icon: 'P' },
  { key: 'scientific', name: 'Scientific', icon: 'Q' },
  { key: 'vectorIllustration', name: 'Vector', icon: 'V' },
  { key: 'vintage', name: 'Vintage', icon: 'G' },
  { key: 'watercolor', name: 'Watercolor', icon: 'W' },
  { key: 'boldEditorial', name: 'Bold Editorial', icon: 'O' },
];

interface SolutionEditorProps {
  draftId?: string;
  draft?: DraftSolution;
  onBack: () => void;
  onDelete?: (id: string) => void;
}

export const SolutionEditor: React.FC<SolutionEditorProps> = ({
  draftId,
  draft: initialDraft,
  onBack,
  onDelete
}) => {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<DraftSolution | null>(initialDraft || null);
  const [content, setContent] = useState(initialDraft?.content || '');
  const [title, setTitle] = useState(initialDraft?.title || '');
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'unsaved'>('idle');
  const [selectedStyle, setSelectedStyle] = useState('minimal');
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false);
  const [optimizePreview, setOptimizePreview] = useState<any>(null);
  const [isApplyingOptimization, setIsApplyingOptimization] = useState(false);
  const [showSampleDialog, setShowSampleDialog] = useState(false);
  const [sampleImages, setSampleImages] = useState<any[]>([]);
  const [isGeneratingSamples, setIsGeneratingSamples] = useState(false);
  const [slideActionState, setSlideActionState] = useState<Record<number, { layout: boolean; image: boolean }>>({});

  // Detect changes
  useEffect(() => {
    const contentChanged = content !== (draft?.content || '');
    const titleChanged = title !== (draft?.title || '');
    setHasChanges(contentChanged || titleChanged);
    setSaveStatus(contentChanged || titleChanged ? 'unsaved' : 'saved');
  }, [content, title, draft]);

  // Load draft if draftId is provided
  useEffect(() => {
    if (draftId && !initialDraft) {
      loadDraft(draftId);
    }
  }, [draftId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Auto-generate samples when outline is ready and no samples exist
  useEffect(() => {
    const outline = draft?.outline;

    if (!draft || !outline?.slides || outline.slides.length === 0) return;

    const hasSamples = Boolean(draft.sampleImages && draft.sampleImages.length > 0);
    const wasJustOptimized = draft.status === 'outline' && !hasSamples;

    if (!hasSamples && wasJustOptimized && !isGeneratingSamples) {
      const timer = setTimeout(() => {
        generateSamples(draft.currentStyle || 'minimal');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [draft?.outline, draft?.status, draft?.sampleImages]);

  const outlineSlides = useMemo<DraftOutlineSlide[]>(() => {
    return Array.isArray(draft?.outline?.slides) ? draft.outline.slides : [];
  }, [draft?.outline]);

  const slideImageMap = useMemo(() => {
    const map = new Map<number, DraftSlideImage>();
    const images = Array.isArray(draft?.slideImages) ? draft.slideImages : [];

    for (const image of images) {
      map.set(image.number, image);
    }

    return map;
  }, [draft?.slideImages]);

  const loadDraft = async (id: string) => {
    try {
      const response = await fetch(`/api/drafts/${id}`);
      if (!response.ok) throw new Error('Failed to load draft');

      const loadedDraft: DraftSolution = await response.json();
      setDraft(loadedDraft);
      setContent(loadedDraft.content);
      setTitle(loadedDraft.title);
    } catch (error) {
      console.error('Load draft error:', error);
      showToast('加载草稿失败', 'error');
    }
  };

  const setSlideActionBusy = (slideNumber: number, action: 'layout' | 'image', busy: boolean) => {
    setSlideActionState((prev) => ({
      ...prev,
      [slideNumber]: {
        layout: action === 'layout' ? busy : Boolean(prev[slideNumber]?.layout),
        image: action === 'image' ? busy : Boolean(prev[slideNumber]?.image)
      }
    }));
  };

  const canRegenerateSlideImage = (slide: DraftOutlineSlide) => {
    if (slide.preferredLayout === 'text-only') return false;
    return !['section', 'section-divider', 'closing'].includes(slide.type);
  };

  const handleSlideLayoutChange = async (slideNumber: number, preferredLayout: string) => {
    if (!draft) return;

    setSlideActionBusy(slideNumber, 'layout', true);

    try {
      const response = await fetch(`/api/drafts/${draft.id}/slides/${slideNumber}/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLayout })
      });

      if (!response.ok) throw new Error('Failed to update slide layout');

      const data = await response.json();
      setDraft(data.draft);
      showToast(preferredLayout ? 'Slide layout updated' : 'Slide layout reset', 'success');
    } catch (error) {
      console.error('Update slide layout error:', error);
      showToast('Failed to update slide layout', 'error');
    } finally {
      setSlideActionBusy(slideNumber, 'layout', false);
    }
  };

  const handleRegenerateSlideImage = async (slideNumber: number) => {
    if (!draft) return;

    setSlideActionBusy(slideNumber, 'image', true);

    try {
      const response = await fetch(`/api/drafts/${draft.id}/slides/${slideNumber}/regenerate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style: selectedStyle || draft.currentStyle || 'minimal' })
      });

      if (!response.ok) throw new Error('Failed to regenerate slide image');

      const data = await response.json();
      setDraft(data.draft);
      showToast(`Slide ${slideNumber} image regenerated`, 'success');
    } catch (error) {
      console.error('Regenerate slide image error:', error);
      showToast('Failed to regenerate slide image', 'error');
    } finally {
      setSlideActionBusy(slideNumber, 'image', false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch(`/api/drafts/${draft.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });

      if (!response.ok) throw new Error('Failed to save draft');

      const updatedDraft: DraftSolution = await response.json();
      setDraft(updatedDraft);
      setSaveStatus('saved');
      showToast('保存鎴愬姛', 'success');
    } catch (error) {
      console.error('Save draft error:', error);
      showToast('保存失败', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = (format: 'md' | 'txt') => {
    if (!draft) return;

    let contentToExport = content;
    let filename = `${title}.${format}`;
    let mimeType = 'text/markdown';

    if (format === 'txt') {
      mimeType = 'text/plain';
    }

    const blob = new Blob([contentToExport], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`已导出为 ${format.toUpperCase()}`, 'success');
  };

  const handleCopyOutline = async () => {
    if (!draft) return;

    try {
      let jsonToCopy = '';

      // Try to get from draft.outline first
      if (draft.outline) {
        jsonToCopy = JSON.stringify(draft.outline, null, 2);
      } else {
        // Extract JSON from content if it contains a code block
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonToCopy = jsonMatch[1].trim();
        } else {
          // Try to parse content as JSON directly
          try {
            const parsed = JSON.parse(content);
            jsonToCopy = JSON.stringify(parsed, null, 2);
          } catch {
            jsonToCopy = content;
          }
        }
      }

      // Use fallback method for better compatibility
      let success = false;

      // Method 1: Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(jsonToCopy);
          success = true;
        } catch (clipboardError) {
          console.warn('Clipboard API failed, trying fallback:', clipboardError);
        }
      }

      // Method 2: Fallback using document.execCommand
      if (!success) {
        const textArea = document.createElement('textarea');
        textArea.value = jsonToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          const successful = document.execCommand('copy');
          success = successful;
        } catch (execError) {
          console.warn('execCommand failed:', execError);
        } finally {
          document.body.removeChild(textArea);
        }
      }

      if (success) {
        setCopySuccess(true);
        showToast('JSON copied to clipboard', 'success');
        setTimeout(() => setCopySuccess(false), 2000);
      } else {
        throw new Error('All copy methods failed');
      }
    } catch (error) {
      console.error('Copy outline error:', error);
      showToast('复制失败，请手动复制', 'error');
    }
  };

  const getOptimizePreview = async () => {
    if (!draft?.outline) return;

    try {
      showToast('正在分析 outline...', 'info');

      const response = await fetch(`/api/drafts/${draft.id}/optimize-preview`);
      if (!response.ok) throw new Error('获取预览失败');

      const preview = await response.json();
      setOptimizePreview(preview);
      setShowOptimizeDialog(true);
    } catch (error) {
      console.error('Get optimize preview error:', error);
      showToast('获取预览失败', 'error');
    }
  };

  // 应用优化
  const applyOptimization = async () => {
    if (!draft) return;

    try {
      setIsApplyingOptimization(true);
      showToast('正在应用优化...', 'info');

      const response = await fetch(`/api/drafts/${draft.id}/apply-optimization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('应用优化失败');

      const updatedDraft = await response.json();
      setDraft(updatedDraft);
      setShowOptimizeDialog(false);

      showToast('优化已应用，正在重新生成样本...', 'success');

      // 自动重新生成样本图片
      setTimeout(() => {
        generateSamples(updatedDraft.currentStyle || 'minimal');
      }, 500);

    } catch (error) {
      console.error('Apply optimization error:', error);
      showToast('应用优化失败', 'error');
    } finally {
      setIsApplyingOptimization(false);
    }
  };

  const optimizeOutline = async (): Promise<boolean> => {
    if (!draft?.outline) return false;

    try {
      const response = await fetch(`/api/drafts/${draft.id}/apply-optimization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('优化失败');

      const result = await response.json();
      setDraft(result);
      return true;
    } catch (error) {
      console.error('Optimize outline error:', error);
      return false;
    }
  };

  // 生成样本图片
  void optimizeOutline;

  const generateSamples = async (style: string = 'minimal') => {
    if (!draft?.outline) return;

    try {
      setIsGeneratingSamples(true);
      showToast('正在生成样本图片...', 'info');

      const response = await fetch(`/api/drafts/${draft.id}/generate-samples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style, count: 3 })
      });

      if (!response.ok) throw new Error('生成样本失败');

      const data = await response.json();
      setSampleImages(data.samples);
      setShowSampleDialog(true);
      showToast('样本图片生成完成', 'success');

      // Update draft with sample images
      setDraft(prev => prev ? { ...prev, sampleImages: data.samples } : null);
    } catch (error) {
      console.error('Generate samples error:', error);
      showToast('生成样本失败', 'error');
    } finally {
      setIsGeneratingSamples(false);
    }
  };

  // 从样本对话框继续生成全部
  const handleContinueGeneration = async () => {
    setShowSampleDialog(false);
    if (draft) {
      await startImageGeneration(draft.currentStyle || 'minimal');
    }
  };

  const handleOptimizeFromSamples = async () => {
    setShowSampleDialog(false);
    await getOptimizePreview();
  };

  const handleExportPPT = async (style: string) => {
    if (!draft) return;

    try {
      showToast('正在准备生成 PPT...', 'info');

      // Step 1: Check if export or generation is needed
      const response = await fetch(`/api/drafts/${draft.id}/export-ppt?style=${style}&useStyled=true`);

      if (!response.ok) {
        throw new Error('导出失败');
      }

      // Check response content type
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        // JSON response means generation is needed
        const data = await response.json();
        if (data.status === 'generating') {
          // Start image generation process
          await startImageGeneration(style);
          return;
        }
      }

      // If we get here, it's a blob response (PPT ready)
      const blob = await response.blob();
      downloadPPT(blob);
      showToast('PPT exported successfully', 'success');

    } catch (error) {
      console.error('Export PPT error:', error);
      showToast('PPT 导出失败', 'error');
      setIsGenerating(false);
      setShowProgressDialog(false);
    }
  };

  const startImageGeneration = async (style: string) => {
    if (!draft) return;

    setIsGenerating(true);
    setShowProgressDialog(true);
    setShowStyleMenu(false);

    try {
      // Trigger the generation - send style in request body
      const genResponse = await fetch(`/api/drafts/${draft.id}/generate-slides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ style })
      });

      if (!genResponse.ok) {
        throw new Error('启动生成失败');
      }

      const genData = await genResponse.json();
      setGenerationProgress({
        total: genData.totalSlides || 0,
        completed: 0,
        failed: 0,
        slides: {}
      });

      // Start polling for progress
      pollProgress(style);

    } catch (error) {
      console.error('Start generation error:', error);
      showToast('启动图片生成失败', 'error');
      setIsGenerating(false);
      setShowProgressDialog(false);
    }
  };

  const pollProgress = (style: string) => {
    if (!draft) return;

    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/drafts/${draft.id}/progress`);
        if (!response.ok) return;

        const data = await response.json();
        setGenerationProgress(data.progress);

        // Check if generation is complete
        if (data.status === 'completed') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;

          setIsGenerating(false);
          showToast('图片生成完成，正在下载 PPT...', 'success');

          // Wait a moment then download
          setTimeout(async () => {
            await downloadPPTAfterGeneration(style);
          }, 500);
        } else if (data.status === 'failed') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setIsGenerating(false);
          showToast('图片生成失败，请重试', 'error');
        }

      } catch (error) {
        console.error('Poll progress error:', error);
      }
    }, 1000); // Poll every second
  };

  const downloadPPTAfterGeneration = async (style: string) => {
    if (!draft) return;

    try {
      const response = await fetch(`/api/drafts/${draft.id}/export-ppt?style=${style}&useStyled=true`);
      if (!response.ok) throw new Error('下载失败');

      const blob = await response.blob();
      downloadPPT(blob);

      // Reload draft to get updated slideImages
      await loadDraft(draft.id);

      showToast('PPT exported successfully', 'success');
      setShowProgressDialog(false);

    } catch (error) {
      console.error('Download PPT error:', error);
      showToast('下载 PPT 失败', 'error');
    }
  };

  const downloadPPT = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const cancelGeneration = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsGenerating(false);
    setShowProgressDialog(false);
    setGenerationProgress(null);
    showToast('Generation cancelled', 'info');
  };

  const handleDelete = () => {
    if (!draft || !onDelete) return;

    if (confirm(`确定要删除方案 "${draft.title}" 吗？`)) {
      onDelete(draft.id);
    }
  };

  // Calculate content statistics
  const contentStats = useMemo(() => {
    const words = content.length;
    const lines = content.split('\n').length;
    const paragraphs = content.split('\n\n').filter(p => p.trim()).length;
    const chars = content.replace(/\s/g, '').length;
    return { words, lines, paragraphs, chars };
  }, [content]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !isSaving) {
          handleSave();
        }
      }
      // Escape to go back
      if (e.key === 'Escape' && !hasChanges) {
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, isSaving]);

  if (!draft) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 border-4 border-amber-200 dark:border-amber-800 border-t-amber-600 dark:border-t-amber-500 rounded-full animate-spin mb-4"></div>
          <p className="text-neutral-400 dark:text-neutral-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="p-2.5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all shrink-0"
            title={hasChanges ? 'Unsaved changes' : 'Back'}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-lg flex items-center justify-center">
                <FileText size={16} className="text-amber-600 dark:text-amber-500" />
              </div>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                draft.status === 'outline' || draft.status === 'draft'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  : draft.status === 'generating'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              }`}>
                {draft.status === 'outline' || draft.status === 'draft'
                  ? 'Draft'
                  : draft.status === 'generating'
                  ? 'Generating'
                  : 'Completed'}
              </span>
              {/* Save Status */}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle size={12} />
                  已保存                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle size={12} />
                  未保存                </span>
              )}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-serif text-neutral-900 dark:text-white font-medium bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full"
              placeholder="方案标题..."
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'edit'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <Edit3 size={16} />
              编辑
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'preview'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <Eye size={16} />
              预览
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
              hasChanges
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-500/20'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
            }`}
          >
            <Save size={16} className={isSaving ? 'animate-spin' : ''} />
            {isSaving ? '保存中...' : '保存'}
          </button>

          {/* Optimize and Regenerate Button */}
          <button
            onClick={getOptimizePreview}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all shadow-md shadow-emerald-500/20"
            title='Optimize outline and regenerate images'
          >
            <Sparkles size={16} />
            Optimize
          </button>

          {/* Export Dropdown with Style Selection */}
          <div className="relative">
            <button
              onClick={() => setShowStyleMenu(!showStyleMenu)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-medium transition-all shadow-md shadow-amber-500/20"
            >
              <Sparkles size={16} />
              生成 PPT
              <ChevronDown size={14} className={`transition-transform ${showStyleMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Style Selection Menu */}
            {showStyleMenu && (
              <div className="absolute right-0 mt-2 w-72 max-h-[400px] overflow-y-auto bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 z-50">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-neutral-800 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">Select PPT Style</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Choose one of the available styles</p>
                </div>

                {/* Style Grid */}
                <div className="p-3 grid grid-cols-2 gap-2">
                  {PPT_STYLES.map((style) => (
                    <button
                      key={style.key}
                      onClick={() => {
                        setSelectedStyle(style.key);
                        setShowStyleMenu(false);
                        handleExportPPT(style.key);
                      }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg text-center transition-all ${
                        selectedStyle === style.key
                          ? 'bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-600'
                          : 'bg-neutral-50 dark:bg-neutral-700/50 border-2 border-transparent hover:border-amber-200 dark:hover:border-amber-800/50'
                      }`}
                    >
                      <span className="text-2xl">{style.icon}</span>
                      <div>
                        <p className="text-xs font-medium text-neutral-900 dark:text-white">{style.name}</p>
                        {style.recommended && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">鎺ㄨ崘</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div className="border-t border-neutral-200 dark:border-neutral-700"></div>

                {/* Quick Export Section */}
                <div className="p-2">
                  <div className="px-3 py-1.5 text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide font-medium">
                    快速导出                  </div>
                  <button
                    onClick={() => {
                      handleExport('md');
                      setShowStyleMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all flex items-center gap-3 rounded-lg"
                  >
                    <span className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">MD</span>
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">Markdown</p>
                      <p className="text-xs text-neutral-400">标准格式</p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      handleExport('txt');
                      setShowStyleMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all flex items-center gap-3 rounded-lg"
                  >
                    <span className="w-8 h-8 bg-gray-100 dark:bg-gray-900/30 rounded-lg flex items-center justify-center">
                      <span className="text-gray-600 dark:text-gray-400 font-bold text-xs">TXT</span>
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">Plain Text</p>
                      <p className="text-xs text-neutral-400">通用格式</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Delete Button */}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
              title="删除方案"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Draft Info Bar */}
      <div className="flex items-center justify-between mb-4 px-4 py-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl text-xs">
        <div className="flex items-center gap-4 text-neutral-500 dark:text-neutral-400">
          <span>ID: {draft.id.slice(0, 8)}</span>
          <span>鐗堟湰: {draft.version}</span>
          <span>鍒涘缓浜? {new Date(draft.createdAt).toLocaleDateString('zh-CN')}</span>
        </div>
        {draft.industry && (
          <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-md font-medium">
            {draft.industry}
          </span>
        )}
      </div>

      {outlineSlides.length > 0 && (
        <div className="mb-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">逐页控制</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                调整布局或重新生成单页幻灯片图片
              </p>
            </div>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {outlineSlides.length} 页
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
            {outlineSlides.map((slide, index) => {
              const slideNumber = slide.number || index + 1;
              const slideImage = slideImageMap.get(slideNumber);
              const slideState = slideActionState[slideNumber];

              return (
                <div key={`${slideNumber}-${slide.filename || index}`} className="px-4 py-3">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500">#{slideNumber}</span>
                        <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400">
                          {slide.type}
                        </span>
                        {slideImage?.url ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-[11px] text-green-700 dark:text-green-400">
                            image ready
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400">
                            no image
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                        {slide.keyContent?.headline || slide.title || slide.filename || `Slide ${slideNumber}`}
                      </p>
                      {slide.keyContent?.body && slide.keyContent.body.length > 0 && (
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 truncate">
                          {slide.keyContent.body[0]}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 lg:min-w-[340px]">
                      <select
                        value={slide.preferredLayout || ''}
                        onChange={(e) => void handleSlideLayoutChange(slideNumber, e.target.value)}
                        disabled={Boolean(slideState?.layout)}
                        className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200"
                      >
                        {SLIDE_LAYOUT_OPTIONS.map((option) => (
                          <option key={option.key || 'auto'} value={option.key}>
                            {option.name}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => void handleRegenerateSlideImage(slideNumber)}
                        disabled={!canRegenerateSlideImage(slide) || Boolean(slideState?.image)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {slideState?.image ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        Regenerate Image
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content Editor / Preview */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-lg overflow-hidden">
        {viewMode === 'edit' ? (
          /* Edit Mode */
          <div className="relative">
            {/* Copy Button (top right) */}
            <button
              onClick={handleCopyOutline}
              className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 transition-all shadow-sm"
              title="复制 JSON"
            >
              {copySuccess ? (
                <>
                  <Check size={14} className="text-green-600" />
                  <span className="text-green-600 dark:text-green-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>复制 JSON</span>
                </>
              )}
            </button>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-[calc(100vh-320px)] min-h-[400px] p-6 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono text-sm leading-relaxed focus:outline-none resize-none"
              placeholder="Solution outline..."










              spellCheck={false}
            />
            {/* Character Count (bottom right) */}
            <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              {contentStats.words} 字 | {contentStats.lines} 行 | {contentStats.paragraphs} 段            </div>
          </div>
        ) : (
          /* Preview Mode */
          <div className="h-[calc(100vh-320px)] min-h-[400px] overflow-y-auto">
            <div className="document-content prose prose-neutral dark:prose-invert max-w-none p-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || '# ' + title + '\n\n暂无内容...'}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Requirements Info (Read-only) */}
      {draft.requirements && (
        <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-sm">📋</span>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
                原始需求              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-400/90 leading-relaxed">
                {draft.requirements}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Hint */}
      <div className="mt-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
        <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md">Ctrl+S</span> 保存 ·
        <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md ml-2">Esc</span> 返回
      </div>

      {/* Generation Progress Modal */}
      {showProgressDialog && generationProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-neutral-200 dark:border-dark-border">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700">
              <div className="flex items-center gap-3">
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5 text-white" />
                )}
                <div>
                  <h3 className="text-lg font-semibold text-white font-serif">Generate PPT Slides</h3>
                  <p className="text-xs text-amber-100 opacity-90">Generating AI slide images</p>
                </div>
              </div>
              {!isGenerating && (
                <button
                  onClick={() => setShowProgressDialog(false)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Progress Bar */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-sm font-medium text-neutral-700 dark:text-dark-text">
                    生成进度
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-500 font-serif">
                      {generationProgress.completed}
                    </span>
                    <span className="text-neutral-400 dark:text-dark-muted">/</span>
                    <span className="text-sm text-neutral-500 dark:text-dark-muted">
                      {generationProgress.total}
                    </span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-neutral-100 dark:bg-dark-bg rounded-full overflow-hidden border border-neutral-200 dark:border-dark-border">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-600 dark:from-amber-500 dark:to-amber-600 transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(100, (generationProgress.completed / generationProgress.total) * 100)}%`
                    }}
                  />
                </div>
                <div className="mt-2 text-right">
                  <span className="text-xs text-neutral-400 dark:text-dark-muted">
                    {Math.round((generationProgress.completed / generationProgress.total) * 100)}% 完成
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className={`mb-5 p-4 rounded-xl border ${
                isGenerating
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30'
                  : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30'
              }`}>
                <div className="flex items-start gap-3">
                  {isGenerating ? (
                    <Loader2 className="w-5 h-5 text-amber-600 dark:text-amber-500 animate-spin flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${
                      isGenerating
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-green-700 dark:text-green-400'
                    }`}>
                      {isGenerating ? 'Generating slide images, please wait...' : 'Generation complete. PPT download will start automatically.'}
                    </p>
                    {!isGenerating && (
                      <p className="text-xs text-neutral-500 dark:text-dark-muted mt-1">
                        已完成 {generationProgress.completed} 张幻灯片图片生成
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Slide Progress List */}
              {generationProgress.total > 0 && (
                <div className="max-h-44 overflow-y-auto mb-5 space-y-1.5 pr-1">
                  {Object.entries(generationProgress.slides || {}).map(([filename, info]) => (
                    <div
                      key={filename}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        info.status === 'completed'
                          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30'
                          : info.status === 'generating'
                          ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30'
                          : info.status === 'failed'
                          ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'
                          : 'bg-neutral-50 dark:bg-dark-bg border-neutral-200 dark:border-dark-border'
                      }`}
                    >
                      <span className={`text-xs truncate flex-1 mr-3 ${
                        info.status === 'completed'
                          ? 'text-green-700 dark:text-green-400'
                          : info.status === 'generating'
                          ? 'text-amber-700 dark:text-amber-400'
                          : info.status === 'failed'
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-neutral-600 dark:text-dark-muted'
                      }`}>
                        {filename.replace(/\.(png|jpg|jpeg)$/i, '')}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {info.status === 'completed' && (
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-[10px] font-medium">完成</span>
                          </div>
                        )}
                        {info.status === 'generating' && (
                          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-[10px] font-medium">Working</span>
                          </div>
                        )}
                        {info.status === 'failed' && (
                          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-[10px] font-medium">失败</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Cancel Button (only show during generation) */}
              {isGenerating && (
                <button
                  onClick={cancelGeneration}
                  className="w-full py-2.5 px-4 bg-neutral-100 dark:bg-dark-bg hover:bg-neutral-200 dark:hover:bg-dark-border text-neutral-700 dark:text-dark-text rounded-xl transition-all font-medium text-sm border border-neutral-200 dark:border-dark-border"
                >
                  取消生成
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sample Preview Dialog */}
      {showSampleDialog && sampleImages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-bg rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600">
              <div className="flex items-center gap-3">
                <Eye className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-lg font-semibold text-white">样本图片预览</h3>
                  <p className="text-xs text-blue-100 opacity-90">
                    预览效果，决定是否继续生成或优化
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSampleDialog(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sampleImages.map((sample, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    {/* Slide Image */}
                    <div className="aspect-video bg-white dark:bg-dark-bg relative">
                      {sample.url ? (
                        <img
                          src={sample.url}
                          alt={`样本 ${sample.slideNumber}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-slate-300 dark:text-slate-600 animate-spin" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded">
                        #{sample.slideNumber}
                      </div>
                      <div className="absolute top-2 right-2 px-2 py-1 bg-blue-600/90 text-white text-xs font-medium rounded">
                        {sample.type}
                      </div>
                    </div>

                    {/* Slide Info */}
                    <div className="p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Visual 描述</div>
                      <div className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2">
                        {sample.visual}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tip */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  💡 这是基于当前 outline 生成的样本图片。如果您满意效果，点击"继续生成全部"；如果需要改进，点击"优化 outline"。
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={handleOptimizeFromSamples}
                className="px-5 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all border border-emerald-200 dark:border-emerald-800/30"
              >
                优化 outline
              </button>
              <button
                onClick={handleContinueGeneration}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-medium transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    继续生成全部
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optimization Preview Dialog */}
      {showOptimizeDialog && optimizePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-bg rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-lg font-semibold text-white">Outline Review and Optimization</h3>
                  <p className="text-xs text-emerald-100 opacity-90">
                    Found {optimizePreview.changeCount} suggested changes.</p>
                </div>
              </div>
              <button
                onClick={() => setShowOptimizeDialog(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Score Card */}
              <div className="mb-6 p-5 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">质量评分</h4>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                    optimizePreview.evaluation.totalScore >= 90
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : optimizePreview.evaluation.totalScore >= 70
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {optimizePreview.evaluation.totalScore}/100
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-dark-bg rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Visual 质量</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      {optimizePreview.evaluation.scores.visualQuality}<span className="text-sm text-slate-400">/40</span>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-dark-bg rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">页面类型</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      {optimizePreview.evaluation.scores.pageTypeDistribution}<span className="text-sm text-slate-400">/25</span>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-dark-bg rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">内容逻辑</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      {optimizePreview.evaluation.scores.contentLogic}<span className="text-sm text-slate-400">/20</span>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-dark-bg rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">风格匹配</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      {optimizePreview.evaluation.scores.styleMatching}<span className="text-sm text-slate-400">/15</span>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                  {optimizePreview.evaluation.summary}
                </p>
              </div>

              {/* Issues List */}
              {optimizePreview.evaluation.issues.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">发现的问题</h4>
                  <div className="space-y-2">
                    {optimizePreview.evaluation.issues.map((issue: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          issue.severity === 'high'
                            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'
                            : issue.severity === 'medium'
                            ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30'
                            : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {issue.severity === 'high' && <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />}
                          {issue.severity === 'medium' && <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />}
                          {issue.severity === 'low' && <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            {issue.slideNumber > 0 && (
                              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 mr-2">
                                #{issue.slideNumber}
                              </span>
                            )}
                            <p className="text-sm text-slate-700 dark:text-slate-200">{issue.description}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">建议: {issue.suggestion}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Changes Preview */}
              {optimizePreview.changes.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">优化预览</h4>
                  <div className="space-y-3">
                    {optimizePreview.changes.map((change: any, idx: number) => (
                      <div key={idx} className="bg-white dark:bg-dark-bg rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            页 #{change.slideNumber} · {change.slideType}
                          </span>
                        </div>
                        <div className="p-3 space-y-2">
                          {change.changes.map((c: any, cIdx: number) => (
                            <div key={cIdx}>
                              <div className="text-xs text-slate-400 dark:text-slate-500 mb-1">{c.field}</div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-red-50 dark:bg-red-900/10 rounded p-2 border border-red-200 dark:border-red-800/30">
                                  <div className="text-[10px] text-red-600 dark:text-red-400 mb-1">Before</div>
                                  <div className="text-xs text-slate-700 dark:text-slate-200 break-all line-clamp-2">
                                    {c.original}
                                  </div>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/10 rounded p-2 border border-green-200 dark:border-green-800/30">
                                  <div className="text-[10px] text-green-600 dark:text-green-400 mb-1">After</div>
                                  <div className="text-xs text-slate-700 dark:text-slate-200 break-all line-clamp-2">
                                    {c.optimized}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowOptimizeDialog(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all"
              >
                取消
              </button>
              <button
                onClick={applyOptimization}
                disabled={isApplyingOptimization}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplyingOptimization ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    应用中...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    应用优化
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
