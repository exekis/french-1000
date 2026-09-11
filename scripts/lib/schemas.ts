import { z } from 'zod/v4';

export const importedWordSchema = z.object({
  id: z.string().regex(/^\d{4}$/),
  rank: z.number().int().positive(),
  sourceRow: z.number().int().positive(),
  french: z.string().min(1),
  english: z.string().min(1),
  persian: z.string().min(1),
  riskFlags: z.array(z.string().min(1)),
});

export const exampleCandidateOutputSchema = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      exampleFrench: z.string(),
      exampleTarget: z.string(),
    }),
  ),
});

export const exampleReviewOutputSchema = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      decision: z.enum(['approve', 'revise', 'reject']),
      senseAligned: z.boolean(),
      grammatical: z.boolean(),
      natural: z.boolean(),
      beginnerSuitable: z.boolean(),
      targetTaught: z.boolean(),
      reasons: z.array(z.string()),
      suggestedExampleFrench: z.string().nullable(),
      suggestedExampleTarget: z.string().nullable(),
    }),
  ),
});

export const exampleApprovalSchema = z.object({
  id: z.string().regex(/^\d{4}$/),
  exampleFrench: z.string().min(1),
  exampleEnglish: z.string().min(1).optional(),
  exampleTarget: z.string().min(1),
  status: z.enum(['auto-checked', 'human-reviewed']),
  approvedAt: z.string().min(1),
  reviewerReference: z.string().min(1),
});

export const audioManifestEntrySchema = z
  .object({
    id: z.string().regex(/^\d{4}$/),
    path: z.union([
      z.string().regex(/^\/audio\/[A-Za-z0-9._-]+\.mp3$/),
      z.literal('browser-speech:fr-FR'),
      z.literal('browser-speech:es-ES'),
    ]),
    provider: z.enum([
      'forvo',
      'wikimedia-commons',
      'google-cloud-tts',
      'piper-neural',
      'browser-speech',
    ]),
    kind: z.enum(['human', 'neural']),
    licenseReference: z.string().min(1),
    pronunciationTarget: z.string().min(1),
    pronunciationIpa: z.string().min(1).optional(),
    reviewStatus: z.enum(['auto-checked', 'human-reviewed']),
    sourceId: z.string().min(1).optional(),
    sourceUrl: z.string().url().optional(),
    attribution: z.string().min(1).optional(),
    speaker: z.string().min(1).optional(),
    voiceName: z.string().min(1).optional(),
    requestTextHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    generatedAt: z.string().min(1).optional(),
    retrievedAt: z.string().min(1).optional(),
  })
  .superRefine((entry, context) => {
    if (entry.provider === 'forvo' || entry.provider === 'wikimedia-commons') {
      for (const field of [
        'sourceId',
        'sourceUrl',
        'attribution',
        'retrievedAt',
      ] as const) {
        if (!entry[field]) {
          context.addIssue({
            code: 'custom',
            path: [field],
            message: `${field} is required for human audio provenance`,
          });
        }
      }
    }
    // commons recordings are attributed per speaker so the credits page can name them
    if (entry.provider === 'wikimedia-commons' && !entry.speaker) {
      context.addIssue({
        code: 'custom',
        path: ['speaker'],
        message: 'speaker is required for Wikimedia Commons audio provenance',
      });
    }
    if (
      entry.provider === 'google-cloud-tts' ||
      entry.provider === 'piper-neural'
    ) {
      for (const field of [
        'voiceName',
        'requestTextHash',
        'generatedAt',
      ] as const) {
        if (!entry[field]) {
          context.addIssue({
            code: 'custom',
            path: [field],
            message: `${field} is required for neural audio provenance`,
          });
        }
      }
    }
    if (
      entry.provider === 'browser-speech' &&
      entry.path !== 'browser-speech:fr-FR' &&
      entry.path !== 'browser-speech:es-ES'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['path'],
        message: 'browser speech must use a runtime speech path',
      });
    }
    if (entry.provider === 'browser-speech' && entry.kind !== 'neural') {
      context.addIssue({
        code: 'custom',
        path: ['kind'],
        message: 'browser speech must be neural',
      });
    }
  });

export const wordSchema = z.object({
  id: z.string().regex(/^\d{4}$/),
  rank: z.number().int().positive(),
  french: z.string().min(1),
  english: z.string().min(1),
  persian: z.string().min(1),
  exampleFrench: z.string().min(1),
  exampleTarget: z.string().min(1),
  pronunciationTarget: z.string().min(1),
  pronunciationIpa: z.string().min(1).optional(),
  audio: z.object({
    path: z.union([
      z.string().regex(/^\/audio\/[A-Za-z0-9._-]+\.mp3$/),
      z.literal('browser-speech:fr-FR'),
      z.literal('browser-speech:es-ES'),
    ]),
    provider: z.enum([
      'forvo',
      'wikimedia-commons',
      'google-cloud-tts',
      'piper-neural',
      'browser-speech',
    ]),
    kind: z.enum(['human', 'neural']),
    licenseReference: z.string().min(1),
    attribution: z.string().min(1).optional(),
    sourceUrl: z.string().url().optional(),
  }),
  exampleAudio: z
    .object({
      path: z.string().regex(/^\/audio\/examples\/\d{4}\.mp3$/),
      provider: z.enum([
        'forvo',
        'wikimedia-commons',
        'google-cloud-tts',
        'piper-neural',
        'browser-speech',
      ]),
      voiceName: z.string().min(1),
      licenseReference: z.string().min(1),
    })
    .optional(),
  review: z.object({
    meaning: z.enum(['imported', 'reviewed']),
    example: z.enum(['pending', 'auto-checked', 'human-reviewed']),
    pronunciation: z.enum(['pending', 'auto-checked', 'human-reviewed']),
    flags: z.array(z.string()),
  }),
});

// the two courses only differ in which pair of headword fields they carry, so the
// spanish schema reuses the french shape and swaps that pair
export const spanishWordSchema = wordSchema
  .omit({ french: true, exampleFrench: true })
  .extend({
    spanish: z.string().min(1),
    exampleSpanish: z.string().min(1),
  });
