// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

const request = require('./request')

module.exports = class Twitter {
  constructor(twitterBearerToken, verbose) {
    if (!/^[A-Za-z0-9%]+$/.test(twitterBearerToken)) {
      throw new Error('Invalid bearer token')
    }
    this.headers = { Authorization: `Bearer ${twitterBearerToken}` }
    this.verbose = verbose ? true : false
  }

  // REST /////////////////////////////////////////////////

  async _request(path, query, body) {
    const opts = { query, body, headers: this.headers, verbose: this.verbose }
    return request('https://api.twitter.com/2/' + path, opts)
  }

  // Tweets ///////////////////////////////////////////////

  static defaultFields = [ 'created_at', 'conversation_id' ]
  static minMaxResults = 10
  static maxMaxResults = 100
  static defaultMaxResults = Twitter.maxMaxResults

  static granularity = {
    d: 'day',
    day: 'day',
    h: 'hour',
    hour: 'hour',
    hours: 'hour',
    m: 'minute',
    min: 'minute',
    mins: 'minute',
    minute: 'minute',
    minutes: 'minute',
  }

  async counts(query, granularity, opts = {}) {
    if (typeof granularity !== 'string' || !Twitter.granularity[granularity.toLowerCase()]) {
      throw new Error(`Invalid granularity: ${granularity}`)
    }
    const res = await this._request('tweets/counts/recent', {
      query,
      granularity: Twitter.granularity[granularity.toLowerCase()],
      ...(opts.since ? { since_id: opts.since } : {}),
      ...(opts.until ? { until_id: opts.until } : {}),
      ...(opts.startTime ? { start_time: opts.startTime } : {}),
      ...(opts.endTime ? { end_time: opts.endTime } : {}),
    })
    if (res.errors) {
      console.error(res.errors)
      throw new Error(`Twitter API returned ${res.errors.length} errors`)
    }
    return res
  }

  async poll(query, lastTweetId, fields) {
    const all = []
    const since = Twitter.validateTweetId(lastTweetId)
    let until = undefined
    while (true) {
      const { tweets, next } = await this.search(query, { fields, since, until })
      all.unshift(...tweets)
      if (!next) {
        return all
      }
      until = Twitter.addToTweetId(res[0].id, -1)
    }
  }

  async recent(query, count, fields = Twitter.defaultFields) {
    if (count <= 0) {
      throw new Error(`Negative or zero count: ${count}`)
    }
    const all = []
    let until = undefined
    while (0 < count) {
      const required = Math.min(count, Twitter.maxMaxResults)
      const maxResults = Math.max(required, Twitter.minMaxResults)
      const { tweets } = await this.search(query, { fields, maxResults, until })
      all.unshift(...(required < maxResults ? tweets.slice(0, required) : tweets))
      if (tweets.length < maxResults) {
        break
      }
      count -= maxResults
      until = tweets[maxResults - 1].id
    }
    return all
  }

  async search(query, opts = {}) {
    const startTime = opts.startTime && Twitter.validateTime(opts.startTime)
    const endTime = opts.endTime && Twitter.validateTime(opts.endTime)
    const res = await this._request('tweets/search/recent', {
      query,
      'tweet.fields': (opts.fields || Twitter.defaultFields).join(','),
      max_results: opts.maxResults || Twitter.defaultMaxResults,
      ...(opts.since ? { since_id: opts.since } : {}),
      ...(opts.until ? { until_id: opts.until } : {}),
      ...(startTime ? { start_time: startTime } : {}),
      ...(endTime ? { end_time: endTime } : {}),
      ...(opts.next ? { next_token: opts.next } : {}),
    })
    if (res.errors) {
      console.error(res.errors)
      throw new Error(`Twitter API returned ${res.errors.length} errors`)
    }
    return { tweets: (res.data || []).reverse(), next: res.meta.next_token }
  }

  async window(query, startTime, endTime, fields = Twitter.defaultFields) {
    const all = []
    let next = undefined
    do {
      const res = await this.search(query, {
        fields,
        maxResults: Twitter.maxMaxResults,
        startTime,
        endTime,
        next,
      })
      all.unshift(...res.tweets)
      if (this.verbose) {
        process.stdout.write(`\r${all.length}`)
      }
      next = res.next
    } while (next)

    if (this.verbose) {
      process.stdout.write('\r        \r')
    }

    return all
  }

  // Static ///////////////////////////////////////////////

  static addToTweetId(id, num) {
    return String(BigInt(Twitter.validateTweetId(id)) + BigInt(num))
  }

  static validateTweetId(id) {
    if (typeof id !== 'string' || !/^\d{19}$/.test(id)) {
      throw new Error(`Invalid Tweet id: ${id}`)
    }
    return id
  }

  static validateTime(time) {
    const tm = time instanceof Date ? time.toISOString() : time
    if (typeof tm !== 'string' || !/^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(.\d\d\d)?Z$/.test(tm)) {
      throw new Error(`Invalid time format: ${time}`)
    }
    return tm
  }
}

