import { useSyncExternalStore } from 'react';
import { audioController, type PlaybackKind } from '../lib/audio';
import { getWordTerm, type Word } from '../types';

type PronunciationButtonProps = {
  word: Word;
  kind?: PlaybackKind;
};

export function PronunciationButton({
  word,
  kind = 'word',
}: PronunciationButtonProps) {
  const state = useSyncExternalStore(
    audioController.subscribe,
    audioController.getSnapshot,
    audioController.getSnapshot,
  );
  const isCurrent = state.wordId === word.id && state.kind === kind;
  const isPlaying = isCurrent && state.status === 'playing';
  const isLoading = isCurrent && state.status === 'loading';
  const error = isCurrent && state.status === 'error' ? state.error : null;
  const action = isPlaying || isLoading ? 'Pause' : 'Play';
  const term = getWordTerm(word);
  const target = kind === 'example' ? `example for ${term}` : term;

  return (
    <div className="pronunciation-control">
      <button
        type="button"
        className="pronunciation-button"
        data-kind={kind}
        aria-label={`${action} pronunciation of ${target}`}
        aria-pressed={isPlaying}
        onClick={() => void audioController.toggle(word, kind)}
      >
        {isLoading ? (
          <span className="loading-mark" aria-hidden="true" />
        ) : isPlaying ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 6v12M16 6v12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 14h4l5 4V6l-5 4H5v4Z" />
            <path d="M17 9.5c1.4 1.4 1.4 3.6 0 5" />
          </svg>
        )}
      </button>
      {isLoading && <span className="audio-state">Loading</span>}
      {error && <output className="audio-error">{error}</output>}
    </div>
  );
}
