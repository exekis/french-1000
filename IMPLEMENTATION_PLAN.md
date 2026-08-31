# French 1000 implementation plan

## Project status and hand-off

This repository was scaffolded on 2026-08-29. The application, imported 1,000-row dataset, content pipeline, release validators, and automated tests are implemented. A new agent should still read this file before changing code or regenerating content.

Project path: `/Users/exekis/code/french-1000`

Repository: local Git repository on branch `main`; no remote has been configured.

The exact `french_top_1000_english_persian.xlsx` workbook was located, copied into the ignored raw-data directory, imported, and audited. The published dataset retains its 1,000-row source order, English and Persian cells, and `Sources & Method` provenance. Do not reconstruct or replace it with a different list.

## Outcome

Ship a fast, static, mobile-friendly website for absolute beginners learning French. It must preserve the ordered 1,000-word dataset and show, for every entry:

1. French word
2. Concise English meaning
3. Concise Persian meaning
4. One short, natural French example that teaches the intended sense
5. One adjacent button that plays the French word's pronunciation

The visual data table has exactly the four requested textual columns. Rank may appear as a small non-data label, and the audio control sits in the French cell. It is not a fifth textual column. No account, database, backend, or client-side API key is required in production.

## Source context and confidence boundary

The workbook has exactly 1,000 unique French entries in source order with concise English and Persian meanings. Its `Sources & Method` sheet says the source was a programmatically parsed Brunet/Eduscol frequency list cross-checked against a modern learner-oriented spoken-French list, with some dated or literary terms replaced. The structure and sheet contents are verified by the import audit; the upstream methodology remains a source claim rather than an independently reproduced result.

The importer verifies the workbook against the acceptance checks below and preserves the `Sources & Method` sheet in the provenance record. Any future workbook change must pass the same gate before content is regenerated.

## Scope

### Included in v1

- Import the supplied workbook into a reviewed, versioned JSON dataset.
- Preserve the exact ranking from 1 through 1,000 and the three supplied meanings after review.
- Produce one clear A1/A2-level French example for every word and the intended sense.
- Provide a play-ready pronunciation source for each word without distributing unlicensed recordings or exposing a paid API key.
- Build a static single-page React application with search, rank navigation, audio playback, and responsive table/card layouts.
- Make Persian readable as right-to-left text and make all controls keyboard and screen-reader accessible.
- Validate data, audio coverage, audio playback, search, layout, and the static production build.
- Deploy the static build to GitHub Pages unless a different host is deliberately selected before deployment.

### Not included in v1

- Login, user progress, favourites, spaced repetition, quizzes, streaks, payments, or a database.
- Translation or sentence audio buttons. A future version may add sentence audio, but v1 plays the word only.
- A claim that every item was recorded by a native speaker. The UI must not make this claim if any item uses synthetic fallback audio.
- Scraping Forvo, dictionary sites, or any other service.
- Live network calls to pronunciation, translation, or AI vendors from a visitor's browser.
- Changing the 1,000-word ranking without a documented replacement source and explicit approval.

## Decisions and assumptions

| Area | Decision | Reason |
| --- | --- | --- |
| Project name | `french-1000` | Descriptive, short, and matches the dataset. |
| Application | Vite, React, TypeScript, static export | A small typed client is easy to maintain and deploy without a backend. |
| Hosting | GitHub Pages initially | The application and its audio assets can be served as static files. Configure Vite's base path for the repository name. |
| Data at runtime | One static JSON file bundled with the site | No database or server is necessary for 1,000 entries. |
| Audio delivery | The browser's installed `fr-FR` speech engine | It requires no distributed recording, visitor credential, or network vendor call. Voice quality and offline availability vary by browser and operating system. |
| Audio policy | Use browser speech until a human or static neural source has explicit redistribution rights | Forvo's API terms prohibit caching, Google Cloud credentials were unavailable, and shipping unlicensed or unaudited audio would be a worse release choice. |
| Visible content | Four textual columns only | This matches the user's requested table. |
| Example quality | Generated in resumable batches, deterministically validated, then assessed through a separate review prompt | A blind 1,000-row generation is not trustworthy enough. Failed rows are removed and regenerated or explicitly overridden, while statuses remain `auto-checked` rather than claiming human review. |
| Deployment data | Only publish data and audio that are permitted to be redistributed | Pronunciation licences must be verified before files are committed or deployed. |

