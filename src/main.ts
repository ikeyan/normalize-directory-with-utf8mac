import meow from 'meow';
import type { Dirent } from 'fs';
import { readdir, rename, stat } from 'fs/promises';
import { resolve } from 'path';
import { normalize } from './hfsDecomposition.js';

const name = process.argv[1];

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
  let dir: Dirent[];
  try {
    dir = await readdir(path, {
      encoding: 'utf-8',
      withFileTypes: true,
    });
  } catch (e) {
    console.log(`Error in readdir ${path}`, e);
    dir = [];
  }
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
    [...normalizeMap].map(async ([normalizedName, dirents]): Promise<void> => {
      if (dirents.length > 1) {
        console.log(`${path} contains ${dirents.map((dirent) => dirent.name)}`);
        // TODO merge directories
        if (dirents.some((x) => !x.isFile())) {
          return;
        }
        const statsArr = await Promise.all(dirents.map((dirent) => stat(resolve(path, dirent.name))));
        const nonEmptyFileCount = statsArr.reduce((count, stats) => count + (stats.size > 0 ? 1 : 0), 0);
        if (nonEmptyFileCount > 1) {
          console.log('conflict');
          return;
        }
        if (nonEmptyFileCount === 0) {
        }
      }
      const rawName = dirents[0].name;
      if (rawName === normalizedName) {
        return;
      }
      try {
        await rename(resolve(path, rawName), resolve(path, normalizedName));
      } catch (e) {
        console.log(`Error in rename(${resolve(path, rawName)}, ${resolve(path, normalizedName)}):`, e);
      }
    }),
  );
  for (const [normalizedName, [dirent]] of normalizeMap) {
    if (dirent.isDirectory()) {
      await normalizeRecursively(resolve(path, normalizedName));
    }
  }
}

await normalizeRecursively(root);
