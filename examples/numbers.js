// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

// Create a new DynamoDB table to store numbers. Use the field
// "id" as the partition key for this table.
//
numbers = sff.aws.DynamoDB({ pkey: 'id' })

// Create a data flow named "go". This flow counts the number
// of times it was invoked and stores these numbers into the
// "numbers" table.
//
// You can run this flow from the root folder (..) by
// running the command:
//
//   ./sff run examples/numbers.js go
//
go = sff

  // Use a library function to count invocations. Library
  // functions have state too.
  //
  .then(
    sff.lib.std.countInvocations,
  )

  // Add an "id" so we can store the number in our table.
  //
  .then(
    function addId(count) {
      return { id: `id${count}`, count }
    }
  )

  // Write to the table.
  //
  .then(
    numbers.write
  )
