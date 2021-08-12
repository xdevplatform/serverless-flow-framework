// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

// Create a new S3 bucket to store objects. S3 bucket names
// are global so we need to generate one here.
//
bucket = seff.aws.S3Bucket({
  name: `seff-${seff.env.USER || 'anonymous'}-examples-s3`,
})

// Create a data flow named "go". This flow generates
// random objects, transforms them and stores them in
// the S3 bucket created above.
//
// You can run this flow from the root folder (..) by
// running the command:
//
//   ./seff run examples/s3.js go
//
go = seff

  // Generate an array of message objects, each with a numeric
  // "id" and a string "text". The length of the array is
  // determined by the environment variable set just below the
  // function's code.
  //
  .then(
    function generateData() {
      function generateOneObject() {
        const name = String(10000 + Math.floor(Math.random() * 10000))
        return {
          name: `${name}.txt`,
          body: `I am object #${name}`,
        }
      }
      const count = parseInt(process.env.COUNT || '1')
      return Array.from({ length: count }, generateOneObject)
    },
    { COUNT: 3 } // Environment variables go here
  )

  // Capitalize all text and format the data for "bucket.put".
  // Add some metadata to help track capitalization. The framework
  // automatically unpacks arrays so the function code can focus
  // on the procssing logic instead of managing data types.
  //
  .then(
    function capitalize(object) {
      return {
        name: object.name,
        body: object.body.toUpperCase(),
        metadata: { 'case': 'upper' },
      }
    }
  )

  // Store the object in our S3 bucket.
  //
  .then(
    bucket.put
  )
