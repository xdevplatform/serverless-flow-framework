// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

exports.main =  async function(event, state) {
  const count = ((state.prev && state.prev.count) || 0) + 1
  console.log(`Invoked ${count} time${count === 1 ? '' : 's'}`)
  state.next = { count }
  return count
}
