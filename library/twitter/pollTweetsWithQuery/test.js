// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

const { main } = require('./main')

const CGRAY = '\x1b[38;5;240m'
const CLEAR = '\x1b[0m'

async function testOnce(event, state) {
  console.log(`${CGRAY}----- Before state -----${CLEAR}`)
  console.log(state)
  console.log(`${CGRAY}----- Invoking handler -----${CLEAR}`)
  const res = await main(event, state)
  console.log(`${CGRAY}----- After state -----${CLEAR}`)
  console.log(state)
  console.log(`${CGRAY}----- Response -----${CLEAR}`)
  console.log(res.length)
  // for (const { id } of res) console.log(id.substr(6))
  if (0 < res.length) console.log(res[0].id.substr(6))
  if (1 < res.length) console.log(res[res.length - 1].id.substr(6))
}

async function test() {
  console.log(`${CGRAY}Starting test${CLEAR}`)
  const event = { name: 'sff', query: 'serverless flow framework', fields: ['id', 'text'] }
  console.log('event:', event)

  let state = {}

  while (true) {
    await testOnce(event, state)
    state = { prev: state.next }

    for (let count = 3; count; count--) {
      console.log(`${CGRAY}Sleeping ${count}...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}

test().catch(console.error)