If the user later prefers a different project name, rename the directory before writing application code and update this document, the package name, and GitHub Pages base path together.

## User experience requirements

### Main screen

- A clear title and one-sentence explanation that the list is ordered by the supplied ranking.
- A single search field that matches French words, English meanings, Persian meanings, and example text without calling a server.
- A result count and a visible no-results state.
- The complete ordered list when there is no search query. Do not silently reshuffle or paginate away entries.
- Desktop view: four-column table headed French, English, Persian, and Example.
- Mobile view: a compact card per entry while preserving field labels and ranking.
- A small rank label such as `#27` attached to the French term.
- A clearly labelled play/pause audio button within the French field. Starting a new word stops the prior word.
- An unobtrusive error state when pronunciation playback fails and an accessible loading state while it starts.
- Optional, low-cost enhancement after the core list works: next/previous rank navigation and a random-word button.

### Language and typography

- French and English are left-to-right; Persian value cells use `lang="fa"` and `dir="rtl"`.
- Do not auto-translate the supplied Persian text or normalize it in a way that changes meaning.
- Use a legible font stack with Persian glyph support. Verify on macOS and a mobile browser.
- Search must accept French accents. It should match both `être` and an accent-insensitive query such as `etre` while displaying the stored spelling exactly.

### Accessibility and resilience

- Every play button has an `aria-label` naming its French word and works with keyboard Enter/Space.
- Search has a visible label, a keyboard focus state, and does not steal focus while results update.
- Respect `prefers-reduced-motion`; no auto-play and no decorative animation needed for comprehension.
- Use sufficient contrast and do not rely on colour alone for play/loading/error state.
- Preserve a text-only usable list if audio fails. Audio failure cannot hide meanings or examples.
- Do not add analytics, tracking pixels, or cookies in v1.

## Data contract

The checked-in runtime source of truth will be `src/data/words.json`, an array in rank order with exactly 1,000 objects. It must be generated from a reviewed curated file, not hand-edited in the UI.

Each record uses this shape:

```ts
type Word = {
  id: string;                 // stable, zero-padded rank such as "0001"
  rank: number;               // integer 1 through 1000, unique and contiguous
  french: string;             // display spelling from reviewed vocabulary source
  english: string;            // concise learner-oriented supplied/reviewed meaning
  persian: string;            // concise Persian meaning, UTF-8, displayed RTL
  exampleFrench: string;      // reviewed A1/A2 example, ending in sentence punctuation
  exampleTarget: string;      // the exact surface form or permitted inflection demonstrated
  pronunciationTarget: string;// exact word or SSML-safe pronunciation form used for audio
  pronunciationIpa?: string; // override only when spelling requires a specific pronunciation
  audio: {
    path: string;             // e.g. "/audio/0001-le.mp3"
    provider: "forvo" | "google-cloud-tts" | "browser-speech";
    kind: "human" | "neural";
    licenseReference: string; // internal record identifying permitted use
  };
  review: {
    meaning: "imported" | "reviewed";
    example: "pending" | "auto-checked" | "human-reviewed";
    pronunciation: "pending" | "auto-checked" | "human-reviewed";
    flags: string[];          // e.g. ["homograph", "function-word"]
  };
};
```

Only `french`, `english`, `persian`, and `exampleFrench` are visible as text. Metadata is deliberately retained so that questionable pronunciations, examples, and licence decisions are auditable.

### Dataset invariants

- Exactly 1,000 records.
- `rank` is every integer from 1 to 1,000 once, in ascending array order.
- `id` equals zero-padded `rank` and is unique.
- French terms are unique after the agreed normalization rule. If a legitimate duplicate spelling has distinct senses, do not silently discard it; document it and obtain approval.
- No French, English, Persian, example, audio path, source, or review field is blank at release.
- Each example contains the documented `exampleTarget`, or records a justified inflection in `exampleTarget`.
- Each pronunciation entry has one audited provider/path record. Static files, if introduced later, must also exist, decode, and have non-zero duration.
- All JSON is UTF-8 and Persian survives a write-read round trip unchanged.

