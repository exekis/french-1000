import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      timeout: 5000,
    });
  });

  test('a rank jump reaches a word the fill-in has not got to yet', async () => {
    const scrollIntoView = vi.fn<() => void>();
    Element.prototype.scrollIntoView = scrollIntoView;
    const user = userEvent.setup();
    render(<App initialWords={words} />);

    const rankInput = screen.getByLabelText('Go to rank');
    await user.clear(rankInput);
    await user.type(rankInput, '300');
    await user.click(screen.getByRole('button', { name: 'Go' }));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(document.getElementById('word-0300')).not.toBeNull();
  });
});
