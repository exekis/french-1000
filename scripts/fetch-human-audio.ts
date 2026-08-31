import { nowIso, writeJson } from './lib/io';
import { fromRoot } from './lib/paths';

const audit = {
  checkedAt: nowIso(),
  provider: 'forvo',
  status: 'blocked',
  officialTerms: 'https://api.forvo.com/documentation/general-information/',
  reason:
    'The current Forvo API terms say generated audio links expire after two hours and pronunciation audio may not be cached. That does not permit local static redistribution for this site.',
  nextStep:
    'Use a human-audio provider or direct licence that explicitly permits download, caching, and public static playback, then implement it behind the existing audio manifest contract.',
};

await writeJson(
  fromRoot('data/curated/human-audio-provider-audit.json'),
  audit,
);
console.error(audit.reason);
process.exitCode = 1;
