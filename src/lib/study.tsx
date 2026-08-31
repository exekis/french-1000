import { createContext, type ReactNode, useContext } from 'react';
import { type Collections, defaultCollections } from './collections';
import { defaultPracticeSettings, type PracticeSettings } from './practice';

export type StudyContextValue = {
  settings: PracticeSettings;
  revealed: ReadonlySet<string>;
  reveal(wordId: string): void;
  collections: Collections;
  toggleStar(wordId: string): void;
  toggleInList(listId: string, wordId: string): void;
  createList(name: string, wordId: string): void;
};

// a quiet default means a row still renders correctly when it is mounted on its own,
// for instance in a component test, rather than throwing for a missing provider
const inertStudy: StudyContextValue = {
  settings: defaultPracticeSettings,
  revealed: new Set(),
  reveal: () => {},
  collections: defaultCollections,
  toggleStar: () => {},
  toggleInList: () => {},
  createList: () => {},
};

const StudyContext = createContext<StudyContextValue>(inertStudy);

export function StudyProvider({
  value,
  children,
}: {
  value: StudyContextValue;
  children: ReactNode;
}) {
  return (
    <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
  );
}

export function useStudy(): StudyContextValue {
  return useContext(StudyContext);
}
