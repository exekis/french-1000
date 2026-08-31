import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import ExcelJS, { type CellValue, type Worksheet } from 'exceljs';
import JSZip from 'jszip';
import { sha256, nowIso, writeJson, writeText } from './io';
import type { ImportedWord, ImportNormalization } from './pipeline-types';
import {
  classifyRisk,
  normalizeCell,
  normalizeFrenchIdentity,
  zeroPadRank,
} from './text';

type Field = 'french' | 'english' | 'persian';

type ImportPaths = {
  audit: string;
  provenance: string;
  importedWords: string;
  localRows: string;
  localNormalizations: string;
};

export type WorkbookImportResult = {
  valid: boolean;
  errors: string[];
  words: ImportedWord[];
  audit: Record<string, unknown>;
};

const headerAliases: Record<Field, Set<string>> = {
  french: new Set([
    'french',
    'francais',
    'français',
    'mot francais',
    'mot français',
    'french word',
  ]),
  english: new Set([
    'english',
    'english meaning',
    'meaning english',
    'anglais',
    'معنی انگلیسی',
  ]),
  persian: new Set([
    'persian',
    'persian meaning',
    'farsi',
    'farsi meaning',
    'فارسی',
    'معنی فارسی',
  ]),
};

const rankAliases = new Set(['rank', 'ranking', 'number', 'no', '#', 'ردیف']);

const spreadsheetNamespace =
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

async function makeExcelJsCompatible(workbookBytes: Buffer): Promise<Buffer> {
  const archive = await JSZip.loadAsync(workbookBytes);
  let changed = false;

  await Promise.all(
    Object.values(archive.files).map(async (entry) => {
      if (
        entry.dir ||
        (!entry.name.endsWith('.xml') && !entry.name.endsWith('.rels'))
      ) {
        return;
      }

      const xml = await entry.async('string');
      const normalized = xml
        .replaceAll('<x:', '<')
        .replaceAll('</x:', '</')
        .replace(
          `xmlns:x="${spreadsheetNamespace}"`,
          `xmlns="${spreadsheetNamespace}"`,
        )
        .replaceAll('Target="/xl/tables/', 'Target="../tables/');
      if (normalized === xml) return;

      archive.file(entry.name, normalized);
      changed = true;
    }),
  );

  return changed
    ? archive.generateAsync({ type: 'nodebuffer' })
    : workbookBytes;
}

