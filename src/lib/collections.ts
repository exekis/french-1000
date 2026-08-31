import { asStringArray, isRecord } from './storage';

export const COLLECTIONS_STORAGE_KEY = 'french-1000:collections';
export const COME_BACK_LIST_ID = 'come-back';
export const MAX_LIST_NAME = 48;

export type SavedList = {
  id: string;
  name: string;
  wordIds: string[];
};

export type Collections = {
  starred: string[];
  lists: SavedList[];
};

// a thousand words is too many to work through linearly, so there is always somewhere
// to put the ones that did not stick
export const defaultCollections: Collections = {
  starred: [],
  lists: [{ id: COME_BACK_LIST_ID, name: 'Come back to this', wordIds: [] }],
};

export type CollectionFilter = 'all' | 'starred' | `list:${string}`;

function uniqueIds(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function parseCollections(raw: unknown): Collections | null {
  if (!isRecord(raw)) return null;

  const lists = Array.isArray(raw.lists)
    ? raw.lists
        .filter(isRecord)
        .filter(
          (entry) =>
            typeof entry.id === 'string' && typeof entry.name === 'string',
        )
        .map((entry) => ({
          id: entry.id as string,
          name: (entry.name as string).slice(0, MAX_LIST_NAME),
          wordIds: uniqueIds(asStringArray(entry.wordIds)),
        }))
    : [];

  // the built-in list is restored if a stored payload dropped it
  const hasComeBack = lists.some((list) => list.id === COME_BACK_LIST_ID);
  return {
    starred: uniqueIds(asStringArray(raw.starred)),
    lists: hasComeBack ? lists : [...defaultCollections.lists, ...lists],
  };
}

export function toggleStar(
  collections: Collections,
  wordId: string,
): Collections {
  const starred = collections.starred.includes(wordId)
    ? collections.starred.filter((id) => id !== wordId)
    : [...collections.starred, wordId];
  return { ...collections, starred };
}

export function toggleInList(
  collections: Collections,
  listId: string,
  wordId: string,
): Collections {
  return {
    ...collections,
    lists: collections.lists.map((list) =>
      list.id === listId
        ? {
            ...list,
            wordIds: list.wordIds.includes(wordId)
              ? list.wordIds.filter((id) => id !== wordId)
              : [...list.wordIds, wordId],
          }
        : list,
    ),
  };
}

export function slugifyListName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'list'
  );
}

export function createList(
  collections: Collections,
  name: string,
): { collections: Collections; listId: string } | null {
  const trimmed = name.trim().slice(0, MAX_LIST_NAME);
  if (!trimmed) return null;

  const base = slugifyListName(trimmed);
  let id = base;
  let suffix = 2;
  while (collections.lists.some((list) => list.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  return {
    collections: {
      ...collections,
      lists: [...collections.lists, { id, name: trimmed, wordIds: [] }],
    },
    listId: id,
  };
}

export function deleteList(
  collections: Collections,
  listId: string,
): Collections {
  // the built-in list can be emptied but not removed, so there is always a default home
  if (listId === COME_BACK_LIST_ID) {
    return {
      ...collections,
      lists: collections.lists.map((list) =>
        list.id === listId ? { ...list, wordIds: [] } : list,
      ),
    };
  }
  return {
    ...collections,
    lists: collections.lists.filter((list) => list.id !== listId),
  };
}

export function countSaved(collections: Collections): number {
  return new Set([
    ...collections.starred,
    ...collections.lists.flatMap((list) => list.wordIds),
  ]).size;
}

export function selectFilteredIds(
  collections: Collections,
  filter: CollectionFilter,
): ReadonlySet<string> | null {
  if (filter === 'all') return null;
  if (filter === 'starred') return new Set(collections.starred);
  const listId = filter.slice('list:'.length);
  const list = collections.lists.find((entry) => entry.id === listId);
  return new Set(list?.wordIds ?? []);
}

export function exportCollections(collections: Collections): string {
  return `${JSON.stringify({ version: 1, ...collections }, null, 2)}\n`;
}

export function importCollections(payload: string): Collections | null {
  try {
    return parseCollections(JSON.parse(payload));
  } catch {
    return null;
  }
}
