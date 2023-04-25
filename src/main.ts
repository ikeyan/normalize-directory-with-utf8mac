import meow from 'meow';
import { name } from '../package.json' assert { type: 'json' };
import type { Dirent } from 'fs';
import { readdir, rename } from 'fs/promises';
import { resolve } from 'path';
import { normalize } from './hfsDecomposition.js';

const cli = meow(
  `
Usage
  $ ${name} --root [root directory to normalize]
`,
  {
    importMeta: import.meta,
    flags: {
      root: {
        type: 'string',
        isRequired: true,
      },
    },
  },
);
const { root } = cli.flags;

async function normalizeRecursively(path: string) {
  const dir = await readdir(path, {
    encoding: 'utf-8',
    withFileTypes: true,
  });
  const normalizeMap: Map<string, Dirent[]> = new Map();
  for (const dirent of dir) {
    const normalizedName = normalize(dirent.name);
    let dirents = normalizeMap.get(normalizedName);
    if (dirents === undefined) {
      dirents = [];
      normalizeMap.set(normalizedName, dirents);
    }
    dirents.push(dirent);
  }
  await Promise.all(
    [...normalizeMap].flatMap(([normalizedName, dirents]): Promise<void>[] => {
      if (dirents.length > 1) {
        console.log(`${path} contains ${dirents}`);
        // TODO merge directories
        if (dirents.some((x) => x.name === normalizedName)) {
          return [];
        }
      }
      const rawName = dirents[0].name;
      if (rawName === normalizedName) {
        return [];
      }
      return [rename(resolve(path, rawName), resolve(path, normalizedName))];
    }),
  );
  for (const [normalizedName, [dirent]] of normalizeMap) {
    if (dirent.isDirectory()) {
      await normalizeRecursively(resolve(path, normalizedName));
    }
  }
}

await normalizeRecursively(root);