## Content pipeline

The content pipeline is a build-time process. Secrets remain local and all generated output is reviewed before publication.

### Phase 0: intake and provenance gate

1. Put the received workbook at `data/raw/french_top_1000_english_persian.xlsx`. This directory is Git-ignored.
2. Build `scripts/import-workbook.ts` to read the `Top 1000` sheet and capture sheet names, headers, row count, unique French count, blank-cell count, and any `Sources & Method` content.
3. Write the resulting machine-readable audit to `data/curated/import-audit.json` and a short human-readable `data/curated/PROVENANCE.md`.
4. Stop if headers do not resolve unambiguously to French, English, Persian; if row count is not 1,000; or if the ranking cannot be inferred from source order. Do not repair these silently.

### Phase 1: normalize and protect source meanings

1. Preserve source row number and raw cells in an ignored local audit file.
2. Normalize only presentation-safe details: Unicode NFC, whitespace, apostrophe consistency, and malformed control characters. Record every change.
3. Keep the supplied English/Persian meaning as the starting meaning. Any semantic edit requires a review note with the reason and source.
4. Classify each word into risk tags: article, preposition, pronoun, conjunction, negation, inflection-sensitive, homograph, idiom, gender-sensitive, or ordinary lexical item.
5. Create a review queue for high-risk items. Examples include `plus`, `est`, `tous`, `fils`, `que`, `y`, `en`, `de`, and `chez` where the sentence or intended sense affects pronunciation or teaching value.

### Phase 2: generate examples

Generate examples in small, resumable batches, keeping the prompt and model version in a local build log. Each request includes rank, French word, intended English/Persian sense, risk tag, and these rules:

- Natural contemporary French, not a literal translation.
- Usually 5 to 10 words, short enough for a beginner to parse.
- A1/A2 grammar and common situations or names.
- Demonstrate the intended sense, not an unrelated homograph.
- Include the target spelling when appropriate. For lemmas such as `être`, an explicitly recorded common inflection is allowed.
- Do not use an unexplained idiom, rare proper noun, offensive content, or needless advanced grammar.
- Add normal sentence punctuation.

Store candidates separately from approved data in `data/curated/example-candidates.jsonl`. Then run deterministic checks for presence of the target/recorded inflection, sentence length, duplicates, prohibited placeholders, valid Unicode, and French punctuation. Run a French grammar/style checker where licensing permits, but treat it as a flagging signal rather than an automatic rewrite engine.

Use a separate review prompt to assess sense alignment, grammaticality, naturalness, beginner suitability, and whether the target is genuinely taught. Remove every failed row and regenerate it or add a transparent curated override that passes both gates. Retain risk flags in the published record. A fluent human review remains a desirable future enhancement, but it is not fabricated as a release status; no entry is labelled `human-reviewed` unless that review actually occurs.

### Phase 3: pronunciation metadata and audio

Implementation note: Forvo's official API terms checked on 2026-08-29 state that audio links expire after two hours and audio pronunciation caching is not allowed. `scripts/fetch-human-audio.ts` therefore records a blocked provider audit and never downloads Forvo audio. Do not enable static Forvo files unless a separate written licence explicitly permits download, caching, and public redistribution.

