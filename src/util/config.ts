// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { File } from './file'

export type Config = Record<string, string>

export const config: Config = {}

export async function initConfig(defaultConfig: Config, optionsConfig: Config) {
  const filename =
    optionsConfig.CONFIG_FILE ||
    process.env.SFF_CONFIG_FILE ||
    defaultConfig.CONFIG_FILE
  const file = new File(filename, 'config')
  const fileConfig = (await file.loadJSON({ undefinedIfNotExist: true })) || {}

  for (const field in defaultConfig) {
    config[field] =
      optionsConfig[field] ||
      process.env[`SFF_${field}`] ||
      fileConfig[field] ||
      defaultConfig[field]
  }
}
