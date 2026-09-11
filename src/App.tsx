import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AudioCredits } from './components/AudioCredits';
import { BackToTop } from './components/BackToTop';
import { CollageLayer } from './components/CollageLayer';
import { CollectionControls } from './components/CollectionControls';
import { CourseSwitcher } from './components/CourseSwitcher';
import { EmptyState } from './components/EmptyState';
import { OrnamentRule } from './components/Ephemera';
import { LanguagePicker } from './components/LanguagePicker';
import { PracticeControls } from './components/PracticeControls';
import { SearchBar } from './components/SearchBar';
import { WordList } from './components/WordList';
import frenchTestWords from './data/words.test.json';
import frenchReleaseWords from './data/words.json';
import frenchCredits from './data/audio-credits.json';
import spanishTestWords from './data/spanish/words.test.json';
import spanishReleaseWords from './data/spanish/words.json';
import spanishCredits from './data/spanish/audio-credits.json';
import {
  type CollectionFilter,
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
  type PracticeSettings,
} from './lib/practice';
import {
  DEFAULT_LANGUAGES,
  isLanguageCode,
  type LanguageCode,
  orderLanguages,
} from './lib/languages';
import {
  type CourseId,
  courses,
  resolveCourseFromLocation,
  navigateToCourse,
  subscribeToCourseChange,
} from './lib/courses';
import { useMeanings } from './lib/meanings';
import { useProgressiveRows } from './lib/progressive';
import { filterWords } from './lib/search';
import { useStoredState } from './lib/storage';
import { StudyProvider } from './lib/study';
import type { AudioCredits as AudioCreditsData, Word } from './types';

function parseLanguages(raw: unknown): LanguageCode[] | null {
  if (!Array.isArray(raw)) return null;
  const codes = orderLanguages(raw.filter(isLanguageCode));
  return codes.length > 0 ? codes : null;
}

const bundledFrenchWords = (
  import.meta.env.MODE === 'test' ? frenchTestWords : frenchReleaseWords
) as Word[];

const bundledSpanishWords = (
  import.meta.env.MODE === 'test' ? spanishTestWords : spanishReleaseWords
) as Word[];

type AppProps = {
  initialWords?: Word[];
  initialCourseId?: CourseId;
};

