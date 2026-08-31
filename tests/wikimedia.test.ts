import { describe, expect, test } from 'vitest';
import {
  classifyAudioFile,
  commonsFilePageUrl,
  isRedistributableLicense,
  toCommonsTitle,
} from '../scripts/lib/wikimedia';

describe('commons audio selection', () => {
  test('accepts a Lingua Libre French recording and reads the speaker', () => {
    const candidate = classifyAudioFile(
      'Fichier:LL-Q150 (fra)-WikiLucas00-maison.wav',
      'maison',
    );
    expect(candidate).toMatchObject({
      speaker: 'WikiLucas00',
      source: 'lingua-libre',
      title: 'File:LL-Q150 (fra)-WikiLucas00-maison.wav',
    });
  });

  test('keeps speaker names that themselves contain hyphens', () => {
    expect(
      classifyAudioFile(
        'Fichier:LL-Q150 (fra)-Jérémy-Günther-Heinz Jähnick-être.wav',
        'être',
      ),
    ).toMatchObject({ speaker: 'Jérémy-Günther-Heinz Jähnick' });
  });

  test('rejects recordings of the same spelling in another language', () => {
    expect(
      classifyAudioFile('Fichier:LL-Q1860 (eng)-Ookap-le.wav', 'le'),
    ).toBeNull();
    expect(classifyAudioFile('Fichier:En-us-pour.ogg', 'pour')).toBeNull();
    expect(
      classifyAudioFile(
        'Fichier:LL-Q12107 (bre)-Nadej Roudour-pour.wav',
        'pour',
      ),
    ).toBeNull();
  });

  test('rejects a recording of a different word on the same page', () => {
    expect(
      classifyAudioFile('Fichier:LL-Q150 (fra)-Sartus85-maisons.wav', 'maison'),
    ).toBeNull();
  });

  test('accepts the older hand-uploaded recordings with an accent suffix', () => {
    expect(
      classifyAudioFile('Fichier:Fr-être-fr-ouest.ogg', 'être'),
    ).toMatchObject({ source: 'legacy-wiktionary', speaker: null });
  });

  test('ignores files that are not audio', () => {
    expect(
      classifyAudioFile('Fichier:LL-Q150 (fra)-Sartus85-le.svg', 'le'),
    ).toBeNull();
  });

  test('treats the curly apostrophe in the word list as a plain one', () => {
    expect(
      classifyAudioFile(
        "Fichier:LL-Q150 (fra)-Sartus85-aujourd'hui.wav",
        'aujourd’hui',
      ),
    ).not.toBeNull();
  });
});

describe('licence gating', () => {
  test('accepts the free Creative Commons and public domain licences', () => {
    for (const code of [
      'cc-by-sa-4.0',
      'cc-by-sa-3.0',
      'cc-by-4.0',
      'cc0',
      'pd',
    ]) {
      expect(isRedistributableLicense(code)).toBe(true);
    }
  });

  test('refuses non-commercial and no-derivatives terms', () => {
    for (const code of ['cc-by-nc-4.0', 'cc-by-nd-4.0', 'cc-by-nc-sa-3.0']) {
      expect(isRedistributableLicense(code)).toBe(false);
    }
  });

  test('refuses an unknown or missing licence', () => {
    expect(isRedistributableLicense('')).toBe(false);
    expect(isRedistributableLicense('all rights reserved')).toBe(false);
  });
});

describe('commons titles', () => {
  test('rewrites the localised namespace to the canonical one', () => {
    expect(toCommonsTitle('Fichier:Fr-le.ogg')).toBe('File:Fr-le.ogg');
    expect(toCommonsTitle('File:Fr-le.ogg')).toBe('File:Fr-le.ogg');
  });

  test('builds a file page url that keeps the namespace colon readable', () => {
    expect(commonsFilePageUrl('File:LL-Q150 (fra)-Sartus85-le.wav')).toBe(
      'https://commons.wikimedia.org/wiki/File:LL-Q150_(fra)-Sartus85-le.wav',
    );
  });
});
