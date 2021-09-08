// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import ospath from 'path'
import crypto from 'crypto'
import { config } from './util/config'
import { Folder } from './util/folder'
import { zipFolder } from './util/zip'
import { Metadata, Options } from './types'

function floor(n: number, decimals: number = 0) {
  const scale = Math.pow(10, decimals)
  return Math.floor(n * scale) / scale
}

function humanizedDataSize(size: number, short = true) {
  if (typeof size !== 'number' || size < 0) {
    throw new Error(`Invalid size: ${size}`)
  }
  const sz = Math.floor(size)
  if (sz === 0) {
    return short ? '0' : 'zero'
  }
  if (sz < 1024) {
    return short ? `${sz}B` : `${sz} byte${sz === 1 ? '' : 's'}`
  }
  if (sz < 1024 * 1024) {
    return `${floor(sz / 1024, 1)}${short ? '' : ' '}KB`
  }
  if (sz < 1024 * 1024 * 1024) {
    return `${floor(sz / 1024 / 1024, 1)}${short ? '' : ' '}MB`
  }
  return `${floor(sz / 1024 / 1024 / 1024, 1)}${short ? '' : ' '}GB`
}

async function createJavascriptBuffer(
  path: string,
  options: Options,
  javascriptEncodeClassName: string,
): Promise<Buffer> {

  const random = crypto.randomBytes(8).toString('hex')
  const folder = new Folder(`seff-${random}`)

  try {
    console.log('Copying JavaScript files')
    const skip = config.JAVASCRIPT_SKIP_FILES.split(',')
    await folder.copy(
      path,
      '',
      (_fullpath: string, filepath: string) => skip.includes(filepath),
      true,
    )

    if (await folder.contains('package.json')) {

      console.log('Running npm install')
      await folder.exec('npm install')

      const script = `
        const package = require(\'./package.json\');
        process.stdout.write(package.scripts && package.scripts.build ? package.scripts.build : '')
      `
      const build = (await folder.exec(`node -e "${script}"`)).stdout
      if (build) {
        console.log('Running npm build')
        await folder.exec('npm run build')
      }
    }

    if (options.hasOwnProperty('cross')) {
      if (!await folder.contains('main.js')) {
        throw new Error('File not found: main.js')
      }
      if (await folder.contains('index.js')) {
        throw new Error('File already exists: index.js')
      }
      console.log('Creating index.js file for', config.CLOUD_PROVIDER)

      const script = `(async () => {
        const { ${javascriptEncodeClassName} } =
          require('${__dirname}/${config.CLOUD_PROVIDER}/${javascriptEncodeClassName}')
        const main = require('./main')
        code = await ${javascriptEncodeClassName}.encodeJavascriptFunction(
          main.main.toString(),
          'main.main',
        )
        console.log(code)
      })().catch(console.error)`

      const res = await folder.exec(`node -e "${script}"`)
      if (res.stderr) {
        console.error(res.stderr)
        throw new Error('Error generating code')
      }
      const code = 'const main = require(\'./main\');\n' + res.stdout

      await folder.write('index.js', code)
    }

    console.log('Compressing files')
    const buffer = await folder.zip()

    return buffer

  } finally {
    await folder.destroy()
  }
}

async function createGenericBuffer(path: string, options: Options): Promise<Buffer> {
  return zipFolder(path, undefined, undefined, true)
}

export async function upload(
  path: string,
  options: Options,
  javascriptEncodeClassName: string,
): Promise<{ url: string, buffer: Buffer, metadata: Metadata }> {

  console.log('Packing code in:', path)
  const buffer = options.hasOwnProperty('javascript')
    ? await createJavascriptBuffer(path, options, javascriptEncodeClassName)
    : await createGenericBuffer(path, options)

  console.log(`Uploading ${humanizedDataSize(buffer.length, false)}`)

  const baseurl = config.FUNCTION_LIBRARY_BASEURL +
    (config.FUNCTION_LIBRARY_BASEURL.endsWith('/') ? '' : '/')
  const url = options.url || `${baseurl}${ospath.basename(path)}.zip`

  const metadata = {
    handler: options.handler || config.SERVERLESS_FUNCTION_HANDLER,
    memory: options.memory || config.SERVERLESS_FUNCTION_MEMORY,
    runtime: options.runtime || config.SERVERLESS_FUNCTION_RUNTIME,
  }

  return { url, buffer, metadata }
}