export default function App({ initialWords, initialCourseId }: AppProps) {
  const [courseId, setCourseId] = useState<CourseId>(
    () => initialCourseId ?? resolveCourseFromLocation(),
  );

  useEffect(() => {
    return subscribeToCourseChange((nextCourseId) => {
      setCourseId(nextCourseId);
    });
  }, []);

  const activeCourse = courses[courseId];

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${activeCourse.title} — ${activeCourse.eyebrow}`;
    }
  }, [activeCourse]);

  const words = useMemo(() => {
    if (initialWords) return initialWords;
    return courseId === 'spanish' ? bundledSpanishWords : bundledFrenchWords;
  }, [initialWords, courseId]);

  const [query, setQuery] = useState('');
  // the box has to keep up with typing while a thousand rows re-filter behind it, so the
  // list works from a deferred copy and react is free to interrupt that render
  const deferredQuery = useDeferredValue(query);
  const [rank, setRank] = useState('1');
  const [filter, setFilter] = useState<CollectionFilter>('all');
  const pendingScroll = useRef<string | null>(null);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());

  const [settings, setSettings] = useStoredState<PracticeSettings>(
    activeCourse.storageKeys.practice,
    defaultPracticeSettings,
    parsePracticeSettings,
  );
  const [collections, setCollections] = useStoredState(
    activeCourse.storageKeys.collections,
    defaultCollections,
    parseCollections,
  );
  const [selectedLanguages, setSelectedLanguages] = useStoredState<
    LanguageCode[]
  >(activeCourse.storageKeys.languages, DEFAULT_LANGUAGES, parseLanguages);

  const { loaded, pending, failed } = useMeanings(selectedLanguages, courseId);

  const results = useMemo(() => {
    const matched = filterWords(
      words,
      deferredQuery,
      selectedLanguages,
      loaded,
    );
    const allowed = selectFilteredIds(collections, filter);
    return allowed ? matched.filter((word) => allowed.has(word.id)) : matched;
  }, [words, deferredQuery, collections, filter, selectedLanguages, loaded]);

  // a jump clears the search first, and that clearing render is deferred, so the row may
  // not be on the page yet. waiting for it to appear beats guessing at a frame. no dep
  // list on purpose so every commit gets a look, which costs one ref read
  useEffect(() => {
    const target = pendingScroll.current;
    if (!target) return;
    const node = document.getElementById(`word-${target}`);
    if (!node) return;
    pendingScroll.current = null;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // the first paint only has to cover the screen, not the whole ledger
  const [visibleCount, ensureRendered] = useProgressiveRows(results.length);

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
    const boundedRank = Math.min(Math.max(nextRank, 1), words.length);
    const word = words[boundedRank - 1];
    if (!word) return;

    setQuery('');
    setFilter('all');
    setRank(String(boundedRank));
    ensureRendered(boundedRank);
    pendingScroll.current = word.id;
  }

  function handleSelectCourse(nextCourseId: CourseId) {
    setCourseId(nextCourseId);
    setQuery('');
    setFilter('all');
    setRank('1');
    setRevealed(new Set());
    navigateToCourse(nextCourseId);
  }

  const resultLabel = `${results.length} ${results.length === 1 ? 'word' : 'words'}`;
  const currentCredits = (
    courseId === 'spanish' ? spanishCredits : frenchCredits
  ) as AudioCreditsData;

  return (
    <div className="page-shell">
      <CollageLayer />
      <header className="site-header">
        <CourseSwitcher
          currentCourseId={courseId}
          onSelectCourse={handleSelectCourse}
        />
        <div className="header-rule" />
        <div className="header-copy">
          <p className="eyebrow">{activeCourse.eyebrow}</p>
          <h1>
            {activeCourse.name} <span>1000</span>
          </h1>
          <OrnamentRule />
          <p className="intro">{activeCourse.intro}</p>
        </div>
      </header>

      <main>
        <section className="tool-panel" aria-label="Vocabulary controls">
          <SearchBar
            query={query}
            onQueryChange={setQuery}
            targetLanguageName={activeCourse.name}
          />
          {words.length > 0 && (
            <div className="rank-navigation">
              <label htmlFor="rank-input">Go to rank</label>
              <div>
                <input
                  id="rank-input"
                  type="number"
                  min="1"
                  max={words.length}
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
                    goToRank(Math.floor(Math.random() * words.length) + 1)
                  }
                >
                  Random word
                </button>
              </div>
            </div>
          )}
        </section>

        {words.length > 0 && (
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
              availableLanguages={activeCourse.translationLanguages}
            />
            <CollectionControls
              collections={collections}
              filter={filter}
              onFilterChange={setFilter}
              onImport={setCollections}
              onDeleteList={(listId) =>
                setCollections((current) => deleteList(current, listId))
              }
              courseSlug={activeCourse.slug}
            />
          </section>
        )}

        {words.length === 0 ? (
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
                  count={visibleCount}
                  languages={selectedLanguages}
                  meanings={loaded}
                  targetLanguageName={activeCourse.name}
                  targetLanguageCode={activeCourse.code}
                />
              </StudyProvider>
            ) : (
              <EmptyState
                query={query}
                filter={filter}
                targetLanguageName={activeCourse.name}
              />
            )}
          </section>
        )}
      </main>

      <footer>
        <p>{activeCourse.footerText}</p>
        <AudioCredits
          credits={currentCredits}
          languageName={activeCourse.name}
        />
      </footer>

      <BackToTop />
    </div>
  );
}
