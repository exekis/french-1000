import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const projectRoot = resolve(
  fileURLToPath(new URL('../../', import.meta.url)),
);

export function fromRoot(...parts: string[]): string {
  return resolve(projectRoot, ...parts);
}
