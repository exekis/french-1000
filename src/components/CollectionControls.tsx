import { useId, useRef, useState } from 'react';
import {
  type CollectionFilter,
  type Collections,
  COME_BACK_LIST_ID,
  countSaved,
  exportCollections,
  importCollections,
} from '../lib/collections';

type CollectionControlsProps = {
  collections: Collections;
  filter: CollectionFilter;
  onFilterChange(filter: CollectionFilter): void;
  onImport(collections: Collections): void;
  onDeleteList(listId: string): void;
  courseSlug?: string;
};

export function CollectionControls({
  collections,
  filter,
  onFilterChange,
  onImport,
  onDeleteList,
  courseSlug = 'french-1000',
}: CollectionControlsProps) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectId = useId();

  const activeList = filter.startsWith('list:')
    ? collections.lists.find((list) => list.id === filter.slice('list:'.length))
    : undefined;

  function download() {
    // saved words live only in this browser, so an export file is the only way to move
    // them to another device or keep them through a cleared cache
    const blob = new Blob([exportCollections(collections)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${courseSlug}-lists.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${countSaved(collections)} saved words.`);
  }

  async function upload(file: File) {
    const parsed = importCollections(await file.text());
    if (!parsed) {
      setNotice('That file could not be read as a saved list.');
      return;
    }
    onImport(parsed);
    setNotice(`Imported ${countSaved(parsed)} saved words.`);
  }

  return (
    <div className="collection-controls">
      <div className="collection-filter">
        <label htmlFor={selectId}>Show</label>
        <select
          id={selectId}
          value={filter}
          onChange={(event) =>
            onFilterChange(event.target.value as CollectionFilter)
          }
        >
          <option value="all">All words</option>
          <option value="starred">
            Starred ({collections.starred.length})
          </option>
          {collections.lists.map((list) => (
            <option key={list.id} value={`list:${list.id}`}>
              {list.name} ({list.wordIds.length})
            </option>
          ))}
        </select>
      </div>

      <div className="collection-actions">
        {activeList && activeList.wordIds.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onDeleteList(activeList.id);
              if (activeList.id !== COME_BACK_LIST_ID) onFilterChange('all');
            }}
          >
            {activeList.id === COME_BACK_LIST_ID ? 'Empty list' : 'Delete list'}
          </button>
        )}
        <button type="button" onClick={download}>
          Export
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = '';
          }}
        />
      </div>

      {notice && <output className="collection-notice">{notice}</output>}
    </div>
  );
}
