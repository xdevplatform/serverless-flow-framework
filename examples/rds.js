// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

// Create a new RDS table to store data records. We define
// the column in a SQL-like syntax. Under the hood, this
// will trigger provisioning of an RDS Aurora PostgreSQL
// database along with the requires VPC and other resources.
//
records = sff.aws.RDS(`
  id varchar(16) primary key
  text varchar(32)
  created_at varchar(64)
`)

// Create a data flow named "go". This flow generates
// data records and stores it in the SQL table created above.
//
// You can run this flow from the root folder (..) by
// running the command:
//
//   ./sff run examples/rds.js go
//
go = sff

  // Generate an record each with an "id", "text" and creation
  // time.
  //
  .then(
    function generateDataRecord() {
      const id = String(10000 + Math.floor(Math.random() * 10000))
      return { id, text: `I am record ${id}`, created_at: (new Date()).toString() }
    }
  )

  // Insert the record into the table.
  //
  .then(
    records.insert
  )
