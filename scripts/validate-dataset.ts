import { getNumberOption, getOption, hasFlag } from './lib/cli';
import { validateWordDataset } from './lib/dataset-validation';
import { readJson } from './lib/io';
import { fromRoot } from './lib/paths';

const datasetPath = getOption('dataset', fromRoot('src/data/words.json'))!;
const expectedCount = getNumberOption('expected-count', 1000);
const skipAudioFiles = hasFlag('skip-audio-files');
const dataset = await readJson<unknown>(datasetPath);
const result = validateWordDataset(dataset, {
  expectedCount,
  audioRoot: fromRoot('public/audio'),
  checkAudioFiles: !skipAudioFiles,
});

if (!result.valid) {
  console.error(
    `Dataset validation blocked with ${result.errors.length} errors.`,
  );
  result.errors.slice(0, 50).forEach((error) => console.error(`- ${error}`));
  if (result.errors.length > 50) {
    console.error(`- and ${result.errors.length - 50} more`);
  }
  process.exitCode = 1;
} else {
  console.log(`Validated ${expectedCount} ranked vocabulary entries.`);
}
