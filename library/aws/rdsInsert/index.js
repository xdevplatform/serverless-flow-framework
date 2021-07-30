// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

const AWS = require('aws-sdk')

const MAX_BATCH_SIZE = 1000

const rdd = new AWS.RDSDataService()

function validateARN(type, arn) {
  if (typeof arn !== 'string' || !/^arn(:([\w\-]*|\*)){5}([:/]([\w\-]+|\*))?$/.test(arn)) {
    throw new Error(`Invalid ${type} ARN: ${arn}`)
  }
  return arn
}

function validateName(type, name) {
  if (typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z_0-9]+$/.test(name)) {
    throw new Error(`Invalid ${type} name: ${name}`)
  }
  return name
}

function validateColumns(str) {
  let obj
  try {
    obj = JSON.parse(str)
  } catch (e) {
    console.error(e.message)
    throw new Error(`Invalid column string: ${str}`)
  }
  if (!Array.isArray(obj)) {
    throw new Error(`Columns is not an array: ${str}`)
  }
  return obj
}

const database = validateName('database', process.env.DATABASE_NAME)
const resourceArn = validateARN('cluster', process.env.DATABASE_CLUSTER_ARN)
const secretArn = validateARN('secret', process.env.DATABASE_SECRET_ARN)
const tableName = validateName('table', process.env.DATABASE_TABLE_NAME)
const columns = validateColumns(process.env.DATABSE_TABLE_COLUMNS)

async function sql(query) {
  await rdd.executeStatement({ database, resourceArn, secretArn, sql: query + ';'}).promise()
}

exports.handler =  async function(event) {
  const ev = event.responsePayload || event
  const array = Array.isArray(ev) ? ev : [ev]

  const required = {}
  for (const col of columns) {
    if (col.required) {
      required[col.name] = true
    }
  }
  const requiredCount = Object.keys(required).length

  const records = array.filter(
    e => Object.keys(e).filter(k => required[k]).length === requiredCount
  )
  if (records.length < array.length) {
    console.warn(`Could not write ${
      array.length - records.length} records out of ${
      array.length}. Missing values for required columns`)
  }
  console.log(`Writing ${records.length} items to table: ${tableName}`)

  const pending = records.slice()
  while (0 < pending.length) {
    const payload = pending.splice(0, MAX_BATCH_SIZE)
    console.log(`Batch writing ${payload.length} records`)
    await sql(`INSERT INTO ${tableName} (${columns.map(c => c.name).join(', ')})\nVALUES\n${
      payload.map(p => `  (${
        columns.map(c => c.family === 'textual' ? `'${p[c.name]}'` : p[c.name]).join(', ')
      })`).join('\n')
    }`)
  }

  return records
}
