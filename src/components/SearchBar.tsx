type SearchBarProps = {
  query: string;
  onQueryChange(query: string): void;
  targetLanguageName?: string;
};

export function SearchBar({
  query,
  onQueryChange,
  targetLanguageName = 'French',
}: SearchBarProps) {
  return (
    <div className="search-field">
      <label htmlFor="word-search">Search the list</label>
      <div className="search-input-wrap">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          id="word-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={`${targetLanguageName}, English, Persian, or example`}
          autoComplete="off"
          spellCheck="false"
        />
      </div>
    </div>
  );
}