function cellText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number')
    return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if ('text' in value) return value.text;
  if ('result' in value) return cellText(value.result ?? '');
  if ('richText' in value)
    return value.richText.map((part) => part.text).join('');
  return String(value);
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('fr')
    .replace(/[’‘`´']/g, '')
    .replace(/[^\p{L}\p{N}#]+/gu, ' ')
    .trim();
}

function findHeader(sheet: Worksheet): {
  rowNumber: number;
  columns: Record<Field, number>;
  rankColumn?: number;
} | null {
  const maxRow = Math.min(sheet.actualRowCount, 12);
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const matches: Record<Field, number[]> = {
      french: [],
      english: [],
      persian: [],
    };
    const rankColumns: number[] = [];

    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const header = normalizeHeader(cellText(cell.value));
      (Object.keys(headerAliases) as Field[]).forEach((field) => {
        if (headerAliases[field].has(header)) matches[field].push(columnNumber);
      });
      if (rankAliases.has(header)) rankColumns.push(columnNumber);
    });

    if (
      (Object.keys(matches) as Field[]).every(
        (field) => matches[field].length === 1,
      )
    ) {
      return {
        rowNumber,
        columns: {
          french: matches.french[0]!,
          english: matches.english[0]!,
          persian: matches.persian[0]!,
        },
        rankColumn: rankColumns.length === 1 ? rankColumns[0] : undefined,
      };
    }
  }
  return null;
}

function sheetRows(sheet: Worksheet): string[][] {
  const rows: string[][] = [];
  for (let rowNumber = 1; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
    const row: string[] = [];
    const source = sheet.getRow(rowNumber);
    for (
      let columnNumber = 1;
      columnNumber <= sheet.actualColumnCount;
      columnNumber += 1
    ) {
      row.push(cellText(source.getCell(columnNumber).value));
    }
    rows.push(row);
  }
  return rows;
}

export async function importWorkbook(
  inputPath: string,
  paths: ImportPaths,
  expectedCount = 1000,
): Promise<WorkbookImportResult> {
  const workbookBytes = await readFile(inputPath);
  const workbook = new ExcelJS.Workbook();
  const compatibleBytes = await makeExcelJsCompatible(workbookBytes);
  await workbook.xlsx.load(compatibleBytes as unknown as ExcelJS.Buffer);

  const sheet =
    workbook.getWorksheet('Top 1000') ??
    workbook.worksheets.find((candidate) => findHeader(candidate) !== null);
  const provenanceSheet = workbook.worksheets.find((candidate) =>
    /sources?\s*(?:&|and)\s*method/i.test(candidate.name),
  );
  const errors: string[] = [];
  const words: ImportedWord[] = [];
  const rawRows: Record<string, unknown>[] = [];
  const normalizations: ImportNormalization[] = [];
  let blankCellCount = 0;
  let header: ReturnType<typeof findHeader> = null;

  if (!sheet) {
    errors.push(
      'no worksheet has unambiguous French, English, and Persian headers',
    );
  } else {
    header = findHeader(sheet);
    if (!header) {
      errors.push(
        `worksheet ${sheet.name} does not have unambiguous French, English, and Persian headers`,
      );
    }
  }

  if (sheet && header) {
    for (
      let sourceRow = header.rowNumber + 1;
      sourceRow <= sheet.actualRowCount;
      sourceRow += 1
    ) {
      const row = sheet.getRow(sourceRow);
      const raw = {
        french: cellText(row.getCell(header.columns.french).value),
        english: cellText(row.getCell(header.columns.english).value),
        persian: cellText(row.getCell(header.columns.persian).value),
      };
      if (Object.values(raw).every((value) => value.trim() === '')) continue;

      const rank = words.length + 1;
      const normalized = {
        french: normalizeCell(raw.french),
        english: normalizeCell(raw.english),
        persian: normalizeCell(raw.persian),
      };
      (Object.keys(normalized) as Field[]).forEach((field) => {
        if (!normalized[field].value) blankCellCount += 1;
        if (normalized[field].changes.length > 0) {
          normalizations.push({
            rank,
            sourceRow,
            field,
            before: raw[field],
            after: normalized[field].value,
            changes: normalized[field].changes,
          });
        }
      });

      if (header.rankColumn !== undefined) {
        const suppliedRank = Number(
          cellText(row.getCell(header.rankColumn).value),
        );
        if (suppliedRank !== rank) {
          errors.push(
            `source row ${sourceRow} has rank ${String(suppliedRank)}, expected ${rank}`,
          );
        }
      }

      rawRows.push({ rank, sourceRow, ...raw });
      words.push({
        id: zeroPadRank(rank),
        rank,
        sourceRow,
        french: normalized.french.value,
        english: normalized.english.value,
        persian: normalized.persian.value,
        riskFlags: classifyRisk(normalized.french.value),
      });
    }
  }

  if (words.length !== expectedCount) {
    errors.push(
      `expected ${expectedCount} vocabulary rows, found ${words.length}`,
    );
  }
  if (blankCellCount > 0) {
    errors.push(`found ${blankCellCount} blank required cells`);
  }

  const normalizedFrench = words.map((word) =>
    normalizeFrenchIdentity(word.french),
  );
  const uniqueFrenchCount = new Set(normalizedFrench).size;
  if (uniqueFrenchCount !== words.length) {
    errors.push(
      `found ${words.length - uniqueFrenchCount} duplicate normalized French entries`,
    );
  }

  const provenanceRows = provenanceSheet ? sheetRows(provenanceSheet) : [];
  const audit = {
    status: errors.length === 0 ? 'passed' : 'blocked',
    generatedAt: nowIso(),
    input: {
      filename: basename(inputPath),
      sha256: sha256(workbookBytes),
    },
    sheetNames: workbook.worksheets.map((candidate) => candidate.name),
    vocabularySheet: sheet?.name ?? null,
    headerRow: header?.rowNumber ?? null,
    headers: header?.columns ?? null,
    rankSource: header?.rankColumn ? 'explicit-column' : 'source-order',
    rowCount: words.length,
    uniqueFrenchCount,
    blankRequiredCellCount: blankCellCount,
    normalizationChangeCount: normalizations.length,
    sourcesAndMethod: provenanceRows,
    errors,
  };

  await writeJson(paths.audit, audit);
  await writeJson(paths.localRows, rawRows);
  await writeJson(paths.localNormalizations, normalizations);

  const provenanceText = [
    '# Workbook provenance',
    '',
    `Imported: ${audit.generatedAt}`,
    '',
    `Workbook SHA-256: \`${audit.input.sha256}\``,
    '',
    `Vocabulary sheet: ${audit.vocabularySheet ?? 'not resolved'}`,
    '',
    `Rows found: ${audit.rowCount}`,
    '',
    `Unique normalized French entries: ${audit.uniqueFrenchCount}`,
    '',
    `Import status: ${audit.status}`,
    '',
    '## Sources & Method sheet',
    '',
    provenanceRows.length > 0
      ? provenanceRows.map((row) => row.join(' | ')).join('\n')
      : 'No matching sheet was present in the workbook.',
    '',
    '## Import errors',
    '',
    errors.length > 0
      ? errors.map((error) => `- ${error}`).join('\n')
      : 'None.',
    '',
  ].join('\n');
  await writeText(paths.provenance, provenanceText);

  if (errors.length === 0) {
    await writeJson(paths.importedWords, words);
  }

  return { valid: errors.length === 0, errors, words, audit };
}
