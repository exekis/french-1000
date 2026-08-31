# Features

Backlog for French 1000, beyond the shipped word list and pronunciation audio.
Build order is 4, then 1, 3, 2. Bullets are the work; the notes explain intent.

## 4. Vintage French collage design

- [x] Aged paper palette and texture
- [x] Parisian display serif, typewriter labels
- [x] Ephemera reveal on scroll
- [x] Real public domain vintage scans, cut out as stickers
- [x] Restyle header, panel, table, cards, footer
- [x] Hold contrast, RTL, reduced motion, no horizontal overflow

The current look is generic modern editorial: navy blocks, a red accent, hard offset
shadows, uppercase sans labels. It reads as a component library rather than a French
vocabulary book.

The target is the reference collage: aged parchment, sepia and faded ink, layered
paper ephemera. Postcards, postage stamps, library cards, ticket stubs, botanical
engravings, ornate Art Nouveau flourishes, torn and deckled edges, pieces sitting at
slight angles as though pasted down.

Small collage pieces should drift in as the reader scrolls, so the page assembles
itself like a scrapbook being filled. Decoration only: `aria-hidden`, never
interactive, never a source of layout shift or horizontal scroll, and static when
`prefers-reduced-motion` is set.

The scraps are scanned public domain plates, prints and stamps rather than drawings,
cut off their pages at build time. Nothing is fetched at runtime and no third-party
collage art is used, so the site stays self contained and stays within its licences.

## 1. Practice mode

- [x] Toggle that hides every translation
- [x] Reveal one word at a time
- [x] Reveal all, cover all
- [x] Persist the setting
- [x] Optional: hide the example too

Reading a translation next to a word teaches recognition, not recall. Practice mode
blanks the English, Persian, and any other meaning columns so the reader sees only the
French and can test themselves, then reveals a single row on tap or keyboard without
disturbing the rest of the page.

Pronunciation stays available while hidden, since hearing a word and trying to recall
its meaning is the exercise.

The blanked cell must keep its height so nothing reflows on reveal, and screen readers
need the hidden state announced rather than silently emptied.

## 3. Starring and lists

- [x] Star a word
- [x] Named lists, many per word
- [x] Built-in "come back to this"
- [x] Filter the table by list
- [x] Persist locally
- [x] Export and import as JSON

A thousand words is too many to work through linearly. The reader needs to mark what
they got wrong and come back to it.

A star is the one-tap case. Named lists cover the rest: a word can sit in several at
once, so "come back to this", "verbs I keep missing", and "week 3" can overlap.

Storage is `localStorage`, since the site is static and has no accounts. That makes the
data per browser and easy to lose, so export and import as a JSON file is part of the
feature rather than a later addition.

## 2. More languages

- [x] Add Spanish, German, Italian, Portuguese, Arabic, Mandarin
- [x] Language picker, more than one at a time
- [x] Persist the choice
- [x] Only bundle what is selected
- [x] Per-language review gates in the pipeline
- [x] Correct script, direction, and font per language

English and Persian are hardcoded through the dataset, the schema, the table columns,
and the search index. Adding languages means making the meaning set data-driven end to
end rather than appending two more columns.

Each language needs the same review discipline the existing meanings got: generated,
deterministically checked, then reviewed for sense alignment before publication. A
wrong translation is worse than a missing one.

Bundling every language for every visitor would multiply the dataset well past its
current size, so translations should load per selected language instead of shipping in
one file. Right-to-left languages and non-Latin scripts need their own font stacks and
direction handling, which the Persian column already establishes a pattern for.
