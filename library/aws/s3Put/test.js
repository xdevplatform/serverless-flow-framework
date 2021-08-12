// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

process.env.S3_BUCKET_NAME = `seff-test-${process.env.USER || 'anonymous'}`
process.env.DYNAMODB_PARTITION_KEY = 'ID'

const { handler } = require('./index')

const CGRAY = '\x1b[38;5;240m'
const CLEAR = '\x1b[0m'

const event = [
  { name: 'hello.txt', body: 'Hello, world!' },
  { name: 'goodbye.txt', body: 'That\'s all, folks!', metadata: { 'good': 'bye' } },
]

async function main() {
  console.log(`${CGRAY}Starting test${CLEAR}`)
  console.log(event)

  console.log(`${CGRAY}----- Invoking handler -----${CLEAR}`)
  const res = await handler(event)
  console.log(`${CGRAY}----- Handler response -----${CLEAR}`)
  console.log(res)
}

main().catch(console.error)
