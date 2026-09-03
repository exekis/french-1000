import { useMemo, useState } from 'react';
import { AudioCredits } from './components/AudioCredits';
import { BackToTop } from './components/BackToTop';
import { CollageLayer } from './components/CollageLayer';
import { CollectionControls } from './components/CollectionControls';
import { EmptyState } from './components/EmptyState';
import { OrnamentRule } from './components/Ephemera';
import { LanguagePicker } from './components/LanguagePicker';
import { PracticeControls } from './components/PracticeControls';
import { SearchBar } from './components/SearchBar';
import { WordList } from './components/WordList';
import testWords from './data/words.test.json';
import releaseWords from './data/words.json';
import {
  type CollectionFilter,
  COLLECTIONS_STORAGE_KEY,
  createList,
  defaultCollections,
  deleteList,
  parseCollections,
  selectFilteredIds,
  toggleInList,
  toggleStar,
} from './lib/collections';
import {
  defaultPracticeSettings,
  parsePracticeSettings,
  PRACTICE_STORAGE_KEY,
  type PracticeSettings,
} from './lib/practice';
import {
  DEFAULT_LANGUAGES,
  isLanguageCode,
  type LanguageCode,
  orderLanguages,
} from './lib/languages';
import { useMeanings } from './lib/meanings';
import { filterWords } from './lib/search';
import { useStoredState } from './lib/storage';
import { StudyProvider } from './lib/study';
import type { Word } from './types';

const LANGUAGES_STORAGE_KEY = 'french-1000:languages';

function parseLanguages(raw: unknown): LanguageCode[] | null {
  if (!Array.isArray(raw)) return null;
  const codes = orderLanguages(raw.filter(isLanguageCode));
  return codes.length > 0 ? codes : null;
}

const bundledWords = (
  import.meta.env.MODE === 'test' ? testWords : releaseWords
) as Word[];

type AppProps = {
  initialWords?: Word[];
};

export default function App({ initialWords = bundledWords }: AppProps) {
  const [query, setQuery] = useState('');
  const [rank, setRank] = useState('1');
  const [filter, setFilter] = useState<CollectionFilter>('all');
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [settings, setSettings] = useStoredState<PracticeSettings>(
    PRACTICE_STORAGE_KEY,
    defaultPracticeSettings,
    parsePracticeSettings,
  );
  const [collections, setCollections] = useStoredState(
    COLLECTIONS_STORAGE_KEY,
    defaultCollections,
    parseCollections,
  );
  const [selectedLanguages, setSelectedLanguages] = useStoredState<
    LanguageCode[]
  >(LANGUAGES_STORAGE_KEY, DEFAULT_LANGUAGES, parseLanguages);
  const { loaded, pending, failed } = useMeanings(selectedLanguages);

  const results = useMemo(() => {
    const matched = filterWords(initialWords, query, selectedLanguages, loaded);
    const allowed = selectFilteredIds(collections, filter);
    return allowed ? matched.filter((word) => allowed.has(word.id)) : matched;
  }, [initialWords, query, collections, filter, selectedLanguages, loaded]);

  const revealedInView = useMemo(
    () => results.filter((word) => revealed.has(word.id)).length,
    [results, revealed],
  );

  const study = useMemo(
    () => ({
      settings,
      revealed,
      reveal: (wordId: string) =>
        setRevealed((current) => new Set([...current, wordId])),
      collections,
      toggleStar: (wordId: string) =>
        setCollections((current) => toggleStar(current, wordId)),
      toggleInList: (listId: string, wordId: string) =>
        setCollections((current) => toggleInList(current, listId, wordId)),
      createList: (name: string, wordId: string) =>
        setCollections((current) => {
          const created = createList(current, name);
          if (!created) return current;
          return toggleInList(created.collections, created.listId, wordId);
        }),
    }),
    [settings, revealed, collections, setCollections],
  );

  function changeSettings(next: PracticeSettings) {
    // switching practice on should always start from a covered page
    if (next.enabled && !settings.enabled) setRevealed(new Set());
    setSettings(next);
  }

  function goToRank(nextRank: number) {
    const boundedRank = Math.min(Math.max(nextRank, 1), initialWords.length);
    const word = initialWords[boundedRank - 1];
    if (!word) return;

    setQuery('');
    setFilter('all');
    setRank(String(boundedRank));
    window.requestAnimationFrame(() => {
      document
        .getElementById(`word-${word.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const resultLabel = `${results.length} ${results.length === 1 ? 'word' : 'words'}`;

  return (
    <div className="page-shell">
      <CollageLayer />
      <header className="site-header">
        <div className="header-rule" />
        <div className="header-copy">
          <p className="eyebrow">A beginner’s working vocabulary</p>
          <h1>
            French <span>1000</span>
          </h1>
          <OrnamentRule />
          <p className="intro">
            One thousand useful French words in the supplied order, with clear
            English and Persian meanings, a short example, and pronunciation.
          </p>
        </div>
      </header>

      <main>
        <section className="tool-panel" aria-label="Vocabulary controls">
          <SearchBar query={query} onQueryChange={setQuery} />
          {initialWords.length > 0 && (
            <div className="rank-navigation">
              <label htmlFor="rank-input">Go to rank</label>
              <div>
                <input
                  id="rank-input"
                  type="number"
                  min="1"
                  max={initialWords.length}
                  value={rank}
                  onChange={(event) => setRank(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') goToRank(Number(rank));
                  }}
                />
                <button type="button" onClick={() => goToRank(Number(rank))}>
                  Go
                </button>
                <button
                  type="button"
                  onClick={() =>
                    goToRank(
                      Math.floor(Math.random() * initialWords.length) + 1,
                    )
                  }
                >
                  Random word
                </button>
              </div>
            </div>
          )}
        </section>

        {initialWords.length > 0 && (
          <section className="study-panel" aria-label="Study controls">
            <PracticeControls
              settings={settings}
              onSettingsChange={changeSettings}
              revealedCount={revealedInView}
              totalCount={results.length}
              onRevealAll={() =>
                setRevealed(
                  (current) =>
                    new Set([...current, ...results.map((word) => word.id)]),
                )
              }
              onCoverAll={() => setRevealed(new Set())}
            />
            <LanguagePicker
              selected={selectedLanguages}
              pending={pending}
              failed={failed}
              onChange={setSelectedLanguages}
            />
            <CollectionControls
              collections={collections}
              filter={filter}
              onFilterChange={setFilter}
              onImport={setCollections}
              onDeleteList={(listId) =>
                setCollections((current) => deleteList(current, listId))
              }
            />
          </section>
        )}

        {initialWords.length === 0 ? (
          <output className="data-pending">
            <p className="empty-kicker">Content gate active</p>
            <h2>The vocabulary is being prepared</h2>
            <p>
              The site is ready for the reviewed source workbook. No substitute
              word list has been published.
            </p>
          </output>
        ) : (
          <section
            className="results-section"
            aria-labelledby="results-heading"
          >
            <div className="results-meta">
              <h2 id="results-heading">The list</h2>
              <p aria-live="polite">{resultLabel}</p>
            </div>
            {results.length > 0 ? (
              <StudyProvider value={study}>
                <WordList
                  words={results}
                  languages={selectedLanguages}
                  meanings={loaded}
                />
              </StudyProvider>
            ) : (
              <EmptyState query={query} filter={filter} />
            )}
          </section>
        )}
      </main>

      <footer>
        <p>Built for focused, everyday French practice.</p>
        <AudioCredits />
      </footer>

      <BackToTop />
    </div>
  );
}
