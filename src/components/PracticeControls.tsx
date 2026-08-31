import type { PracticeSettings } from '../lib/practice';

type PracticeControlsProps = {
  settings: PracticeSettings;
  onSettingsChange(next: PracticeSettings): void;
  revealedCount: number;
  totalCount: number;
  onRevealAll(): void;
  onCoverAll(): void;
};

export function PracticeControls({
  settings,
  onSettingsChange,
  revealedCount,
  totalCount,
  onRevealAll,
  onCoverAll,
}: PracticeControlsProps) {
  return (
    <div className="practice-controls">
      <div className="practice-toggle">
        <input
          id="practice-mode"
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) =>
            onSettingsChange({ ...settings, enabled: event.target.checked })
          }
        />
        <label htmlFor="practice-mode">Practice mode</label>
      </div>

      {settings.enabled && (
        <div className="practice-options">
          <div className="practice-toggle">
            <input
              id="practice-hide-example"
              type="checkbox"
              checked={settings.hideExample}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  hideExample: event.target.checked,
                })
              }
            />
            <label htmlFor="practice-hide-example">Cover examples too</label>
          </div>

          <p className="practice-count" aria-live="polite">
            {revealedCount} of {totalCount} revealed
          </p>

          <div className="practice-actions">
            <button
              type="button"
              onClick={onRevealAll}
              disabled={revealedCount >= totalCount}
            >
              Reveal all
            </button>
            <button
              type="button"
              onClick={onCoverAll}
              disabled={revealedCount === 0}
            >
              Cover all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
