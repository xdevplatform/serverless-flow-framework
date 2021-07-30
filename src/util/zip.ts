// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import JSZip from 'jszip'
import { promises as fs } from 'fs'
import { walk, SkipFilter } from './walk'

export function zipOne(filename: string, data: string): Promise<Buffer> {
  const zip = new JSZip()
  zip.file(filename, data)
  return zip.generateAsync({ type: 'nodebuffer' })
}

export async function zipFolder(
  path: string,
  options: Record<string, any> = {},
  skip?: SkipFilter,
  verbose = false,
): Promise<Buffer> {

  const zip = new JSZip()

  const action = async (
    fullpath: string,
    filepath: string,
    isDirectory: boolean,
  ) => {
    if (!isDirectory) {
      if (verbose) {
        console.info('Packing file:', fullpath)
      }
      zip.file(filepath, fs.readFile(fullpath))
    }
  }

  await walk(path, action, skip)

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    ...options,
  }) as Promise<Buffer>
}
