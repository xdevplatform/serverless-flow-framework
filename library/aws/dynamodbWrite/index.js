// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

const AWS = require('aws-sdk')

const MAX_BATCH_SIZE = 25

const dynamodb = new AWS.DynamoDB()

function validateName(type, name) {
  if (!/^[a-zA-Z_][a-zA-Z_0-9]+$/.test(name)) {
    throw new Error(`Invalid ${type} name: ${name}`)
  }
  return name
}

const tableName = validateName('table', process.env.DYNAMODB_TABLE_NAME)
const pkey = validateName('partition key', process.env.DYNAMODB_PARTITION_KEY)

exports.handler =  async function(event) {
  const ev = event.responsePayload || event
  const array = Array.isArray(ev) ? ev : [ev]

  const records = array.filter(
    e => typeof e[pkey] === 'string' && 0 < e[pkey].length
  )
  if (records.length < array.length) {
    console.warn(`Could not write ${
      array.length - records.length} records out of ${
      array.length}. Missing partition key: ${pkey}`)
  }
  console.log(`Writing ${records.length} items to table: ${tableName}`)

  const requests = records.map(record => ({
    PutRequest: {
      Item: {
        [pkey]: {
          S: record[pkey],
        },
        json: {
          S: JSON.stringify(record),
        },
      },
    },
  }))

  const pending = requests.slice()
  while (0 < pending.length) {
    const payload = pending.splice(0, MAX_BATCH_SIZE)
    console.log(`Batch writing ${payload.length} records`)
    const res = await dynamodb.batchWriteItem({
      RequestItems: {
        [tableName]: payload,
      },
    }).promise()
    if (res.UnprocessedItems && res.UnprocessedItems[tableName]) {
      const remaining = res.UnprocessedItems[tableName]
      console.log(`Reprocessing ${remaining.length} records`)
      pending.push(...remaining)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return records
}
