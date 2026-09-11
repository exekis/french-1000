import { z } from 'zod/v4';
import { readJson } from './io';
import { fromRoot } from './paths';
import { requirePassedImportAudit } from './pipeline-gates';
import { importedWordSchema } from './schemas';
import type { ImportedWord } from './pipeline-types';

export type MeaningsCourseId = 'french' | 'spanish';

// the meanings pipeline only ever needs the headword and the two baseline glosses, so
// both courses are flattened to this shape before generation or publication
export type CourseWord = {
  id: string;
  rank: number;
  term: string;
  english: string;
  persian: string;
};

export type MeaningsDataset = {
  courseId: MeaningsCourseId;
  languageName: string;
  wordsPath: string;
  candidatesPath: string;
  reviewsPath: string;
  correctionsPath: string;
  // the french course builds its list from the curation chain, so where the words are
  // read from and where the shipped list lives are not the same path
  publishedWordsPath: string;
  exampleCandidatesPath: string;
  exampleCorrectionsPath: string;
  exampleAuditPath: string;
  outputDirectory: string;
  auditPath: string;
  defaultLanguages: string;
};

// the spanish list is already published rather than coming out of the workbook import,
// so it carries the shipped record shape instead of the curation one
const publishedSpanishWordSchema = z.object({
  id: z.string().regex(/^\d{4}$/),
  rank: z.number().int().positive(),
  spanish: z.string().min(1),
  english: z.string().min(1),
  persian: z.string().min(1),
});

export const meaningsDatasets: Record<MeaningsCourseId, MeaningsDataset> = {
  french: {
    courseId: 'french',
    languageName: 'French',
    wordsPath: fromRoot('data/curated/imported-words.json'),
    candidatesPath: fromRoot('data/curated/meaning-candidates.jsonl'),
    reviewsPath: fromRoot('data/curated/meaning-reviews.jsonl'),
    correctionsPath: fromRoot('data/curated/meaning-corrections.jsonl'),
    publishedWordsPath: fromRoot('src/data/words.json'),
    exampleCandidatesPath: fromRoot(
      'data/curated/example-translation-candidates.jsonl',
    ),
    exampleCorrectionsPath: fromRoot(
      'data/curated/example-translation-corrections.jsonl',
    ),
    exampleAuditPath: fromRoot('data/curated/example-translation-audit.json'),
    outputDirectory: fromRoot('src/data/meanings'),
    auditPath: fromRoot('data/curated/meaning-audit.json'),
    defaultLanguages: 'es,de,it,pt,ar,zh',
  },
  spanish: {
    courseId: 'spanish',
    languageName: 'Spanish',
    wordsPath: fromRoot('src/data/spanish/words.json'),
    candidatesPath: fromRoot('data/curated/spanish-meaning-candidates.jsonl'),
    reviewsPath: fromRoot('data/curated/spanish-meaning-reviews.jsonl'),
    correctionsPath: fromRoot('data/curated/spanish-meaning-corrections.jsonl'),
    publishedWordsPath: fromRoot('src/data/spanish/words.json'),
    exampleCandidatesPath: fromRoot(
      'data/curated/spanish-example-translation-candidates.jsonl',
    ),
    exampleCorrectionsPath: fromRoot(
      'data/curated/spanish-example-translation-corrections.jsonl',
    ),
    exampleAuditPath: fromRoot(
      'data/curated/spanish-example-translation-audit.json',
    ),
    outputDirectory: fromRoot('src/data/spanish/meanings'),
    auditPath: fromRoot('data/curated/spanish-meaning-audit.json'),
    defaultLanguages: 'fr,de,it,pt,ar,zh',
  },
};

export function resolveMeaningsDataset(value?: string): MeaningsDataset {
  const courseId = (value ?? 'french') as MeaningsCourseId;
  const dataset = meaningsDatasets[courseId];
  if (!dataset) throw new Error(`Unknown course ${value}`);
  return dataset;
}

export async function readCourseWords(
  dataset: MeaningsDataset,
): Promise<CourseWord[]> {
  const records = await readJson<unknown[]>(dataset.wordsPath);

  if (dataset.courseId === 'spanish') {
    return records.map((record, index) => {
      const parsed = publishedSpanishWordSchema.safeParse(record);
      if (!parsed.success) {
        throw new Error(
          `Invalid spanish word ${index}: ${parsed.error.message}`,
        );
      }
      const word = parsed.data;
      return {
        id: word.id,
        rank: word.rank,
        term: word.spanish,
        english: word.english,
        persian: word.persian,
      };
    });
  }

  const words = records.map((record, index) => {
    const parsed = importedWordSchema.safeParse(record);
    if (!parsed.success) {
      throw new Error(
        `Invalid imported word ${index}: ${parsed.error.message}`,
      );
    }
    return parsed.data as ImportedWord;
  });
  // the workbook import gate only guards the french curation path, which is the one
  // that actually comes out of a spreadsheet
  await requirePassedImportAudit(
    fromRoot('data/curated/import-audit.json'),
    words.length,
  );
  return words.map((word) => ({
    id: word.id,
    rank: word.rank,
    term: word.french,
    english: word.english,
    persian: word.persian,
  }));
}

// the example translation pass reads the published list for either course, since that
// is where the sentence it has to translate actually lives
export type CourseExample = CourseWord & { example: string };

const publishedExampleSchema = z.object({
  id: z.string().regex(/^\d{4}$/),
  rank: z.number().int().positive(),
  english: z.string().min(1),
  persian: z.string().min(1),
  french: z.string().min(1).optional(),
  spanish: z.string().min(1).optional(),
  exampleFrench: z.string().min(1).optional(),
  exampleSpanish: z.string().min(1).optional(),
});

export async function readCourseExamples(
  dataset: MeaningsDataset,
): Promise<CourseExample[]> {
  const records = await readJson<unknown[]>(dataset.publishedWordsPath);

  return records.map((record, index) => {
    const parsed = publishedExampleSchema.safeParse(record);
    if (!parsed.success) {
      throw new Error(
        `Invalid published word ${index}: ${parsed.error.message}`,
      );
    }
    const word = parsed.data;
    const term = word.spanish ?? word.french ?? '';
    const example = word.exampleSpanish ?? word.exampleFrench ?? '';
    if (!term || !example) {
      throw new Error(`Published word ${word.id} has no headword or example`);
    }
    return {
      id: word.id,
      rank: word.rank,
      term,
      english: word.english,
      persian: word.persian,
      example,
    };
  });
}
