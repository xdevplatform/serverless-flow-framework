// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Func } from './Func'
import { config } from './util/config'

const FUNCTIONS = [
  'aws.dynamodbWrite',
  'aws.rdsInsert',
  'aws.s3Put',
  'ibm.watsonNluAnalyze',
  'std.countInvocations',
  'std.generateRandomNumber',
  'std.printEvent',
  'twitter.pollTweetsWithQuery',
]

export const library: Record<string, Record<string, Func>> = {}

export function initLibrary() {
  const baseurl = config.FUNCTION_LIBRARY_BASEURL +
    (config.FUNCTION_LIBRARY_BASEURL.endsWith('/') ? '' : '/')
  for (const func of FUNCTIONS) {
    const names = func.split('.')
    if (names.length !== 2) {
      throw new Error(`Invalid library function name: ${func}`)
    }
    const [group, name] = names
    if (!library[group]) {
      library[group] = {}
    }
    library[group][name] = new Func('url', name, `${baseurl}${name}.zip`)
  }
}
