import { useMemo } from 'react';
import { languageByCode, type LanguageCode } from '../lib/languages';
import { useMediaQuery } from '../lib/media';
import type { MeaningMap } from '../lib/meanings';
import type { Word } from '../types';
import { WordCard } from './WordCard';
import { WordRow } from './WordRow';

type WordListProps = {
  words: readonly Word[];
  languages: readonly LanguageCode[];
  meanings: Partial<Record<LanguageCode, MeaningMap>>;
};

// french and the example keep a fixed share; the rest of the row is split between
// however many meanings the reader asked for
const FRENCH_WIDTH = 17;
const EXAMPLE_WIDTH = 27;

export function WordList({ words, languages, meanings }: WordListProps) {
  const isMobile = useMediaQuery('(max-width: 740px)');
  // past four meaning columns the row cannot stay readable at any sensible width, so
  // the frame scrolls sideways instead of squeezing the text
  const scrolls = languages.length > 4;
  const layout = useMemo(() => {
    const meaningWidth =
      (100 - FRENCH_WIDTH - EXAMPLE_WIDTH) / languages.length;
    return {
      french: { width: `${FRENCH_WIDTH}%` },
      example: { width: `${EXAMPLE_WIDTH}%` },
      meaning: { width: `${meaningWidth}%` },
      table:
        languages.length > 4
          ? { minWidth: `${620 + languages.length * 150}px` }
          : undefined,
    };
  }, [languages.length]);

  if (isMobile) {
    return (
      <div className="card-list" data-layout="cards">
        {words.map((word) => (
          <WordCard
            key={word.id}
            word={word}
            languages={languages}
            meanings={meanings}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="table-frame"
      data-layout="table"
      data-scrolls={scrolls ? 'true' : undefined}
    >
      <table style={layout.table}>
        <thead>
          <tr>
            <th scope="col" style={layout.french}>
              French
            </th>
            {languages.map((code) => {
              const language = languageByCode.get(code)!;
              return (
                <th
                  key={code}
                  scope="col"
                  style={layout.meaning}
                  className={
                    language.direction === 'rtl' ? 'rtl-column' : undefined
                  }
                >
                  {language.label}
                </th>
              );
            })}
            <th scope="col" style={layout.example}>
              Example
            </th>
          </tr>
        </thead>
        <tbody>
          {words.map((word) => (
            <WordRow
              key={word.id}
              word={word}
              languages={languages}
              meanings={meanings}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
