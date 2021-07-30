// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

const Twitter = require('./twitter')
const twitter = new Twitter(process.env.TWITTER_BEARER)

module.exports.main = async function main(event, state) {
  const feed = validateEvent(event)

  const tweets = state.prev && state.prev.lastTweetId
    ? await twitter.poll(feed.query, state.prev.lastTweetId, feed.fields)
    : await twitter.recent(feed.query, 100, feed.fields)

  if (0 === tweets.length) {
    throw new Error('No Tweets found. Throwing exception to stop the flow')
  }

  const firstTweetId = (state.prev && state.prev.firstTweetId) || tweets[0].id
  const lastTweetId = tweets[tweets.length - 1].id
  state.next = { firstTweetId, lastTweetId }
  console.log(`Loaded ${tweets.length} tweets: ${tweets[0].id}..${lastTweetId}`)

  return tweets
}

const FIELDS = [
  'attachments',
  'author_id',
  'context_annotations',
  'conversation_id',
  'created_at',
  'entities',
  'geo',
  'id',
  'in_reply_to_user_id',
  'lang',
  'non_public_metrics',
  'organic_metrics',
  'possibly_sensitive',
  'promoted_metrics',
  'public_metrics',
  'referenced_tweets',
  'reply_settings',
  'source',
  'text',
  'withheld',
]

function validateEvent(event) {
  if (typeof event !== 'object' || event === null) {
    throw new Error(`Invalid event object: ${event}`)
  }
  if (typeof event.name !== 'string' || !/^[\w\-]+$/.test(event.name)) {
    throw new Error(`Invalid feed name: ${event.name}`)
  }
  if (typeof event.query !== 'string' || event.query.trim().length === 0) {
    throw new Error(`Invalid query for feed ${event.name}: ${event.query}`)
  }
  if (!Array.isArray(event.fields)) {
    throw new Error(`Invalid fields array for feed ${event.name}: ${event.fields}`)
  }
  for (const field of event.fields) {
    if (!FIELDS.includes(field)) {
      throw new Error(`Invalid field for feed ${event.name}: ${field}`)
    }
  }
  return { name: event.name, fields: event.fields, query: event.query.trim() }
}