1. For every word, set `pronunciationTarget` to the intended spoken form. Add IPA only for a confirmed override. Do not guess IPA just to fill a field.
2. Query a licensed human-pronunciation provider through its documented API, beginning with Forvo if its current terms, API quota, attribution, caching, download, and public redistribution rights permit this exact use. Record the recording identifier, selected pronunciation, licence/terms reference, retrieval date, and attribution requirements.
3. Never scrape audio from Forvo or a browser session. A human recording retrieved through an API is not automatically licensed for static redistribution, so this gate is mandatory.
4. Until an eligible static source is available, use the browser's local `speechSynthesis` engine with `fr-FR`, a conservative speaking rate, a single playback controller, and explicit unsupported/error states.
5. Record runtime browser speech as `browser-speech:fr-FR`. If static audio is introduced later, save deterministic filenames such as `public/audio/0042-être.mp3` and retain per-file provenance.
6. Validate static file MIME type, decodability, duration, and loudness when static files exist. Browser speech entries instead validate provider, runtime path, language target, and playback state behaviour.
7. Produce `data/curated/audio-audit.json` with coverage counts, provider counts, failures, and attribution obligations. Block release until coverage is exactly 1,000.

### Phase 4: publish the curated dataset

1. Merge only approved meanings, examples, audio paths, and review statuses into `src/data/words.json`.
2. Add `scripts/validate-dataset.ts` and make it fail on every invariant in this plan.
3. Generate a non-sensitive `public/data-sources.json` or About section only if the applicable provider licence requires attribution. Do not expose secret keys, raw provider responses, or private audit logs.

## Application architecture

Use a minimal Vite React TypeScript project. Avoid Redux, a router, a component library, and a server until a requirement proves they are needed.

```text
french-1000/
├── IMPLEMENTATION_PLAN.md
├── README.md
├── .env.example
├── .gitignore
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── data/
│   ├── raw/                         # ignored workbook input
│   └── curated/                     # provenance, audits, candidate/review outputs
├── public/
│   └── audio/                       # only licensed, release-ready audio
├── scripts/
│   ├── import-workbook.ts
│   ├── generate-examples.ts
│   ├── review-examples.ts
│   ├── fetch-human-audio.ts
│   ├── synthesize-fallback-audio.ts
│   ├── validate-audio.ts
│   ├── publish-dataset.ts
│   └── validate-dataset.ts
├── src/
│   ├── data/words.json
│   ├── types.ts
│   ├── lib/search.ts
│   ├── lib/audio.ts
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── components/
│       ├── SearchBar.tsx
│       ├── WordList.tsx
│       ├── WordRow.tsx
│       ├── WordCard.tsx
│       ├── PronunciationButton.tsx
│       └── EmptyState.tsx
└── tests/
    ├── dataset.test.ts
    ├── search.test.ts
    ├── audio.test.ts
    └── app.spec.ts
```

`lib/search.ts` should create accent-insensitive normalized search keys in memory while retaining the original display strings. It should return results in original rank order. `lib/audio.ts` owns one HTMLAudioElement instance, cancels previous playback before a new request, updates button state, and handles playback errors. Components must not each create competing audio elements.

The application should use native table markup for the desktop list unless the chosen responsive approach makes semantic cards necessary at all widths. With only 1,000 short rows, filtering the full array is fast enough without a search service or virtualisation. Add virtualisation only if actual browser profiling shows a problem.

## Implementation sequence

1. Create Vite React TypeScript skeleton, package scripts, linting, formatting, and tests. Configure GitHub Pages base path now, not at release time.
2. Add the typed data model and a failing dataset validation test using a small fixture.
3. Build and verify the workbook import and provenance audit before handling any actual content.
4. Build controlled example generation, validation, review queues, and export. Do not let unreviewed candidates reach `src/data/words.json`.
5. Resolve pronunciation licensing and run a ten-word pilot across simple words, function words, homographs, and words with accents. Listen to the output before scaling to 1,000.
6. Generate the remaining audio under the approved policy, validate all files, and record attribution obligations.
7. Implement the read-only UI: search, desktop table, mobile cards, Persian directionality, audio button states, empty state, and rank navigation if wanted.
8. Write unit, integration, and browser tests. Conduct manual listening and visual QA.
9. Build locally, inspect `dist/`, deploy a preview, then publish only after all release gates pass.

## Acceptance criteria

### Data

- The published dataset has exactly 1,000 unique ranked entries and passes every invariant in this document.
- The first through thousandth entries retain the source ordering unless a documented approved correction says otherwise.
- Every entry shows non-empty French, English, Persian, and example values.
- Every example is a grammatical, beginner-appropriate French sentence that demonstrates the documented word sense or recorded inflection.
- Persian text is visually right-to-left and not corrupted in the deployed build.

