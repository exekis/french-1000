import { useEffect, useId, useRef, useState } from 'react';
import type { Collections } from '../lib/collections';
import { getWordTerm, type Word } from '../types';

type WordSaveControlsProps = {
  word: Word;
  collections: Collections;
  onToggleStar(wordId: string): void;
  onToggleInList(listId: string, wordId: string): void;
  onCreateList(name: string, wordId: string): void;
};

export function WordSaveControls({
  word,
  collections,
  onToggleStar,
  onToggleInList,
  onCreateList,
}: WordSaveControlsProps) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const wrap = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const term = getWordTerm(word);
  const isStarred = collections.starred.includes(word.id);
  const listCount = collections.lists.filter((list) =>
    list.wordIds.includes(word.id),
  ).length;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function submitNewList(event: React.FormEvent) {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    onCreateList(name, word.id);
    setDraftName('');
  }

  return (
    <div className="save-controls" ref={wrap}>
      <button
        type="button"
        className="star-button"
        aria-pressed={isStarred}
        aria-label={`${isStarred ? 'Unstar' : 'Star'} ${term}`}
        onClick={() => onToggleStar(word.id)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="m12 4 2.4 5.1 5.6.8-4 4 .9 5.6-4.9-2.7-4.9 2.7.9-5.6-4-4 5.6-.8z"
            fill={isStarred ? 'currentColor' : 'none'}
          />
        </svg>
      </button>

      <button
        type="button"
        className="list-button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Add ${term} to a list`}
        data-in-list={listCount > 0 ? 'true' : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 4h10v16l-5-3.6L7 20z"
            fill={listCount > 0 ? 'currentColor' : 'none'}
          />
        </svg>
      </button>

      {open && (
        <div className="list-menu" id={menuId}>
          <p className="list-menu-title">Lists</p>
          <ul>
            {collections.lists.map((list) => {
              const checked = list.wordIds.includes(word.id);
              return (
                <li key={list.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleInList(list.id, word.id)}
                    />
                    <span>{list.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <form onSubmit={submitNewList}>
            <label htmlFor={`${menuId}-new`}>New list</label>
            <div>
              <input
                id={`${menuId}-new`}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Verbs I keep missing"
                maxLength={48}
                autoComplete="off"
              />
              <button type="submit" disabled={!draftName.trim()}>
                Add
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
