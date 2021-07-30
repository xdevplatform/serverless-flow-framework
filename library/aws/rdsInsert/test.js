// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

process.env.DATABASE_NAME = 'adb'
process.env.DATABASE_CLUSTER_ARN = 'arn:aws:rds:us-east-1:858543268828:cluster:rds-cluster-adb'
process.env.DATABASE_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:858543268828:secret:secret-rds-adb-91af1533503f9d8a-ovJyOR'
process.env.DATABASE_TABLE_NAME = 'tweets'
process.env.DATABSE_TABLE_COLUMNS =	JSON.stringify([
  { name: 'id', type: 'VARCHAR', n1: 16, constraint: 'PRIMARY KEY', required: true, family: 'textual' },
  { name: 'text', type: 'VARCHAR', n1: 32, required: false, family: 'textual' },
  { name: 'created_at', type: 'VARCHAR', n1: 64, required: false, family: 'textual' }
])

const { handler } = require('./index')

const CGRAY = '\x1b[38;5;240m'
const CLEAR = '\x1b[0m'

const event = [
  {
    id: '17441',
    text: 'I am text 17441',
    created_at: 'Fri Jul 30 2021 04:16:44 GMT+0000 (Coordinated Universal Time)'
  },
  {
    text: 'I am text xxxxx',
    created_at: 'Fri Jul 30 2021 04:16:44 GMT+0000 (Coordinated Universal Time)'
  },
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
