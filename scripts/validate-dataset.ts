import { getNumberOption, getOption, hasFlag } from './lib/cli';
import {
  type DatasetCourse,
  validateWordDataset,
} from './lib/dataset-validation';
import { readJson } from './lib/io';
import { fromRoot } from './lib/paths';

const course = (getOption('course', 'french') as DatasetCourse) ?? 'french';
const defaultDataset =
  course === 'spanish' ? 'src/data/spanish/words.json' : 'src/data/words.json';
const datasetPath = getOption('dataset', fromRoot(defaultDataset))!;
const expectedCount = getNumberOption('expected-count', 1000);
const skipAudioFiles = hasFlag('skip-audio-files');
const dataset = await readJson<unknown>(datasetPath);
const result = validateWordDataset(dataset, {
  expectedCount,
  course,
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
  console.log(
    `Validated ${expectedCount} ranked ${course} vocabulary entries.`,
  );
}
