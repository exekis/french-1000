import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';
import App from '../src/App';
import { COLLECTIONS_STORAGE_KEY } from '../src/lib/collections';
import { PRACTICE_STORAGE_KEY } from '../src/lib/practice';
import { makeWord } from './fixtures';

const words = [
  makeWord(1, {
    french: 'être',
    english: 'to be',
    persian: 'بودن',
    exampleFrench: 'Je veux être ici.',
    exampleTarget: 'être',
  }),
  makeWord(2, {
    french: 'maison',
    english: 'home',
    persian: 'خانه',
    exampleFrench: 'Ma maison est calme.',
    exampleTarget: 'maison',
  }),
];

beforeEach(() => {
  window.localStorage.clear();
});

async function enablePractice(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: /Practice mode/ }));
}

describe('practice mode', () => {
  test('covers every meaning but leaves the French word showing', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);

    expect(screen.getByText('to be')).toBeVisible();
    await enablePractice(user);

    expect(screen.getByText('to be')).not.toBeVisible();
    expect(screen.getByText('بودن')).not.toBeVisible();
    expect(screen.getByText('être')).toBeVisible();
    // the example stays readable until the reader asks for it to be covered too
    expect(screen.getByText('Je veux être ici.')).toBeVisible();
  });

  test('keeps pronunciation available while meanings are covered', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);
    await enablePractice(user);

    expect(
      screen.getByRole('button', { name: 'Play pronunciation of être' }),
    ).toBeEnabled();
  });

  test('reveals one word at a time without uncovering the rest', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);
    await enablePractice(user);

    await user.click(
      screen.getByRole('button', { name: 'Reveal English meaning of être' }),
    );

    expect(screen.getByText('to be')).toBeVisible();
    expect(screen.getByText('بودن')).toBeVisible();
    expect(screen.getByText('home')).not.toBeVisible();
  });

  test('covers the example too when asked', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);
    await enablePractice(user);
    await user.click(
      screen.getByRole('checkbox', { name: /Cover examples too/ }),
    );

    expect(screen.getByText('Je veux être ici.')).not.toBeVisible();
  });

  test('reveals and covers the whole visible list', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);
    await enablePractice(user);

    await user.click(screen.getByRole('button', { name: 'Reveal all' }));
    expect(screen.getByText('to be')).toBeVisible();
    expect(screen.getByText('home')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Cover all' }));
    expect(screen.getByText('to be')).not.toBeVisible();
  });

  test('counts what is still hidden', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);
    await enablePractice(user);

    expect(screen.getByText('0 of 2 revealed')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Reveal English meaning of être' }),
    );
    expect(screen.getByText('1 of 2 revealed')).toBeInTheDocument();
  });

  test('remembers that practice was on', async () => {
    const user = userEvent.setup();
    const first = render(<App initialWords={words} />);
    await enablePractice(user);
    first.unmount();

    render(<App initialWords={words} />);
    expect(
      await screen.findByRole('checkbox', { name: /Practice mode/ }),
    ).toBeChecked();
  });

  test('starts covered again when switched back on', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);
    await enablePractice(user);
    await user.click(screen.getByRole('button', { name: 'Reveal all' }));
    await enablePractice(user);
    await enablePractice(user);

    expect(screen.getByText('to be')).not.toBeVisible();
  });
});

describe('starring and lists', () => {
  test('stars a word and keeps it after a reload', async () => {
    const user = userEvent.setup();
    const first = render(<App initialWords={words} />);
    await user.click(screen.getByRole('button', { name: 'Star être' }));
    expect(screen.getByRole('button', { name: 'Unstar être' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    first.unmount();

    render(<App initialWords={words} />);
    expect(
      await screen.findByRole('button', { name: 'Unstar être' }),
    ).toBeInTheDocument();
  });

  test('narrows the list to starred words', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);
    await user.click(screen.getByRole('button', { name: 'Star être' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Show/ }),
      'starred',
    );

    expect(screen.getByText('1 word')).toBeInTheDocument();
    expect(screen.queryByText('maison')).not.toBeInTheDocument();
  });

  test('adds a word to the built-in list from its menu', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);
    await user.click(
      screen.getByRole('button', { name: 'Add maison to a list' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Come back to this' }),
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: /Show/ }),
      'list:come-back',
    );
    expect(screen.getByText('1 word')).toBeInTheDocument();
    expect(screen.getByText('maison')).toBeInTheDocument();
  });

  test('creates a new list and files the word into it', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);
    await user.click(
      screen.getByRole('button', { name: 'Add être to a list' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: /New list/ }),
      'Verbs I keep missing',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const select = screen.getByRole('combobox', { name: /Show/ });
    expect(
      within(select).getByRole('option', {
        name: /Verbs I keep missing \(1\)/,
      }),
    ).toBeInTheDocument();
  });

  test('closes the list menu on Escape', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);
    const opener = screen.getByRole('button', { name: 'Add être to a list' });
    await user.click(opener);
    expect(opener).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(opener).toHaveAttribute('aria-expanded', 'false');
  });

  test('explains an empty saved list rather than showing a search error', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Show/ }),
      'starred',
    );

    expect(screen.getByRole('status')).toHaveTextContent('This list is empty');
  });

  test('ignores stored collections that are not usable', async () => {
    window.localStorage.setItem(COLLECTIONS_STORAGE_KEY, '{"starred":');
    window.localStorage.setItem(PRACTICE_STORAGE_KEY, 'nonsense');
    render(<App initialWords={words} />);

    expect(await screen.findByText('2 words')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Practice mode/ }),
    ).not.toBeChecked();
  });
});
