import meow from 'meow';
import type { Dirent } from 'fs';
import { readdir, readFile, rename, stat } from 'fs/promises';
import { resolve } from 'path';
import { normalize } from './hfsDecomposition.js';
import { createHash } from 'crypto';
import pLimit from 'p-limit';

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

const limitStat = pLimit(10);
const limitReadFile = pLimit(1);

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
    const normalizedName = dirent.name.normalize('NFC');
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
        const statsArr = await Promise.all(dirents.map((dirent) => limitStat(() => stat(resolve(path, dirent.name)))));
        const nonEmptyFiles = statsArr.flatMap((stats, i) => (stats.size > 0 ? dirents[i].name : []));
        if (nonEmptyFiles.length > 1) {
          // ファイルのsha1ハッシュを計算、一致すればコンフリクトではない
          console.log(`Calculating sha1 of ${path}/{${nonEmptyFiles.join(',')}}`);
          const nonEmptyFileHashes = await Promise.all(
            nonEmptyFiles.map(async (name) => {
              const buffer = await limitReadFile(() => readFile(resolve(path, name)));
              const sha1 = createHash('sha1').update(buffer).digest('hex');
              return { name, sha1 };
            }),
          );
          const aSha1 = nonEmptyFileHashes[0].sha1;
          if (nonEmptyFileHashes.some((x) => x.sha1 !== aSha1)) {
            console.log(`Conflict in ${path}: ${nonEmptyFileHashes.map((x) => x.name)}`);
            return;
          }
        }
        if (nonEmptyFiles.length === 0) {
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
