# French 1000 implementation plan

## Project status and hand-off

This repository was scaffolded on 2026-08-29 and intentionally contains no application implementation yet. A new agent should read this file before adding code.

Project path: `/Users/exekis/code/french-1000`

Repository: local Git repository on branch `main`; no remote has been configured and no initial commit has been created.

The desired source workbook, referred to in the supplied conversation as `french_top_1000_english_persian.xlsx`, was not attached to this task and is not present in the repository. It is a required input. Do not reconstruct or invent its 1,000 entries from a different list.

## Outcome

Ship a fast, static, mobile-friendly website for absolute beginners learning French. It must preserve the ordered 1,000-word dataset and show, for every entry:

1. French word
2. Concise English meaning
3. Concise Persian meaning
4. One short, natural French example that teaches the intended sense
5. One adjacent button that plays the French word's pronunciation

The visual data table has exactly the four requested textual columns. Rank may appear as a small non-data label, and the audio control sits in the French cell. It is not a fifth textual column. No account, database, backend, or client-side API key is required in production.

## Source context and confidence boundary

The prior conversation, supplied by the user, says the workbook has exactly 1,000 unique French entries ordered by frequency/usefulness, with concise English and Persian meanings. It also says its source was a programmatically parsed Brunet/Eduscol frequency list cross-checked against a modern learner-oriented spoken-French list, with some dated or literary terms replaced. Those are input claims, not facts independently verified in this repository.

Before publishing, verify the actual workbook against the acceptance checks below and preserve any existing `Sources & Method` sheet in a local provenance record. If the workbook differs from the claims, report the difference and update this plan or the provenance record before generating content.

## Scope

### Included in v1

- Import the supplied workbook into a reviewed, versioned JSON dataset.
- Preserve the exact ranking from 1 through 1,000 and the three supplied meanings after review.
- Produce one clear A1/A2-level French example for every word and the intended sense.
- Obtain a play-ready pronunciation asset for each word, preferring licensed human French recordings and using high-quality neural French TTS only when human audio is unavailable or unusable.
- Build a static single-page React application with search, rank navigation, audio playback, and responsive table/card layouts.
- Make Persian readable as right-to-left text and make all controls keyboard and screen-reader accessible.
- Validate data, audio coverage, audio playback, search, layout, and the static production build.
- Deploy the static build to GitHub Pages unless a different host is deliberately selected before deployment.

### Not included in v1

- Login, user progress, favourites, spaced repetition, quizzes, streaks, payments, or a database.
- Translation or sentence audio buttons. A future version may add sentence audio, but v1 plays the word only.
- A claim that every item was recorded by a native speaker. The UI must not make this claim if any item uses synthetic fallback audio.
- Scraping Forvo, dictionary sites, or any other service.
- Live pronunciation, translation, or AI calls from a visitor's browser.
- Changing the 1,000-word ranking without a documented replacement source and explicit approval.

## Decisions and assumptions

| Area | Decision | Reason |
| --- | --- | --- |
| Project name | `french-1000` | Descriptive, short, and matches the dataset. |
| Application | Vite, React, TypeScript, static export | A small typed client is easy to maintain and deploy without a backend. |
| Hosting | GitHub Pages initially | The application and its audio assets can be served as static files. Configure Vite's base path for the repository name. |
| Data at runtime | One static JSON file bundled with the site | No database or server is necessary for 1,000 entries. |
| Audio delivery | Pre-generated local static files under `public/audio/` | It is instant after download, has no client key, and works independently of vendor availability. |
| Audio policy | Licensed human recording first; neural TTS fallback second | It best satisfies the request for natural pronunciation without blocking on incomplete human coverage. |
| Visible content | Four textual columns only | This matches the user's requested table. |
| Example quality | Generated in controlled batches, validated, then reviewed in risk-based manual passes | A blind 1,000-row generation is not trustworthy enough for a learning product. |
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
- An unobtrusive error state when an audio file fails and an accessible loading state while it buffers.
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
    provider: "forvo" | "google-cloud-tts";
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
- Each audio file exists, is decodable, has non-zero duration, and has one audited source/licence record.
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

Use a second, independent model or review prompt to assess sense alignment, grammaticality, naturalness, beginner suitability, and whether the target is genuinely taught. Require manual review for every flagged item and for a representative random sample of unflagged entries. The manual queue must include all function words, homographs, inflection-sensitive items, grammar words, failures from either automated check, and repeated sentence patterns. Do not claim native-speaker editorial review unless an actual fluent human has done it.

### Phase 3: pronunciation metadata and audio

