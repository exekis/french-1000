import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import App from '../src/App';
import { makeWord } from './fixtures';

// comfortably past the first-paint window, so the fill-in actually has work to do
const words = Array.from({ length: 320 }, (_, index) => makeWord(index + 1));

function renderedRows(): number {
  return document.querySelectorAll('tbody tr').length;
}

describe('progressive rendering', () => {
  test('paints a first screen of rows, then fills the list in', async () => {
    render(<App initialWords={words} />);

    // the count never lies about the list just because the rows are still arriving
    expect(screen.getByText('320 words')).toBeInTheDocument();
    expect(renderedRows()).toBeLessThan(words.length);

    await waitFor(() => expect(renderedRows()).toBe(words.length), {
      timeout: 10000,
    });
  }, 15000);

  // one change event rather than three keystrokes, so a slow runner is not re-rendering
  // the whole list once per typed digit
  test('a rank jump reaches a word the fill-in has not got to yet', async () => {
    const scrollIntoView = vi.fn<() => void>();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<App initialWords={words} />);

    fireEvent.change(screen.getByLabelText('Go to rank'), {
      target: { value: '300' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled(), {
      timeout: 10000,
    });
    expect(document.getElementById('word-0300')).not.toBeNull();
  }, 15000);
});
