// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

exports.main =  async function(event) {
  const max = parseInt(process.env.MAX || '1')
  const rnd = Math.random() * max
  console.log(`Generated random number ${rnd} (out of max ${max})`)
  return rnd
}
