import type { CollectionFilter } from '../lib/collections';

type EmptyStateProps = {
  query: string;
  filter?: CollectionFilter;
  targetLanguageName?: string;
};

export function EmptyState({
  query,
  filter = 'all',
  targetLanguageName = 'French',
}: EmptyStateProps) {
  // an empty saved list is a different problem from a search that found nothing, so
  // the reader is told which one they are looking at
  if (filter !== 'all' && !query) {
    return (
      <output className="empty-state">
        <p className="empty-kicker">Nothing saved yet</p>
        <h2>This list is empty</h2>
        <p>
          Star a word, or add it to a list, and it will appear here. Switch back
          to all words to go looking.
        </p>
      </output>
    );
  }

  if (filter !== 'all') {
    return (
      <output className="empty-state">
        <p className="empty-kicker">No matches</p>
        <h2>Nothing saved matches that</h2>
        <p>
          No saved word matches <strong>“{query}”</strong>. Try showing all
          words instead.
        </p>
      </output>
    );
  }

  return (
    <output className="empty-state">
      <p className="empty-kicker">No matches</p>
      <h2>Try a broader search</h2>
      <p>
        Nothing in the list matches <strong>“{query}”</strong>. Try a{' '}
        {targetLanguageName} word without accents, an English meaning, or
        Persian text.
      </p>
    </output>
  );
}
