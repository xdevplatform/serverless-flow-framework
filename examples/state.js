// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

// Create a data flow named "go". This flow generates
// a random number then prints it to the log along
// with the invocation count.
//
// You can run this flow from the root folder (..) by
// running the command:
//
//   ./sff run examples/state.js go
//
go = sff

  // Use a library function to generate a random number
  // between 0 and 1.
  //
  .then(
    sff.lib.std.generateRandomNumber,
  )

  // Print the random number. This function uses the
  // optional state variable to track the number of
  // times it was invoked. The state object holds
  // the prvious state in the "prev" field. The
  // function can put the updated state in the "next"
  // field. If that field is undefined, the previous
  // state is deleted.
  //
  .then(
    function printEventWithCount(number, state) {
      const count = ((state.prev && state.prev.count) || 0) + 1
      console.log(`Invoked ${count} time${count === 1 ? '' : 's'}`)
      state.next = { count }
      console.log('Number:', number)
    }
  )
