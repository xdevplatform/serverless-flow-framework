// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { promises as fs } from 'fs'

export interface LoadOptions {
  encoding?: BufferEncoding | null
  undefinedIfNotExist?: boolean
}

export interface StoreOptions {
  encoding?: BufferEncoding | null
}

export class File {
  constructor(private readonly filename: string, private description: string) {
  }

  public async load(options: LoadOptions = {}): Promise<Buffer | string | undefined> {
    console.info(`Loading ${this.description} file: ${this.filename}`)
    try {
      const encoding = options.encoding || null
      const data = await fs.readFile(this.filename, { encoding })
      return data // for try...catch
    } catch (e) {
      if (options.undefinedIfNotExist && e.code === 'ENOENT') {
        return
      }
      console.error(`Error loading ${this.description} file: ${e.message}`)
      throw e
    }
  }

  public async loadJSON(options: LoadOptions = {}) {
    const str = await this.load({ encoding: 'utf8', ...options }) as string | undefined
    return str && JSON.parse(str)
  }

  public async remove(): Promise<void> {
    console.info(`Removing ${this.description} file: ${this.filename}`)
    try {
      await fs.unlink(this.filename)
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.info('File not found:', this.filename)
      } else {
        console.error(`Error remocing ${this.description} file: ${e.message}`)
        throw e
      }
    }
  }

  public async store(data: Buffer | string, options: StoreOptions = {}): Promise<void> {
    console.info(`Storing ${this.description} file: ${this.filename}`)
    try {
      const encoding = options.encoding || null
      await fs.writeFile(this.filename, data, { encoding })
    } catch (e) {
      console.error(`Error storing ${this.description} file: ${e.message}`)
      throw e
    }
  }

  public async storeJSON(object: Object, options: StoreOptions = {}): Promise<void> {
    return this.store(JSON.stringify(object), { encoding: 'utf8', ...options })
  }
}
