// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

const https = require('https')
const querystring = require('querystring')

module.exports = class Twitter {
  constructor(twitterBearerToken) {
    if (!/^[A-Za-z0-9%]{112}$/.test(twitterBearerToken)) {
      throw new Error('Invalid bearer token')
    }
    this.headers = { Authorization: `Bearer ${twitterBearerToken}` }
  }

  // REST /////////////////////////////////////////////////

  _request(path, query, body) {
    const qs = query && '?' + querystring.stringify(query)
    const url = `https://api.twitter.com/2/${path}${qs || ''}`

    const options = {
      headers: this.headers,
    }
    let textEncoder
    if (body) {
      textEncoder = new TextEncoder().encode(JSON.stringify(body))
      options.method = 'POST'
      options.headers['Content-Type'] = 'application/json'
      options.headers['Content-Length'] = textEncoder.length
    }

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, res => {

        if (res.status < 200 || 299 < res.status) {
          const err = `Twitter API error: ${res.status} ${res.statusText}`
          console.error(err)
          console.error('  url:', url)
          console.error('  opts:')
          for (const key in options) {
            console.error(`    ${key}: ${options[key]}`)
          }
          reject(new Error(err))
          return
        }

        const responseBody = []
        res.on('data', data => responseBody.push(data))
        res.on('end', data => {
          responseBody.push(data)
          try {
            resolve(JSON.parse(responseBody.join('')))
          } catch (e) {
            const err = `Twitter API response error: ${e.message}`
            console.error(err)
            reject(new Error(err))
          }
        })
      })

      req.on('error', error => {
        const err = `Error sending request to Twitter: ${error}`
        console.error(err)
        reject(new Error(err))
      })

      if (textEncoder) {
        req.write(textEncoder)
      }
      req.end()
    })
  }

  // Tweets ///////////////////////////////////////////////

  static defaultFields = [ 'created_at', 'conversation_id' ]
  static minMaxResults = 10
  static maxMaxResults = 100
  static defaultMaxResults = Twitter.maxMaxResults

  async poll(query, lastTweetId, fields) {
    const tweets = []
    let since = Twitter.validateTweetId(lastTweetId)
    let until = undefined
    while (true) {
      const res = await this.search(query, { fields, since, until })
      tweets.unshift(...res)
      if (res.length < Twitter.defaultMaxResults) {
        return tweets
      }
      until = Twitter.addToTweetId(res[0].id, -1)
    }
  }

  async recent(query, count, fields = Twitter.defaultFields) {
    if (count <= 0) {
      throw new Error(`Negative or zero count: ${count}`)
    }
    const tweets = []
    let until = undefined
    while (0 < count) {
      const required = Math.min(count, Twitter.maxMaxResults)
      const maxResults = Math.max(required, Twitter.minMaxResults)
      const res = await this.search(query, { fields, maxResults, until })
      tweets.unshift(...(required < maxResults ? res.slice(0, required) : res))
      if (res.length < maxResults) {
        break
      }
      count -= maxResults
      until = res[maxResults - 1].id
    }
    return tweets
  }

  async search(query, opts = {}) {
    const res = await this._request('tweets/search/recent', {
      query,
      'tweet.fields': (opts.fields || Twitter.defaultFields).join(','),
      max_results: opts.maxResults || Twitter.defaultMaxResults,
      ...(opts.since ? { since_id: opts.since } : {}),
      ...(opts.until ? { until_id: opts.until } : {}),
    })
    if (res.errors) {
      console.error(res.errors)
      throw new Error(`Twitter API returned ${res.errors.length} errors`)
    }
    return (res.data || []).reverse()
  }

  // Static ///////////////////////////////////////////////

  static addToTweetId(id, num) {
    return String(BigInt(Twitter.validateTweetId(id)) + BigInt(num))
  }

  static validateTweetId(id) {
    if (!/^\d{19}$/.test(id)) {
      throw new Error(`Invalid Tweet id: ${id}`)
    }
    return id
  }
}

