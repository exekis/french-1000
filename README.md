# French 1000

A static, mobile-friendly French vocabulary site for absolute beginners. It presents the supplied ranked list of 1,000 words with English and Persian meanings, a reviewed beginner example, and an adjacent pronunciation control.

The implementation contract and release gates are in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Status

The complete 1,000-row dataset is published in `src/data/words.json`. It was imported from `french_top_1000_english_persian.xlsx`, checked for rank, identity, blank cells, and presentation-safe normalisation, then enriched through a resumable example-generation pipeline.

Every example passes deterministic target, length, punctuation, Unicode, and duplicate checks plus a separate model-prompt review for meaning, grammar, naturalness, beginner suitability, and target use. The resulting statuses are deliberately `auto-checked`, not `human-reviewed`.

## Pronunciation

Pronunciation is served from recordings of native French speakers, not from a speech synthesiser. The files come from French Wiktionary and the Lingua Libre recording project through Wikimedia Commons, and each one is redistributed under its own Creative Commons or public domain terms.

`npm run audio:commons` resolves a recording per word, rejects any candidate whose licence does not permit redistribution, downloads it, trims the leading and trailing silence, matches every clip to the same loudness target, and writes the speaker, licence, and source URL into the audio manifest. Speaker selection is ranked so most of the list is read by the same few voices rather than a different one per word.

The credits panel in the site footer names every speaker and licence, which is what the share-alike terms require.

