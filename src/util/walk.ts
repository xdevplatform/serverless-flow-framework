// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import ospath from 'path'
import { promises as fs } from 'fs'

export type ActionHandler =
  (fullpath: string, filepath: string, isDirectory: boolean) => Promise<void>

export type SkipFilter =
  (fullpath: string, filepath: string) => boolean

export async function walk(
  path: string,
  action: ActionHandler,
  skip?: SkipFilter,
): Promise<void> {

  function fullpath(subpath: string): string {
    return ospath.join(path, subpath)
  }

  const walkFilesInDirectory = async (dir = '') => {

    const files = await fs.readdir(fullpath(dir))
    for (const file of files) {

      const filepath = ospath.join(dir, file)
      if (skip && skip(fullpath(filepath), filepath)) {
        continue
      }

      const st = await fs.stat(fullpath(filepath))
      if (st.isDirectory()) {
        await action(fullpath(filepath), filepath, true)
        await walkFilesInDirectory(filepath)
      } else {
        await action(fullpath(filepath), filepath, false)
      }

    }
  }

  await walkFilesInDirectory()
}
