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

type WordRowProps = {
  word: Word;
  languages: readonly LanguageCode[];
  meanings: Partial<Record<LanguageCode, MeaningMap>>;
};

function WordRowImpl({ word, languages, meanings }: WordRowProps) {
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
    <tr id={`word-${word.id}`}>
      <th scope="row" className="french-cell">
        <span className="rank">#{word.rank}</span>
        <span lang="fr" className="french-term">
          {word.french}
        </span>
        <PronunciationButton word={word} />
        <WordSaveControls
          word={word}
          collections={study.collections}
          onToggleStar={study.toggleStar}
          onToggleInList={study.toggleInList}
          onCreateList={study.createList}
        />
      </th>
      {languages.map((code) => {
        const language = languageByCode.get(code)!;
        const value = meaningFor(word, code, meanings);
        return (
          <td
            key={code}
            lang={code}
            dir={language.direction === 'rtl' ? 'rtl' : undefined}
            className={language.direction === 'rtl' ? 'rtl-cell' : undefined}
            style={languageStyles[code]}
          >
            {value === undefined ? (
              <span className="meaning-missing" aria-label="not available yet">
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
          </td>
        );
      })}
      <td className="example-cell">
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
      </td>
    </tr>
  );
}

// a row only depends on its own word, so it should sit still while the rest of the list
// re-renders. this is what keeps typing in the search box cheap over a thousand rows
export const WordRow = memo(WordRowImpl);
