// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import os from 'os'
import util from 'util'
import ospath from 'path'
import rimraf from 'rimraf'
import { zipFolder } from './zip'
import { promises as fs } from 'fs'
import childProcess from 'child_process'
import { walk, SkipFilter } from './walk'

const exec = util.promisify(childProcess.exec)

export interface Executed {
  error?: Error
  stdout: string | Buffer
  stderr: string | Buffer
}

export class Folder {
  private base: string
  private didInitializeDirectory = false

  constructor(name: string, private recursive = false) {
    this.base = ospath.join(os.tmpdir(), name)
  }

  public async copy(
    sourcePath: string,
    targetName: string,
    skip?: SkipFilter,
    verbose = false,
  ): Promise<void> {
    await this.init()

    const srcPath = ospath.resolve(sourcePath)
    const dstPath = ospath.join(this.base, targetName)

    const st = await fs.stat(srcPath)
    if (st.isDirectory()) {

      const action = async (
        fullpath: string,
        filepath: string,
        isDirectory: boolean,
      ) => {
        const dst = ospath.join(dstPath, filepath)
        if (isDirectory) {
          if (verbose) {
            console.info('Creating folder:', filepath)
          }
          await fs.mkdir(dst)
        } else {
          if (verbose) {
            console.info('Copying file:', filepath)
          }
          await fs.copyFile(fullpath, dst)
        }
      }

      await walk(srcPath, action, skip)

    } else {

      await fs.copyFile(srcPath, dstPath)

    }
  }

  public async destroy(): Promise<void> {
    await rimraf.sync(this.base)
    this.didInitializeDirectory = false
  }

  public async exec(cmd: string): Promise<Executed> {
    await this.init()
    return exec(`cd ${this.base} && ${cmd}`)
  }

  public async contains(filename: string): Promise<boolean> {
    await this.init()
    try {
      await fs.stat(this.path(filename))
      return true
    } catch (e) {
      if (e.code === 'ENOENT') {
        return false
      }
      throw e
    }
  }

  public async init(): Promise<void> {
    if (!this.didInitializeDirectory) {
      const options = this.recursive ? { recursive: true } : undefined
      await fs.mkdir(this.base, options)
      this.didInitializeDirectory = true
    }
  }

  public path(name: string): string {
    return ospath.join(this.base, name)
  }

  public async write(targetName: string, data: string): Promise<void> {
    await this.init()
    await fs.writeFile(`${this.base}/${targetName}`, data, 'utf-8')
  }

  public async zip(options: any = {}): Promise<Buffer> {
    return zipFolder(this.base, options)
  }
}
