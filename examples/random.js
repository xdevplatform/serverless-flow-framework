// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

// Create a data flow named "random". This flow generates
// a random number using a library function, multiplies it
// and writes it out to the log.
//
// You can run this flow from the root folder (..) by
// running the command:
//
//   ./seff run examples/random.js random
//
random = seff

  // Use a library function to generate a random number
  // between 0 and 1.
  //
  .then(
    seff.lib.std.generateRandomNumber,
  )

  // Multiply by something.
  //
  .then(
    function multiplyNumber(number) {
      return number * 100
    }
  )

  // Finally, print the number to the log.
  //
  .then(
    function printNumber(number) {
      console.log(`YOUR NUMBER IS ${number}`)
    }
  )
