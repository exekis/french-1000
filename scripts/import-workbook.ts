import 'dotenv/config';
import { access } from 'node:fs/promises';
import { getNumberOption, getOption } from './lib/cli';
import { fromRoot } from './lib/paths';
import { importWorkbook } from './lib/workbook';

const input = getOption(
  'input',
  fromRoot('data/raw/french_top_1000_english_persian.xlsx'),
)!;
const expectedCount = getNumberOption('expected-count', 1000);

try {
  await access(input);
} catch {
  console.error(`Workbook not found: ${input}`);
  console.error(
    'Place the exact supplied workbook at data/raw/french_top_1000_english_persian.xlsx or pass --input.',
  );
  process.exitCode = 1;
  process.exit();
}

const result = await importWorkbook(
  input,
  {
    audit: fromRoot('data/curated/import-audit.json'),
    provenance: fromRoot('data/curated/PROVENANCE.md'),
    importedWords: fromRoot('data/curated/imported-words.json'),
    localRows: fromRoot('data/local/import-rows.json'),
    localNormalizations: fromRoot('data/local/import-normalizations.json'),
  },
  expectedCount,
);

if (!result.valid) {
  console.error('Workbook import blocked:');
  result.errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Imported and audited ${result.words.length} words.`);
}
