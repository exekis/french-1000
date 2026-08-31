// @vitest-environment node

import { describe, expect, test } from 'vitest';
import {
  COME_BACK_LIST_ID,
  countSaved,
  createList,
  defaultCollections,
  deleteList,
  exportCollections,
  importCollections,
  parseCollections,
  selectFilteredIds,
  slugifyListName,
  toggleInList,
  toggleStar,
} from '../src/lib/collections';

describe('starring', () => {
  test('adds and removes a word', () => {
    const starred = toggleStar(defaultCollections, '0001');
    expect(starred.starred).toEqual(['0001']);
    expect(toggleStar(starred, '0001').starred).toEqual([]);
  });

  test('leaves lists untouched', () => {
    expect(toggleStar(defaultCollections, '0001').lists).toEqual(
      defaultCollections.lists,
    );
  });
});

describe('lists', () => {
  test('ships with a place to put words that did not stick', () => {
    expect(defaultCollections.lists).toHaveLength(1);
    expect(defaultCollections.lists[0]?.id).toBe(COME_BACK_LIST_ID);
  });

  test('puts one word in several lists at once', () => {
    const created = createList(defaultCollections, 'Verbs I keep missing')!;
    const both = toggleInList(
      toggleInList(created.collections, COME_BACK_LIST_ID, '0005'),
      created.listId,
      '0005',
    );
    expect(
      both.lists.filter((list) => list.wordIds.includes('0005')),
    ).toHaveLength(2);
  });

  test('refuses a blank name', () => {
    expect(createList(defaultCollections, '   ')).toBeNull();
  });

  test('keeps ids unique when two lists are named the same', () => {
    const first = createList(defaultCollections, 'Week 3')!;
    const second = createList(first.collections, 'Week 3')!;
    expect(second.listId).not.toBe(first.listId);
    expect(second.collections.lists).toHaveLength(3);
  });

  test('builds a readable id from an accented name', () => {
    expect(slugifyListName('Passé composé')).toBe('passe-compose');
    expect(slugifyListName('!!!')).toBe('list');
  });

  test('empties the built-in list rather than removing it', () => {
    const filled = toggleInList(defaultCollections, COME_BACK_LIST_ID, '0007');
    const after = deleteList(filled, COME_BACK_LIST_ID);
    expect(after.lists).toHaveLength(1);
    expect(after.lists[0]?.wordIds).toEqual([]);
  });

  test('removes a list the reader made', () => {
    const created = createList(defaultCollections, 'Week 3')!;
    expect(deleteList(created.collections, created.listId).lists).toHaveLength(
      1,
    );
  });
});

describe('filtering', () => {
  test('all words means no filter at all', () => {
    expect(selectFilteredIds(defaultCollections, 'all')).toBeNull();
  });

  test('narrows to starred words', () => {
    const starred = toggleStar(defaultCollections, '0003');
    expect([...selectFilteredIds(starred, 'starred')!]).toEqual(['0003']);
  });

  test('narrows to one list', () => {
    const filled = toggleInList(defaultCollections, COME_BACK_LIST_ID, '0009');
    expect([
      ...selectFilteredIds(filled, `list:${COME_BACK_LIST_ID}`)!,
    ]).toEqual(['0009']);
  });

  test('an unknown list shows nothing rather than everything', () => {
    expect([...selectFilteredIds(defaultCollections, 'list:missing')!]).toEqual(
      [],
    );
  });
});

describe('counting', () => {
  test('counts a word saved in two places only once', () => {
    const saved = toggleInList(
      toggleStar(defaultCollections, '0002'),
      COME_BACK_LIST_ID,
      '0002',
    );
    expect(countSaved(saved)).toBe(1);
  });
});

describe('export and import', () => {
  test('survives a round trip', () => {
    const created = createList(defaultCollections, 'Week 3')!;
    const saved = toggleInList(
      toggleStar(created.collections, '0004'),
      created.listId,
      '0011',
    );
    expect(importCollections(exportCollections(saved))).toEqual(saved);
  });

  test('rejects a file that is not saved lists', () => {
    expect(importCollections('not json at all')).toBeNull();
    expect(importCollections('[1,2,3]')).toBeNull();
  });
});

describe('reading stored data', () => {
  test('drops entries that are not word ids', () => {
    const parsed = parseCollections({
      starred: ['0001', 42, null, '0002'],
      lists: [],
    });
    expect(parsed?.starred).toEqual(['0001', '0002']);
  });

  test('removes duplicates', () => {
    expect(
      parseCollections({ starred: ['0001', '0001'], lists: [] })?.starred,
    ).toEqual(['0001']);
  });

  test('restores the built-in list when a stored payload lost it', () => {
    const parsed = parseCollections({ starred: [], lists: [] });
    expect(parsed?.lists.map((list) => list.id)).toEqual([COME_BACK_LIST_ID]);
  });

  test('skips malformed list entries', () => {
    const parsed = parseCollections({
      starred: [],
      lists: [{ id: 'ok', name: 'Fine', wordIds: ['0001'] }, { id: 5 }, null],
    });
    expect(parsed?.lists.map((list) => list.id)).toEqual([
      COME_BACK_LIST_ID,
      'ok',
    ]);
  });

  test('refuses anything that is not an object', () => {
    expect(parseCollections(null)).toBeNull();
    expect(parseCollections([])).toBeNull();
    expect(parseCollections('nope')).toBeNull();
  });
});
