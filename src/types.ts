export type AudioProvider =
  | 'forvo'
  | 'wikimedia-commons'
  | 'google-cloud-tts'
  | 'piper-neural'
  | 'browser-speech';
export type AudioKind = 'human' | 'neural';
export type ReviewStatus = 'pending' | 'auto-checked' | 'human-reviewed';

export type Word = {
  id: string;
  rank: number;
  french?: string;
  spanish?: string;
  english: string;
  persian: string;
  exampleFrench?: string;
  exampleSpanish?: string;
  exampleEnglish?: string;
  exampleTarget: string;
  pronunciationTarget: string;
  pronunciationIpa?: string;
  audio: {
    path: string;
    provider: AudioProvider;
    kind: AudioKind;
    licenseReference: string;
    attribution?: string;
    sourceUrl?: string;
  };
  exampleAudio?: {
    path: string;
    provider: AudioProvider;
    voiceName: string;
    licenseReference: string;
  };
  review: {
    meaning: 'imported' | 'reviewed';
    example: ReviewStatus;
    pronunciation: ReviewStatus;
    flags: string[];
  };
};

export function getWordTerm(word: Word): string {
  return word.spanish ?? word.french ?? '';
}

export function getWordExample(word: Word): string {
  return word.exampleSpanish ?? word.exampleFrench ?? '';
}

export type AudioCredits = {
  generatedAt: string;
  totalRecordings: number;
  providers: {
    provider: AudioProvider;
    kind: AudioKind;
    recordings: number;
  }[];
  speakers: {
    speaker: string;
    recordings: number;
    license: string;
    profileUrl: string | null;
  }[];
  licenses: {
    name: string;
    url: string | null;
    recordings: number;
  }[];
  synthesizedVoices: {
    voiceName: string;
    recordings: number;
    licenseReference: string;
  }[];
};
