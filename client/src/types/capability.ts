export interface TechSpec {
  name: string;
  value: string;
  unit?: string;
  description?: string;
}

export interface Performance {
  concurrency?: string;
  responseTime?: string;
  accuracy?: string;
  availability?: string;
  other?: Record<string, string>;
}

export interface ProductCapability {
  id: string;
  name: string;
  category: string;
  description: string;
  features: string[];
  useCases: string[];
  benefits: string[];
  specs: TechSpec[];
  performance?: Performance;
  collectionId?: string;
  createdAt: string;
  updatedAt: string;
  version: string;
}

export interface ProductCapabilityFormData {
  name: string;
  category: string;
  description: string;
  features: string;
  useCases: string;
  benefits: string;
  specs: string;
  performance: string;
}

export interface PendingCapability {
  id: string;
  sourceId: string;
  sourceTitle: string;
  name: string;
  category: string;
  description: string;
  features: string[];
  painPoints: string[];
  targetClients: string[];
  industries: string[];
  status: 'pending' | 'approved' | 'rejected';
  similarityScore?: number;
  similarCapabilities?: string[];
  createdAt: string;
  extractedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}
