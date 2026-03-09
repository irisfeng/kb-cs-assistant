export interface Solution {
  id: string;
  title: string;
  description: string;
  collectionId: string;
  fileName: string;
  fileId?: string;
  originalFilePath?: string;
  createdAt?: string;
  datasetId?: string;
  knowledgeSubmissionId?: string;
  securityLevel?: string;
  audienceScope?: string;
  importScope?: string;
  productLine?: string;
  productName?: string;
  version?: string;
}

export type KnowledgeSubmissionStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'BLOCKED'
  | 'PUBLISHED';

export interface KnowledgeSubmission {
  id: string;
  title: string;
  description: string;
  fileName: string;
  extension: string;
  originalFilePath: string;
  productLine: string;
  productName: string;
  documentType: string;
  effectiveDate: string;
  version: string;
  versionRank: number;
  securityLevel: string;
  audienceScope: string;
  importScope: string;
  recommendedAction: string;
  sensitiveSignals: string[];
  extractError: string;
  preview: string;
  submittedByRole: string;
  status: KnowledgeSubmissionStatus;
  reviewNote: string;
  submittedAt: string;
  reviewedAt: string;
  reviewedBy?: string;
  publishedAt: string;
  publishedSolutionId: string;
  collectionId?: string;
  datasetId?: string;
}

export interface SolutionDetail extends Solution {
  fastgptDetail?: {
    _id: string;
    name: string;
    type: string;
    trainingType: string;
    createdAt: string;
  } | null;
}

export interface DocumentChunk {
  _id: string;
  q: string;
  a?: string;
  chunkIndex?: number;
}

export interface PreviewData {
  text: string;
  chunks: DocumentChunk[];
  chunkCount: number;
  source?: 'local' | 'fastgpt';
}

export interface Citation {
  id: string;
  q: string;
  a?: string;
  score?: number;
  source?: string;
  sourceName?: string;
  fileName?: string;
  collectionId?: string;
  chunkIndex?: number;
}

export interface EnhancedCitation extends Citation {
  solutionId?: string;
  solutionTitle?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: EnhancedCitation[];
  relatedSolutions?: string[];
  timestamp?: string;
}

export type ViewMode =
  | 'solutions'
  | 'upload'
  | 'solution-detail'
  | 'capabilities'
  | 'governance';

export interface DraftOutlineSlide {
  number: number;
  type: string;
  filename?: string;
  title?: string;
  visual?: string;
  preferredLayout?: string;
  keyContent?: {
    headline?: string;
    subHeadline?: string;
    body?: string[];
  };
  splitMeta?: {
    sourceSlideNumber: number;
    chunkIndex: number;
    chunkCount: number;
  };
}

export interface DraftOutline {
  topic?: string;
  style?: string;
  slideCount?: number;
  styleInstructions?: string;
  slides: DraftOutlineSlide[];
}

export interface DraftSlideImage {
  number: number;
  filename: string;
  url: string | null;
}

export interface DraftSampleImage {
  slideNumber: number;
  filename: string;
  index: number;
  url: string | null;
  type: string;
  visual?: string;
  error?: string;
}

export interface DraftSolution {
  id: string;
  title: string;
  requirements: string;
  industry?: string;
  customerType?: string;
  scenario?: string;
  matchedCapabilities: string[];
  content: string;
  outline?: DraftOutline;
  slideImages?: DraftSlideImage[];
  sampleImages?: DraftSampleImage[];
  currentStyle?: string;
  status: 'draft' | 'outline' | 'generating' | 'completed' | 'published';
  createdAt: string;
  updatedAt: string;
  version: string;
}

export interface SlideImageConfig {
  enabled: boolean;
  shape?: 'circle' | 'square' | 'rounded' | 'rectangle';
  opacity?: number;
  position?: 'left' | 'right' | 'center' | 'background';
  size?: 'small' | 'medium' | 'large';
  blur?: number;
  grayscale?: boolean;
  overlay?: boolean;
}

export interface SolutionRequirementForm {
  requirements: string;
  industry?: string;
  customerType?: string;
  expectedFeatures?: string;
  additionalNotes?: string;
}
