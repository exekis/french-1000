import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  writeFile,
  appendFile,
} from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

export async function readOptionalJson<T>(
  path: string,
  fallback: T,
): Promise<T> {
  try {
    return await readJson<T>(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, path);
}

export async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, value, 'utf8');
  await rename(temporaryPath, path);
}

export async function readJsonLines<T>(path: string): Promise<T[]> {
  try {
    const content = await readFile(path, 'utf8');
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function appendJsonLine(
  path: string,
  value: unknown,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(value)}\n`, 'utf8');
}

export async function writeJsonLines(
  path: string,
  values: readonly unknown[],
): Promise<void> {
  await writeText(
    path,
    values.length > 0
      ? `${values.map((value) => JSON.stringify(value)).join('\n')}\n`
      : '',
  );
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function nowIso(): string {
  return new Date().toISOString();
}
