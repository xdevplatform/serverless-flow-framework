// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

// This is the traditional "Hello, world!". For the
// Serverless Flow Framework, this means creating a
// data flow named "hello" to simply print out a
// message to the cloud log.
//
// You can run this flow from the root folder (..) by
// running the command:
//
//   ./seff run examples/hello.js hello
//
hello = seff
  .do(
    function helloWorld() {
      console.log('Hello, world!')
    }
  )
