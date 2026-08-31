// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { afterEach, describe, expect, test } from 'vitest';
import { importWorkbook } from '../scripts/lib/workbook';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function makeWorkbook(rows: string[][]) {
  const directory = await mkdtemp(join(tmpdir(), 'french-1000-import-'));
  temporaryDirectories.push(directory);
  const workbook = new ExcelJS.Workbook();
  const words = workbook.addWorksheet('Top 1000');
  words.addTable({
    name: 'WordsTable',
    ref: 'A1',
    headerRow: true,
    columns: [
      { name: 'Rank' },
      { name: 'French' },
      { name: 'English' },
      { name: 'Persian' },
    ],
    rows: rows.map((row, index) => [index + 1, ...row]),
  });
  const provenance = workbook.addWorksheet('Sources & Method');
  provenance.addRow(['Source', 'Test fixture']);
  const input = join(directory, 'source.xlsx');
  await workbook.xlsx.writeFile(input);
  return { directory, input };
}

async function addSpreadsheetNamespacePrefix(input: string) {
  const bytes = await readFile(input);
  const archive = await JSZip.loadAsync(bytes);
  const namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

  await Promise.all(
    Object.values(archive.files).map(async (entry) => {
      if (entry.dir || !entry.name.endsWith('.xml')) return;

      const xml = await entry.async('string');
      if (!xml.includes(`xmlns="${namespace}"`)) return;

      archive.file(
        entry.name,
        xml
          .replace(`xmlns="${namespace}"`, `xmlns:x="${namespace}"`)
          .replace(/<(\/?)([A-Za-z][\w.-]*)(?=[\s/>])/g, '<$1x:$2'),
      );
    }),
  );

  const relation = archive.file('xl/worksheets/_rels/sheet1.xml.rels');
  if (relation) {
    archive.file(
      relation.name,
      (await relation.async('string')).replaceAll(
        'Target="../tables/',
        'Target="/xl/tables/',
      ),
    );
  }

  const output = await archive.generateAsync({ type: 'nodebuffer' });
  await writeFile(input, output);
}

function outputPaths(directory: string) {
  return {
    audit: join(directory, 'import-audit.json'),
    provenance: join(directory, 'PROVENANCE.md'),
    importedWords: join(directory, 'imported-words.json'),
    localRows: join(directory, 'local-rows.json'),
    localNormalizations: join(directory, 'normalizations.json'),
  };
}

describe('workbook import', () => {
  test('imports ordered multilingual rows and captures provenance', async () => {
    const { directory, input } = await makeWorkbook([
      ['être', 'to be', 'بودن'],
      ['maison', 'home', 'خانه'],
      ['bonjour', 'hello', 'سلام'],
    ]);
    const paths = outputPaths(directory);
    const result = await importWorkbook(input, paths, 3);

    expect(result.valid).toBe(true);
    expect(result.words.map((word) => word.id)).toEqual([
      '0001',
      '0002',
      '0003',
    ]);
    expect(result.words[0]?.persian).toBe('بودن');
    expect(await readFile(paths.provenance, 'utf8')).toContain('Test fixture');
  });

  test('blocks an incomplete workbook without publishing curated words', async () => {
    const { directory, input } = await makeWorkbook([
      ['être', 'to be', 'بودن'],
      ['maison', '', 'خانه'],
    ]);
    const paths = outputPaths(directory);
    const result = await importWorkbook(input, paths, 3);

    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toMatch(/expected 3 vocabulary rows/);
    expect(result.errors.join('\n')).toMatch(/blank required cells/);
    await expect(readFile(paths.importedWords, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  test('imports workbooks that use a namespace prefix', async () => {
    const { directory, input } = await makeWorkbook([
      ['être', 'to be', 'بودن'],
      ['maison', 'home', 'خانه'],
    ]);
    await addSpreadsheetNamespacePrefix(input);

    const result = await importWorkbook(input, outputPaths(directory), 2);

    expect(result.valid).toBe(true);
    expect(result.words.map((word) => word.french)).toEqual(['être', 'maison']);
  });

  test('keeps apostrophe-separated words distinct from plain words', async () => {
    const { directory, input } = await makeWorkbook([
      ["l'une", 'one (feminine)', 'یکی'],
      ['lune', 'moon', 'ماه'],
    ]);

    const result = await importWorkbook(input, outputPaths(directory), 2);

    expect(result.valid).toBe(true);
    expect(result.audit.uniqueFrenchCount).toBe(2);
  });
});