### Pronunciation

- Every entry has one working play button and one validated pronunciation source.
- The selected human, static neural, or browser-speech source and pronunciation target are traceable for every entry.
- A new play action stops the previous word. Playback failure is recoverable and understandable.
- There are no browser-visible credentials or runtime calls to paid pronunciation/TTS APIs.
- The product never labels neural fallback as a human recording.

### Website

- Search finds French words with and without accents and can find English, Persian, and example text.
- Default and search results remain in rank order.
- The list is usable with a keyboard, screen reader labels, desktop mouse, and a narrow mobile viewport.
- The production build contains only static assets and works after network caching with no backend endpoint.
- Page load, filtering, and audio interaction feel immediate on a typical phone and laptop. Measure before imposing a numeric performance target.

## Validation plan

| Layer | Check | Evidence |
| --- | --- | --- |
| Workbook intake | Header mapping, exactly 1,000 rows, uniqueness, no required blanks, provenance sheet captured | `import-audit.json` and import test |
| Dataset | All schema and rank/audio/example invariants | `npm run validate:data` and Vitest output |
| Examples | Deterministic checks, second-pass review, zero unresolved failures, retained risk flags | review log and approved curated export |
| Pronunciation | 1,000-entry provider/path audit and browser playback-state tests | `audio-audit.json`, Vitest, and Playwright output |
| UI units | Search normalisation/order, audio state transitions, Persian attributes | Vitest |
| Browser | Search with `etre`, play/replace audio, keyboard interaction, 375 px mobile layout, RTL rendering, no-result state | Playwright screenshots and test output |
| Production | Clean install, type check, lint, test, static build, inspect build output and preview | command logs and preview URL |
| Release | Check source terms/attribution, no secrets, no unlicensed audio, no raw workbook | release checklist |

The expected future commands are:

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run validate:data
npm test
npm run test:e2e
npm run build
npm run build:release
```

An implementing agent should add only commands that are actually configured, then update this list and the README with the verified invocation.

## Risks and containment

| Risk | Impact | Containment |
| --- | --- | --- |
| Source workbook changes or becomes unavailable | A regeneration could drift from the audited dataset | Preserve its SHA-256 and import audit, and fail rather than substituting another list. |
| Human-audio provider prohibits caching or redistribution | Static deployment may infringe terms | Verify the current API and content licence before any download. Keep browser speech until a source is explicitly distributable. |
| Homographs and function words have context-dependent pronunciation | Wrong pronunciation undermines the product | Retain risk flags and curated pronunciation targets, and add IPA only when confirmed. |
| Batch-generated examples are grammatical but unnatural or use the wrong sense | Poor teaching value | Constrained prompts, deterministic checks, a separate review prompt, explicit reviewed overrides, and no unresolved publish. |
| Audio repository becomes too large for comfortable Git hosting | Slow clones/deploys | Measure the pilot size. Use efficient licensed codecs, Git LFS only if allowed by the host/licence, or a permitted static object store while retaining a manifest. |
| API credentials or paid calls leak to users | Cost and security exposure | Build-time scripts only, `.env` ignored, no `VITE_` secrets, scan distribution before deploy. |
| Audio assets lack attribution | Licence or ethical breach | Keep per-file audit and render an About/attribution section if required. |

## Remaining external gate

The implementation and local production build are complete. Publishing to GitHub Pages still requires a configured Git remote and the user's choice to create or use a remote repository. Browser speech remains the transparent v1 pronunciation source until a future static provider passes the same licensing and provenance checks.

## Definition of complete

- The audited workbook import contains exactly 1,000 ranked entries.
- All published examples pass deterministic and separate review-prompt gates with zero unresolved queue items.
- Every entry has a validated browser-speech pronunciation record and recoverable playback states.
- Unit, integration, desktop/mobile browser, dataset, pronunciation, formatting, lint, type, build, and dependency-audit checks pass.
- `dist/` is a deployable static artifact; remote publication is performed only after a repository/host is configured.
