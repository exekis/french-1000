import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import App from '../src/App';
import { checkExampleTranslation } from '../scripts/lib/example-checks';
import { createSearchKey, filterWords } from '../src/lib/search';
import { makeSpanishWord, makeWord } from './fixtures';

describe('example translation checks', () => {
  test('accepts a natural reading of the sentence', () => {
    const check = checkExampleTranslation(
      'I know that you are right.',
      'Sé que tú tienes razón.',
    );
    expect(check.passed).toBe(true);
  });

  test('catches a model that handed the source back', () => {
    expect(
      checkExampleTranslation(
        'Sé que tú tienes razón.',
        'Sé que tú tienes razón.',
      ).flags,
    ).toContain('copies-the-source');
  });

  test('catches an answer left in another script', () => {
    expect(
      checkExampleTranslation('我知道你是对的。', 'Sé que tú tienes razón.')
        .flags,
    ).toContain('not-english-script');
  });

  test('catches a fragment with no sentence punctuation', () => {
    expect(
      checkExampleTranslation('I know that you are right', 'Sé que...').flags,
    ).toContain('missing-sentence-punctuation');
  });

  test('catches an empty or annotated answer', () => {
    expect(checkExampleTranslation('   ', 'Sé que...').flags).toContain(
      'empty',
    );
    expect(
      checkExampleTranslation('placeholder text here.', 'Sé que...').flags,
    ).toContain('placeholder');
    // exemple and ejemplo read as "example", so that word is not a stub marker here
    expect(
      checkExampleTranslation('It is a good example.', "C'est un bon exemple.")
        .passed,
    ).toBe(true);
  });
});

describe('example translation in the list', () => {
  test('shows the English reading under a Spanish example', () => {
    render(
      <App initialWords={[makeSpanishWord(1)]} initialCourseId="spanish" />,
    );
    expect(screen.getByText('Aquí está la palabra1.')).toBeInTheDocument();
    expect(screen.getByText('Here is the palabra1.')).toBeInTheDocument();
  });

  test('shows the English reading under a French example', () => {
    render(<App initialWords={[makeWord(1)]} />);
    expect(screen.getByText('Voici le mot1.')).toBeInTheDocument();
    expect(screen.getByText('Here is the mot1.')).toBeInTheDocument();
  });

  test('omits the line entirely when a record has no reading', () => {
    const word = makeSpanishWord(1);
    delete word.exampleEnglish;
    render(<App initialWords={[word]} initialCourseId="spanish" />);
    expect(screen.getByText('Aquí está la palabra1.')).toBeInTheDocument();
    expect(screen.queryByText(/Here is the/)).not.toBeInTheDocument();
  });

  test('covers the reading with the example under practice mode', async () => {
    const user = userEvent.setup();
    render(
      <App initialWords={[makeSpanishWord(1)]} initialCourseId="spanish" />,
    );

    await user.click(screen.getByRole('checkbox', { name: /Practice mode/ }));
    await user.click(
      screen.getByRole('checkbox', { name: /Cover examples too/ }),
    );

    // a reading left visible while the sentence is covered would give the answer away
    expect(
      screen.getByRole('button', {
        name: 'Reveal English reading of the example for palabra1',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reveal example for palabra1' }),
    ).toBeInTheDocument();
  });
});

describe('searching the English reading', () => {
  const word = makeSpanishWord(1, {
    spanish: 'lluvia',
    english: 'rain',
    exampleSpanish: 'La lluvia cae sobre el tejado.',
    exampleEnglish: 'The rain falls on the roof.',
    exampleTarget: 'lluvia',
  });

  test('finds a word by the English reading of its example', () => {
    expect(filterWords([word], 'falls on the roof')).toHaveLength(1);
  });

  test('puts the reading in the search key', () => {
    expect(createSearchKey(word)).toContain('the rain falls on the roof');
  });
});
