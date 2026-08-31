import { resolveAssetPath } from './assets';
import type { Word } from '../types';

export type PlaybackStatus =
  'idle' | 'loading' | 'playing' | 'paused' | 'error';

// a row can play two different things, the word on its own and the whole example
export type PlaybackKind = 'word' | 'example';

export type PlaybackState = {
  status: PlaybackStatus;
  wordId: string | null;
  kind: PlaybackKind;
  error: string | null;
};

export type AudioPort = {
  src: string;
  preload: string;
  currentTime: number;
  pause(): void;
  play(): Promise<void>;
  load(): void;
  addEventListener(type: string, listener: EventListener): void;
};

type AudioFactory = () => AudioPort;
export type SpeechUtterancePort = SpeechSynthesisUtterance;
export type SpeechPort = Pick<
  SpeechSynthesis,
  'cancel' | 'pause' | 'resume' | 'speak' | 'getVoices'
>;
export type VoiceLike = {
  name: string;
  lang: string;
  localService?: boolean;
};
type SpeechFactory = () => SpeechPort | null;
type UtteranceFactory = (text: string) => SpeechUtterancePort;
type Listener = () => void;

const initialState: PlaybackState = {
  status: 'idle',
  wordId: null,
  kind: 'word',
  error: null,
};

export function resolveAudioPath(path: string, baseUrl?: string): string {
  return resolveAssetPath(path, baseUrl);
}

// every platform hands back a default fr-FR engine when no voice is chosen, and on
// macOS that default is the compact formant voice that sounds synthetic. these markers
// pick out the neural engines instead: Google's network voice in Chrome, the Microsoft
// Online (Natural) voices in Edge, and the enhanced or premium downloads on Apple systems
const naturalVoiceMarkers = [
  'google',
  'natural',
  'neural',
  'online',
  'enhanced',
  'premium',
  'siri',
  'wavenet',
];

// the macOS novelty and legacy compact voices, which are the worst of the fr-FR set
const syntheticVoiceMarkers = [
  'compact',
  'desktop',
  'eddy',
  'flo',
  'grandma',
  'grandpa',
  'jacques',
  'reed',
  'rocko',
  'sandy',
  'shelley',
  'bad news',
  'good news',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'jester',
  'organ',
  'superstar',
  'trinoids',
  'whisper',
  'wobble',
  'zarvox',
  'albert',
];

function voiceTier(name: string): number {
  const lowered = name.toLocaleLowerCase('en');
  if (naturalVoiceMarkers.some((marker) => lowered.includes(marker))) return 0;
  if (syntheticVoiceMarkers.some((marker) => lowered.includes(marker)))
    return 2;
  return 1;
}

function languageRank(lang: string): number {
  const lowered = lang.toLocaleLowerCase('en').replace('_', '-');
  if (lowered.startsWith('fr-fr')) return 0;
  if (lowered.startsWith('fr-ca')) return 1;
  if (lowered.startsWith('fr')) return 2;
  return Number.POSITIVE_INFINITY;
}

export function selectFrenchVoice<T extends VoiceLike>(
  voices: readonly T[],
): T | null {
  const ranked = voices
    .map((voice, index) => ({ voice, index }))
    .filter(({ voice }) => Number.isFinite(languageRank(voice.lang)))
    .toSorted((a, b) => {
      const tier = voiceTier(a.voice.name) - voiceTier(b.voice.name);
      if (tier !== 0) return tier;
      const language = languageRank(a.voice.lang) - languageRank(b.voice.lang);
      if (language !== 0) return language;
      // network engines are consistently the better sounding half of what is installed
      const local =
        Number(a.voice.localService ?? true) -
        Number(b.voice.localService ?? true);
      if (local !== 0) return local;
      return a.index - b.index;
    });

  return ranked[0]?.voice ?? null;
}

// a word always has a recording; the example sentence only has one once it has been
// spoken, and until then the browser reads it
function clipPathFor(word: Word, kind: PlaybackKind): string | null {
  if (kind === 'example') return word.exampleAudio?.path ?? null;
  return word.audio.provider === 'browser-speech' ? null : word.audio.path;
}

function createBrowserAudio(): AudioPort {
  const audio = new Audio();
  audio.preload = 'none';
  return audio;
}

function getBrowserSpeech(): SpeechPort | null {
  return typeof window === 'undefined' ? null : window.speechSynthesis;
}

function createBrowserUtterance(text: string): SpeechUtterancePort {
  return new SpeechSynthesisUtterance(text);
}

export class AudioController {
  private readonly createAudio: AudioFactory;
  private readonly getSpeech: SpeechFactory;
  private readonly createUtterance: UtteranceFactory;
  private readonly listeners = new Set<Listener>();
  private audio: AudioPort | null = null;
  private state: PlaybackState = initialState;
  private currentWord: Word | null = null;
  private currentKind: PlaybackKind = 'word';
  private cachedVoice: VoiceLike | null = null;

  constructor(
    createAudio: AudioFactory = createBrowserAudio,
    getSpeech: SpeechFactory = getBrowserSpeech,
    createUtterance: UtteranceFactory = createBrowserUtterance,
  ) {
    this.createAudio = createAudio;
    this.getSpeech = getSpeech;
    this.createUtterance = createUtterance;
  }

