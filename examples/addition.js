// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

// Create a data flow named "add". This flow generates
// two random numbers and adds them together.
//
// You can run this flow from the root folder (..) by
// running the command:
//
//   ./seff run examples/additions.js add
//
add = seff

  // This is the first function in this data flow. It
  // generates two random numbers between 0 and 10.
  //
  .then(
    function generateRandomPair() {
      const a = Math.round(Math.random() * 10)
      const b = Math.round(Math.random() * 10)
      console.log(`Generated a=${a} b=${b}`)
      return { a, b }
    }
  )

  // Output from each stage is directed to the
  // input of the next. Using JavaScript's object
  // deconstruction we can simply add the two numbers.
  //
  .then(
    function addTwoNumbers({ a, b }) {
      const c = a + b
      console.log(`Adding ${a} + ${b} = ${c}`)
      return c
    }
  )

  // Finally, we print the sum to the log.
  //
  .then(
    function printNumber(number) {
      console.log(`YOUR NUMBER IS ${number}`)
    }
  )
