import { memo } from 'react';
import {
  languageByCode,
  type LanguageCode,
  languageStyles,
} from '../lib/languages';
import { meaningFor, type MeaningMap } from '../lib/meanings';
import { isExampleHidden, isMeaningHidden } from '../lib/practice';
import { useStudy } from '../lib/study';
import type { Word } from '../types';
import { MaskedMeaning } from './MaskedMeaning';
import { PronunciationButton } from './PronunciationButton';
import { WordSaveControls } from './WordSaveControls';

type WordCardProps = {
  word: Word;
  languages: readonly LanguageCode[];
  meanings: Partial<Record<LanguageCode, MeaningMap>>;
};

function WordCardImpl({ word, languages, meanings }: WordCardProps) {
  const study = useStudy();
  const meaningHidden = isMeaningHidden(
    study.settings,
    study.revealed,
    word.id,
  );
  const exampleHidden = isExampleHidden(
    study.settings,
    study.revealed,
    word.id,
  );
  const reveal = () => study.reveal(word.id);

  return (
    <article className="word-card" id={`word-${word.id}`}>
      <header>
        <div>
          <span className="rank">#{word.rank}</span>
          <h2 lang="fr">{word.french}</h2>
        </div>
        <div className="card-controls">
          <PronunciationButton word={word} />
          <WordSaveControls
            word={word}
            collections={study.collections}
            onToggleStar={study.toggleStar}
            onToggleInList={study.toggleInList}
            onCreateList={study.createList}
          />
        </div>
      </header>
      <dl data-columns={languages.length > 1 ? 'two' : 'one'}>
        {languages.map((code) => {
          const language = languageByCode.get(code)!;
          const value = meaningFor(word, code, meanings);
          return (
            <div key={code}>
              <dt>{language.label}</dt>
              <dd
                lang={code}
                dir={language.direction === 'rtl' ? 'rtl' : undefined}
                className={
                  language.direction === 'rtl' ? 'rtl-cell' : undefined
                }
                style={languageStyles[code]}
              >
                {value === undefined ? (
                  <span
                    className="meaning-missing"
                    aria-label="not available yet"
                  >
                    —
                  </span>
                ) : (
                  <MaskedMeaning
                    hidden={meaningHidden}
                    label={`${language.label} meaning of ${word.french}`}
                    onReveal={reveal}
                  >
                    {value}
                  </MaskedMeaning>
                )}
              </dd>
            </div>
          );
        })}
        <div className="card-example">
          <dt>Example</dt>
          <dd>
            <div className="example-line">
              <span lang="fr">
                <MaskedMeaning
                  hidden={exampleHidden}
                  label={`example for ${word.french}`}
                  onReveal={reveal}
                >
                  {word.exampleFrench}
                </MaskedMeaning>
              </span>
              <PronunciationButton word={word} kind="example" />
            </div>
          </dd>
        </div>
      </dl>
    </article>
  );
}

// a row only depends on its own word, so it should sit still while the rest of the list
// re-renders. this is what keeps typing in the search box cheap over a thousand rows
export const WordCard = memo(WordCardImpl);
