import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import App from '../src/App';
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

describe('app', () => {
  test('renders exactly four textual table columns and Persian as RTL', () => {
    render(<App initialWords={words} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(4);
    // direction belongs to the cell, whatever markup the meaning is wrapped in
    expect(screen.getByText('بودن').closest('td')).toHaveAttribute(
      'dir',
      'rtl',
    );
    expect(screen.getByText('2 words')).toBeInTheDocument();
  });

  test('filters without accents and exposes a no-results state', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} />);
    const search = screen.getByRole('searchbox', { name: /Search the list/ });

    await user.type(search, 'etre');
    expect(screen.getByText('1 word')).toBeInTheDocument();
    expect(screen.getByText('être')).toBeInTheDocument();
    expect(screen.queryByText('maison')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'not-in-the-list');
    expect(screen.getByRole('status')).toHaveTextContent('No matches');
  });

  test('shows an honest gate when no release dataset is available', () => {
    render(<App initialWords={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'The vocabulary is being prepared',
    );
  });

  test('renders Spanish course with Spanish column header and title', async () => {
    const user = userEvent.setup();
    render(<App initialCourseId="spanish" />);

    expect(
      screen.getByRole('heading', { level: 1, name: /Spanish\s*1000/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Spanish' }),
    ).toBeInTheDocument();

    // switch to French
    const frenchSwitch = screen.getByRole('link', { name: /French\s*1000/ });
    await user.click(frenchSwitch);

    expect(
      screen.getByRole('heading', { level: 1, name: /French\s*1000/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'French' }),
    ).toBeInTheDocument();
  });
});
