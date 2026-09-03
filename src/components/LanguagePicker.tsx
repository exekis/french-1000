import {
  type LanguageCode,
  type LanguageDefinition,
  languages as defaultLanguages,
  orderLanguages,
} from '../lib/languages';

type LanguagePickerProps = {
  selected: readonly LanguageCode[];
  pending: readonly LanguageCode[];
  failed: readonly LanguageCode[];
  onChange(next: LanguageCode[]): void;
  availableLanguages?: LanguageDefinition[];
};

export function LanguagePicker({
  selected,
  pending,
  failed,
  onChange,
  availableLanguages = defaultLanguages,
}: LanguagePickerProps) {
  function toggle(code: LanguageCode, checked: boolean) {
    const next = checked
      ? orderLanguages([...selected, code])
      : selected.filter((entry) => entry !== code);
    // a row with no meaning column at all is just a headword, so the last one stays
    if (next.length === 0) return;
    onChange(next);
  }

  return (
    <div className="language-picker">
      <p className="language-picker-label" id="language-picker-label">
        Meanings
      </p>
      <ul aria-labelledby="language-picker-label">
        {availableLanguages.map((language) => {
          const checked = selected.includes(language.code);
          const isLast = checked && selected.length === 1;
          return (
            <li key={language.code}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isLast}
                  onChange={(event) =>
                    toggle(language.code, event.target.checked)
                  }
                />
                <span lang={language.code}>{language.endonym}</span>
                {pending.includes(language.code) && (
                  <span className="language-state">…</span>
                )}
                {failed.includes(language.code) && (
                  <span className="language-state">
                    <span aria-hidden="true">!</span>
                    <span className="visually-hidden">failed to load</span>
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
