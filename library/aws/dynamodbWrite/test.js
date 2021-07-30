// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

process.env.DYNAMODB_TABLE_NAME = 'test'
process.env.DYNAMODB_PARTITION_KEY = 'ID'

const { handler } = require('./index')

const CGRAY = '\x1b[38;5;240m'
const CLEAR = '\x1b[0m'

const event = [
  { id: '314159', text: 'I love pie' },
  { ID: '100000', text: 'Item 100000' },
  { ID: '100001', text: 'Item 100001' },
  { ID: '100002', text: 'Item 100002' },
  { ID: '100003', text: 'Item 100003' },
  { ID: '100004', text: 'Item 100004' },
  { ID: '100005', text: 'Item 100005' },
  { ID: '100006', text: 'Item 100006' },
  { ID: '100007', text: 'Item 100007' },
  { ID: '100008', text: 'Item 100008' },
  { ID: '100009', text: 'Item 100009' },
  { ID: '100010', text: 'Item 100010' },
  { ID: '100011', text: 'Item 100011' },
  { ID: '100012', text: 'Item 100012' },
  { ID: '100013', text: 'Item 100013' },
  { ID: '100014', text: 'Item 100014' },
  { ID: '100015', text: 'Item 100015' },
  { ID: '100016', text: 'Item 100016' },
  { ID: '100017', text: 'Item 100017' },
  { ID: '100018', text: 'Item 100018' },
  { ID: '100019', text: 'Item 100019' },
  { ID: '100020', text: 'Item 100020' },
  { ID: '100021', text: 'Item 100021' },
  { ID: '100022', text: 'Item 100022' },
  { ID: '100023', text: 'Item 100023' },
  { ID: '100024', text: 'Item 100024' },
  { ID: '100025', text: 'Item 100025' },
  { ID: '100026', text: 'Item 100026' },
  { ID: '100027', text: 'Item 100027' },
  { ID: '100028', text: 'Item 100028' },
  { ID: '100029', text: 'Item 100029' },
  { ID: '100030', text: 'Item 100030' },
  { ID: '100031', text: 'Item 100031' },
  { ID: '100032', text: 'Item 100032' },
  { ID: '100033', text: 'Item 100033' },
  { ID: '100034', text: 'Item 100034' },
  { ID: '100035', text: 'Item 100035' },
  { ID: '100036', text: 'Item 100036' },
  { ID: '100037', text: 'Item 100037' },
  { ID: '100038', text: 'Item 100038' },
  { ID: '100039', text: 'Item 100039' },
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