  getSnapshot = (): PlaybackState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async toggle(word: Word, kind: PlaybackKind = 'word'): Promise<void> {
    const clipPath = clipPathFor(word, kind);
    if (!clipPath) {
      // nothing recorded for this clip, so the browser reads it instead
      this.toggleSpeech(word, kind);
      return;
    }

    this.getSpeech()?.cancel();
    this.currentWord = word;
    this.currentKind = kind;
    const audio = this.getAudio();

    if (this.state.wordId === word.id && this.state.kind === kind) {
      if (this.state.status === 'playing' || this.state.status === 'loading') {
        audio.pause();
        this.setState({ status: 'paused', wordId: word.id, kind, error: null });
        return;
      }

      if (this.state.status === 'paused') {
        this.setState({
          status: 'loading',
          wordId: word.id,
          kind,
          error: null,
        });
        await this.startPlayback(audio, word.id);
        return;
      }
    }

    audio.pause();
    audio.currentTime = 0;
    audio.src = resolveAudioPath(clipPath);
    audio.load();
    this.setState({ status: 'loading', wordId: word.id, kind, error: null });
    await this.startPlayback(audio, word.id);
  }

  stop(): void {
    this.getSpeech()?.cancel();
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.setState(initialState);
  }

  private toggleSpeech(word: Word, kind: PlaybackKind = 'word'): void {
    const speech = this.getSpeech();
    if (!speech) {
      this.setState({
        status: 'error',
        wordId: word.id,
        kind,
        error: 'Speech playback is not supported in this browser.',
      });
      return;
    }

    if (this.state.wordId === word.id && this.state.kind === kind) {
      if (this.state.status === 'playing' || this.state.status === 'loading') {
        speech.pause();
        this.setState({ status: 'paused', wordId: word.id, kind, error: null });
        return;
      }
      if (this.state.status === 'paused') {
        speech.resume();
        this.setState({
          status: 'playing',
          wordId: word.id,
          kind,
          error: null,
        });
        return;
      }
    }

    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    speech.cancel();
    this.currentWord = word;
    this.currentKind = kind;
    const utterance = this.createUtterance(
      kind === 'example' ? word.exampleFrench : word.pronunciationTarget,
    );
    utterance.lang = 'fr-FR';
    // leaving voice unset makes the platform pick its default fr-FR engine, which is
    // the compact robotic one on macOS and iOS
    const voice = this.resolveVoice(speech);
    if (voice) utterance.voice = voice as SpeechSynthesisVoice;
    utterance.rate = 0.95;
    utterance.addEventListener('start', () => {
      if (this.state.wordId === word.id) {
        this.setState({
          status: 'playing',
          wordId: word.id,
          kind,
          error: null,
        });
      }
    });
    utterance.addEventListener('end', () => {
      if (this.state.wordId === word.id) {
        this.setState(initialState);
      }
    });
    utterance.addEventListener('error', () => {
      if (this.state.wordId === word.id) {
        this.setState({
          status: 'error',
          wordId: word.id,
          kind,
          error: 'Pronunciation could not be played. Please try again.',
        });
      }
    });
    this.setState({ status: 'loading', wordId: word.id, kind, error: null });
    speech.speak(utterance);
  }

  private resolveVoice(speech: SpeechPort): VoiceLike | null {
    if (this.cachedVoice) return this.cachedVoice;
    // several browsers populate the voice list asynchronously, so an empty list here
    // just means we try again on the next press rather than caching the miss
    const voices = speech.getVoices?.() ?? [];
    if (voices.length === 0) return null;
    this.cachedVoice = selectFrenchVoice(voices);
    return this.cachedVoice;
  }

  private getAudio(): AudioPort {
    if (this.audio) {
      return this.audio;
    }

    const audio = this.createAudio();
    audio.preload = 'metadata';
    audio.addEventListener('playing', () => {
      if (this.state.wordId) {
        this.setState({ ...this.state, status: 'playing', error: null });
      }
    });
    audio.addEventListener('waiting', () => {
      if (this.state.wordId) {
        this.setState({ ...this.state, status: 'loading' });
      }
    });
    audio.addEventListener('ended', () => {
      this.setState({ ...this.state, status: 'idle', error: null });
    });
    audio.addEventListener('error', () => {
      const word = this.currentWord;
      if (!word) return;
      // switching clips aborts the previous load and that also fires error, so only the
      // file still being waited on may trigger the spoken fallback
      const expected = clipPathFor(word, this.currentKind);
      if (!expected || audio.src !== resolveAudioPath(expected)) return;
      this.fallBackToSpeech();
    });
    this.audio = audio;
    return audio;
  }

  private async startPlayback(audio: AudioPort, wordId: string): Promise<void> {
    try {
      await audio.play();
    } catch {
      if (this.state.wordId === wordId) {
        this.fallBackToSpeech();
      }
    }
  }

  // the recorded file is the primary source, so speech synthesis only runs when that
  // file cannot be fetched or decoded
  private fallBackToSpeech(): void {
    const word = this.currentWord;
    const kind = this.currentKind;
    if (!word || this.state.wordId !== word.id) return;
    const speech = this.getSpeech();
    if (!speech) {
      this.setState({
        status: 'error',
        wordId: word.id,
        kind,
        error: 'Pronunciation could not be played. Please try again.',
      });
      return;
    }
    this.setState({ status: 'idle', wordId: null, kind: 'word', error: null });
    this.toggleSpeech(
      kind === 'example'
        ? word
        : { ...word, audio: { ...word.audio, provider: 'browser-speech' } },
      kind,
    );
  }

  private setState(state: PlaybackState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}

export const audioController = new AudioController();