Two entries in the list, `d’autres` and `l’une`, are elided phrases with no matching Commons recording. `npm run audio:piper` fills gaps like these with [Piper](https://github.com/OHF-Voice/piper1-gpl), an offline neural synthesiser, and records the voice model and licence alongside the generated file.

If a recording ever fails to load in the browser, playback falls back to the visitor's own `fr-FR` speech engine. That path now picks a voice explicitly instead of accepting the platform default, because the default on macOS and iOS is the compact formant voice that sounds synthetic. Google, Microsoft Natural, Siri, and enhanced or premium system voices are preferred, and the novelty voices are ranked last.

That fallback is only as good as what the visitor has installed. A stock macOS install exposes just the compact `fr-FR` voices, so there is nothing good to choose; better ones are a download under System Settings, Accessibility, Spoken Content, System Voice, Manage Voices, French. This is the reason pronunciation is shipped as recorded audio rather than left to the browser.

Forvo is not a static-audio source under its current API terms because its audio links expire and recordings may not be cached. `npm run audio:human` records that blocked decision without scraping or downloading audio.

## Studying

Three reading aids sit above the list.

**Practice mode** covers every meaning so the reader sees only the French and has to
recall the rest. Tapping a covered cell uncovers that one word; the rest stay covered.
Pronunciation keeps working while a word is covered, since hearing it and trying to
recall the meaning is the exercise. The covered text keeps its place in the layout, so
nothing reflows when it is revealed, and it is hidden with an inline style rather than
a stylesheet rule so a covered meaning is never exposed by CSS that failed to load.

**Stars and lists** mark what did not stick. A word can sit in any number of named
lists at once, and the list ships with a built-in "come back to this". The filter
narrows the table to one list. All of it lives in `localStorage`, which makes it per
browser and easy to lose, so the panel can export and import the whole set as JSON.

**Meanings** picks which languages get a column. English and Persian are the reviewed
baseline and travel inside `words.json`. Spanish, German, Italian, Portuguese, Arabic,
and Mandarin are separate files fetched only when a reader turns them on, so nobody
downloads a language they do not read. Right-to-left languages and non-Latin scripts
carry their own direction and font stack. Search covers every language currently
loaded, plus the two baseline meanings whether or not their column is showing.

Past four meaning columns the table scrolls sideways inside its own frame rather than
squeezing the text, which costs the sticky header at that width.

## Spoken examples

Every example sentence has its own recording beside it, separate from the word. The
word stays a native speaker; a sentence cannot be, because these sentences were written
for this site and no recording of them exists. They are spoken by Piper with the
CC-BY-4.0 `fr_FR-siwis-medium` voice, at a natural pace with the punctuation left in so
the voice phrases and pauses where a reader would.

Each clip goes through the same trim and loudness match the word recordings get, so
moving between a word and its sentence does not jump in volume. A sentence whose text
has changed since it was spoken is re-spoken rather than left stale, and the published
record only attaches a clip when it still matches the sentence on the page.

```sh
npm run audio:examples -- --voice-dir <dir> --license "<terms>"
```

## Translations

`npm run meanings:generate` asks a model for all requested languages at once per batch
of words, so one sense decision covers every language rather than drifting between
separate runs. Each answer then passes deterministic checks before it can be published:
non-empty, short enough to be a gloss rather than an explanation, no line breaks, not
the French word copied back, and written in the script that language actually uses.

`npm run meanings:review` is a second pass in the target language that looks for false
friends, the wrong sense of an ambiguous word, a mismatched part of speech, or an answer
in the wrong language. A correction is only accepted when it passes the same
deterministic checks a fresh candidate has to pass, so review cannot introduce a worse
value than it replaced.

`npm run meanings:publish` writes one file per language into `src/data/meanings/` and
records coverage and review status in `data/curated/meaning-audit.json`. A language that
has not been through review is labelled `generated` rather than `auto-checked`.

```sh
npm run meanings:generate -- --model <model> --base-url http://127.0.0.1:1234/v1
npm run meanings:review -- --model <model> --base-url http://127.0.0.1:1234/v1
npm run meanings:publish
```

## Collage artwork

The paper scraps in the margins are real scans, not drawings: botanical plates from
Edwards's Botanical Register and Curtis's Botanical Magazine, Costume Parisien fashion
plates, Brehms Tierleben and Bewick animal engravings, Exposition Universelle
photographs, autograph letters, Liebig trade cards and Type Sage stamps. Every one is public domain, pulled from Wikimedia
Commons through the same licence gate the pronunciation audio uses, and credited in the
footer panel with a link back to its file page.

`npm run art:stickers` searches Commons, rejects anything whose licence does not permit
redistribution, and cuts each scan off its page. Two treatments, because they are
different objects:

- **Plates and engravings** are keyed off their paper. Rather than tracing an outline,
  which looks like a bad selection, each pixel becomes transparent in proportion to how
  far it sits from the paper colour sampled at the border. The ink keeps its own grain
  and the edges stay soft, so it reads as something lifted off the page.
- **Photographs and stamps** keep their rectangle and get a paper mat. Keying a
  photograph cuts nothing out, because a photograph is dark across the whole frame; it
  only eats holes in the sky. A print is pasted down whole in a real collage, so that is
  what it does here.

The scans are brighter than a century-old album page, so CSS ages them back down and
multiplies the cut-outs into the paper rather than letting them float on top of it.

Third-party collage images, for instance anything saved off Pinterest, are not used.
They are other people's copyrighted work, and this repository already declines that
elsewhere.

## Local development

Requirements: Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

The default Vite base path is `/french-1000/`. Override it locally when needed:

```sh
VITE_BASE_PATH=/ npm run dev
```

## Verification

```sh
npm run verify:app
npm run test:e2e
npm run build:release
npm audit --audit-level=high
```

`build:release` validates all 1,000 ranked records and all 1,000 pronunciation manifest entries before building. Playwright covers desktop and mobile layouts, multilingual search, empty results, RTL Persian, and pronunciation state.

## Content pipeline

The raw workbook and provider logs stay ignored. Curated audits, candidates, reviews, approvals, and the published runtime dataset are reproducible build artifacts.

```sh
npm run import:workbook
npm run examples:generate -- --model <model>
npm run examples:prune
npm run examples:overrides
npm run examples:review -- --model <review-model>
npm run audio:commons
npm run audio:piper -- --voice-dir <dir> --license "<terms>"
npm run audio:browser
npm run audio:credits
npm run publish:data
npm run build:release
```

`audio:commons` is resumable and skips any word that already has a downloaded file, so it can be re-run after a network interruption. `audio:browser` only backfills words that still have no static file, so re-running the pipeline cannot silently replace recorded audio with synthesised speech. `audio:piper` needs a local Piper install and a downloaded voice:

```sh
pip install piper-tts
python -m piper.download_voices fr_FR-siwis-medium --data-dir <dir>
```

An OpenAI-compatible model server may be used only through a loopback URL, for example:

```sh
npm run examples:generate -- \
  --model qwen3-vl-8b-instruct-mlx \
  --base-url http://127.0.0.1:1234/v1 \
  --batch-size 1 \
  --concurrency 8
```

The same endpoint flags work for `examples:review`. Without `--base-url`, the scripts use the OpenAI Responses API and require `OPENAI_API_KEY` plus the corresponding model environment variable.

`data/curated/example-overrides.json` contains the small, explicit exception set used when a generator repeatedly produced invalid literal-target metadata or when the second review rejected a sentence. Overrides pass the same deterministic and second-pass gates as generated candidates.

## Deployment

Vite is configured for a `/french-1000/` static deployment. No deployment workflow is enabled because this local repository currently has no configured remote. The production artifact is generated in `dist/` with:

```sh
npm run build:release
```

## Provider references

- [Lingua Libre, the Wikimedia recording project the pronunciations come from](https://lingualibre.org/)
- [Wikimedia API etiquette and user agent policy](https://www.mediawiki.org/wiki/API:Etiquette)
- [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- [Piper, the offline neural synthesiser used for gaps](https://github.com/OHF-Voice/piper1-gpl)
- [Forvo API general information and terms](https://api.forvo.com/documentation/general-information/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Vite static deployment guide](https://vite.dev/guide/static-deploy.html)
