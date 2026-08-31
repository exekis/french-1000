import type { CSSProperties, ReactNode } from 'react';

const coveredStyle: CSSProperties = { visibility: 'hidden' };

type MaskedMeaningProps = {
  hidden: boolean;
  label: string;
  onReveal(): void;
  children: ReactNode;
};

// the real text stays in the layout so nothing reflows when it is uncovered. hiding is
// an inline style rather than a stylesheet rule so a covered meaning is never exposed
// by a stylesheet that failed to load, and aria-hidden keeps it out of the reading order
export function MaskedMeaning({
  hidden,
  label,
  onReveal,
  children,
}: MaskedMeaningProps) {
  return (
    <span className="masked" data-hidden={hidden ? 'true' : undefined}>
      <span
        className="masked-text"
        style={hidden ? coveredStyle : undefined}
        aria-hidden={hidden || undefined}
      >
        {children}
      </span>
      {hidden && (
        <button
          type="button"
          className="masked-cover"
          onClick={onReveal}
          aria-label={`Reveal ${label}`}
        >
          <span aria-hidden="true">?</span>
        </button>
      )}
    </span>
  );
}
