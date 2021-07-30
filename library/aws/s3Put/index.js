// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

const AWS = require('aws-sdk')

function validateBucket(bucket) {
  if (
    !bucket ||
    !/(?=^.{3,63}$)(?!^(\d+\.)+\d+$)(^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])$)/.test(
      bucket,
    )
  ) {
    throw new Error(`Invalid bucket: ${bucket}`)
  }
  return bucket
}

const s3 = new AWS.S3()

const bucketName = validateBucket(process.env.S3_BUCKET_NAME)

exports.handler =  async function(event) {
  const ev = event.responsePayload || event
  const array = Array.isArray(ev) ? ev : [ev]

  const objects = array.filter(
    e => /^[a-zA-Z0-9_\-\.\/]+$/.test(e.name) && typeof e.body === 'string'
  )
  if (objects.length < array.length) {
    console.warn(`Could not write ${
      array.length - objects.length} objects out of ${
      array.length}. Invalid name or body`)
  }
  console.log(`Writing ${objects.length} items to bucket: ${bucketName}`)

  for (const object of objects) {
    await s3.putObject({
        Bucket: bucketName,
        Key: object.name,
        Body: object.body,
        ...(object.metadata ? { Metadata: object.metadata } : {}),
      })
      .promise()
  }

  return objects
}
