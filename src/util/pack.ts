// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import crypto from 'crypto'
import { File } from './file'
import { config } from './config'
import { Folder } from './folder'
import { zipFolder } from './zip'

type Language = 'cross-cloud-javascript' | 'javascript' | 'raw'
export type PackLanguage = 'autodetect' | Language

async function createJavascriptBuffer(
  path: string,
  lang: Language,
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

    if (lang === 'cross-cloud-javascript') {
      if (!await folder.contains('main.js')) {
        throw new Error('File not found: main.js')
      }
      if (await folder.contains('index.js')) {
        throw new Error('File already exists: index.js')
      }
      console.log('Creating index.js file for', config.CLOUD_PROVIDER)

      const script = `(async () => {
        const { ${javascriptEncodeClassName} } =
          require('${__dirname}/../${config.CLOUD_PROVIDER}/${javascriptEncodeClassName}')
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

async function createGenericBuffer(path: string): Promise<Buffer> {
  return zipFolder(path, undefined, undefined, true)
}

export async function packFolder(
  path: string,
  lang: PackLanguage,
  javascriptEncodeClassName: string,
): Promise<Buffer> {
  if (lang === 'autodetect') {
    if (await File.lookup(`${path}/index.js`) === 'file') {
      lang = 'javascript'
    }
    else if (await File.lookup(`${path}/main.js`) === 'file') {
      lang = 'cross-cloud-javascript'
    }
    else {
      lang = 'raw'
    }
  }

  return lang === 'raw'
    ? createGenericBuffer(path)
    : createJavascriptBuffer(path, lang, javascriptEncodeClassName)
}
