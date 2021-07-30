// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

// Create a new DynamoDB table to store message objects.
// Use the field "id" as the partition key for this table.
//
messages = sff.aws.DynamoDB({ pkey: 'id' })

// Create a data flow named "go". This flow generates
// random messages, transforms them and stores them in
// the DynamoDB table created above.
//
// You can run this flow from the root folder (..) by
// running the command:
//
//   ./sff run examples/dynamodb.js go
//
go = sff

  // Generate an array of message objects, each with a numeric
  // "id" and a string "text". The length of the array is
  // determined by the environment variable set just below the
  // function's code.
  //
  .then(
    function generateMessages() {
      function generateOneMessage() {
        const id = String(10000 + Math.floor(Math.random() * 10000))
        return { id, text: `I am message ${id}` }
      }
      const length = parseInt(process.env.LENGTH || '1')
      return Array.from({ length }, generateOneMessage)
    },
    { LENGTH: 5 } // Environment variables go here
  )

  // Add a timestamp to each message. The framework automatically
  // unpacks arrays so the function code can focus on the
  // procssing logic instead of managing data types.
  //
  .then(
    function addTimestamp(message) {
      return {
        ...message,
        receivedAt: (new Date()).toISOString(),
      }
    }
  )

  // Write the message objects to the table.
  //
  .then(
    messages.write
  )
