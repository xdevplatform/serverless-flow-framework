// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Func } from './Func'
import { joinURL } from './util/url'
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
  for (const func of FUNCTIONS) {
    const names = func.split('.')
    if (names.length !== 2) {
      throw new Error(`Invalid library function name: ${func}`)
    }
    const [group, name] = names
    if (!library[group]) {
      library[group] = {}
    }
    const url = joinURL(config.FUNCTION_LIBRARY_BASEURL, name, 'zip')
    library[group][name] = new Func('url', name, url)
  }
}