1. For every word, set `pronunciationTarget` to the intended spoken form. Add IPA only for a confirmed override. Do not guess IPA just to fill a field.
2. Query a licensed human-pronunciation provider through its documented API, beginning with Forvo if its current terms, API quota, attribution, caching, download, and public redistribution rights permit this exact use. Record the recording identifier, selected pronunciation, licence/terms reference, retrieval date, and attribution requirements.
3. Never scrape audio from Forvo or a browser session. A human recording retrieved through an API is not automatically licensed for static redistribution, so this gate is mandatory.
4. When an eligible human recording is unavailable, unusable, or not licensed for this deployment, synthesize a fallback with an approved high-quality `fr-FR` neural voice through Google Cloud Text-to-Speech or a comparable documented service. Use escaped SSML and the curated text or IPA override. Record voice name, provider, request text hash, and generation date.
5. Save a deterministic output filename such as `public/audio/0042-être.mp3`. Use filename-safe slugs while keeping `id` as the authoritative lookup key.
6. Validate file existence, MIME type, decodability, duration, and loudness. Normalize output level conservatively without clipping. Never overwrite a human source with neural audio under the same provenance record.
7. Produce `data/curated/audio-audit.json` with coverage counts, provider counts, failures, and all attribution obligations. Block release until coverage is exactly 1,000 or an explicit approved exception policy exists.

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

- Every entry has one working play button and one validated audio asset.
- The selected human or neural source, pronunciation target, and licence record are traceable for every file.
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
| Examples | Deterministic checks, second-pass review, manual high-risk queue, random sample | review log and approved curated export |
| Pronunciation | Ten-word listening pilot, 1,000-file decode/duration audit, sample listening across source types | `audio-audit.json` and review log |
| UI units | Search normalisation/order, audio state transitions, Persian attributes | Vitest |
| Browser | Search with `etre`, play/replace audio, keyboard interaction, 375 px mobile layout, RTL rendering, no-result state | Playwright screenshots and test output |
| Production | Clean install, type check, lint, test, static build, inspect build output and preview | command logs and preview URL |
| Release | Check source terms/attribution, no secrets, no unlicensed audio, no raw workbook | release checklist |

The expected future commands are:

```sh
npm ci
npm run lint
npm run typecheck
npm run validate:data
npm test
npm run test:e2e
npm run build
```

An implementing agent should add only commands that are actually configured, then update this list and the README with the verified invocation.

## Risks and containment

| Risk | Impact | Containment |
| --- | --- | --- |
| Original workbook is missing or fails its claimed 1,000-row structure | Cannot truthfully preserve the user's dataset | Block import and request the exact file rather than substituting a web list. |
| Human-audio provider prohibits caching or redistribution | Static deployment may infringe terms | Verify current API and content licence before download. Use a permitted provider or neural-only fallback with transparent source metadata. |
| Homographs and function words have context-dependent pronunciation | Wrong word audio undermines the product | Curated pronunciation targets, IPA only when confirmed, high-risk review queue, and listening pilot. |
| Batch-generated examples are grammatical but unnatural or use the wrong sense | Poor teaching value | Constrained prompts, automated checks, independent review, manual high-risk review, and no unreviewed publish. |
| Audio repository becomes too large for comfortable Git hosting | Slow clones/deploys | Measure the pilot size. Use efficient licensed codecs, Git LFS only if allowed by the host/licence, or a permitted static object store while retaining a manifest. |
| API credentials or paid calls leak to users | Cost and security exposure | Build-time scripts only, `.env` ignored, no `VITE_` secrets, scan distribution before deploy. |
| Audio assets lack attribution | Licence or ethical breach | Keep per-file audit and render an About/attribution section if required. |

## Open gates before implementation can finish

These are not questions that a new agent should guess through:

1. Obtain the actual `french_top_1000_english_persian.xlsx` workbook from the user or its confirmed local location.
2. Confirm the current audio-provider terms cover retrieval, storage, public static playback, and any required attribution. Do this from official provider documentation at implementation time because terms and pricing change.
3. Decide, with the user if needed, whether any neural fallback is acceptable when a licensed human recording cannot be used. The default in this plan is yes, with honest hidden metadata and no misleading human-audio claim.
4. Confirm GitHub Pages as the final host only when the projected licensed audio size and terms fit it. Otherwise choose a static host that supports the chosen asset arrangement.

## Definition of ready to implement

The repository is ready to start implementation once the following are true:

- The workbook is available at the documented input path.
- The audio licensing gate has an approved provider and fallback policy.
- The implementing agent has read this plan and has not discovered a conflict with its repository instructions.
- Work begins at implementation sequence item 1, with the data import gate completing before production content is generated.
