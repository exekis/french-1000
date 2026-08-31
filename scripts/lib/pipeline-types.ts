import type {
  AudioKind,
  AudioProvider,
  ReviewStatus,
  Word,
} from '../../src/types';

export type ImportedWord = {
  id: string;
  rank: number;
  sourceRow: number;
  french: string;
  english: string;
  persian: string;
  riskFlags: string[];
};

export type ImportNormalization = {
  rank: number;
  sourceRow: number;
  field: 'french' | 'english' | 'persian';
  before: string;
  after: string;
  changes: string[];
};

export type ExampleCandidate = {
  id: string;
  rank: number;
  french: string;
  exampleFrench: string;
  exampleTarget: string;
  model: string;
  promptVersion: string;
  generatedAt: string;
};

export type ExampleCheck = {
  passed: boolean;
  flags: string[];
  wordCount: number;
};

export type ExampleReview = {
  id: string;
  decision: 'approve' | 'revise' | 'reject';
  senseAligned: boolean;
  grammatical: boolean;
  natural: boolean;
  beginnerSuitable: boolean;
  targetTaught: boolean;
  reasons: string[];
  suggestedExampleFrench: string | null;
  suggestedExampleTarget: string | null;
  model: string;
  reviewedAt: string;
};

export type ExampleApproval = {
  id: string;
  exampleFrench: string;
  exampleTarget: string;
  status: Exclude<ReviewStatus, 'pending'>;
  approvedAt: string;
  reviewerReference: string;
};

export type AudioManifestEntry = {
  id: string;
  path: string;
  provider: AudioProvider;
  kind: AudioKind;
  licenseReference: string;
  pronunciationTarget: string;
  pronunciationIpa?: string;
  reviewStatus: Exclude<ReviewStatus, 'pending'>;
  sourceId?: string;
  sourceUrl?: string;
  attribution?: string;
  speaker?: string;
  voiceName?: string;
  requestTextHash?: string;
  generatedAt?: string;
  retrievedAt?: string;
};

export type PublishedWord = Word;
