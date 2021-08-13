// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1')
const { IamAuthenticator } = require('ibm-watson/auth')

const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
  version: '2021-08-01',
  authenticator: new IamAuthenticator({
    apikey: process.env.WATSON_API_KEY,
  }),
  serviceUrl: process.env.WATSON_SERVICE_URL,
})

module.exports.main = async function main(event) {
  const features = (() => {
    if (!process.env.FEATURES) {
      throw new Error('Missing FEATURES environment variables')
    }
    try {
      return JSON.parse(process.env.FEATURES)
    } catch (e) {
      console.error('Error parsing FEATURES environment variable')
      throw e
    }
  })()

  if (typeof event !== 'object' || event === null) {
    throw new Error(`Invalid event object: ${event}`)
  }
  if (typeof event.text !== 'string' || event.text.trim().length === 0) {
    throw new Error(`Missing text: ${event.text}`)
  }

  console.log('Watson NLU analyze request:')
  console.log(`  text: '${event.text}'`)
  console.log('  features:', features)
  const res = await naturalLanguageUnderstanding.analyze({ text: event.text, features })
  if (res.status !== 200) {
    console.error(JSON.stringify(res, null, 2))
    throw new Error(`Watson API error: ${res.statusText}`)
  }
  console.log('Watson response:')
  console.log(res.result)

  return { ...event, watson: res.result }
}
