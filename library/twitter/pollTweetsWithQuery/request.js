// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

const https = require('https')
const querystring = require('querystring')

const TIMEOUT_MS = 1000

module.exports = async function request(url, opts = {}) {
  const qurl = url + (opts.query ? '?' + querystring.stringify(opts.query) : '')
  const options = { ...(opts.headers ? { headers: opts.headers } : {}) }

  function sendRequest() {
    let textEncoder
    if (opts.body) {
      const json = JSON.stringify(opts.body)
      textEncoder = new TextEncoder().encode(json)
      options.method = 'POST'
      options.headers['Content-Type'] = 'application/json'
      options.headers['Content-Length'] = textEncoder.length
    }

    return new Promise((resolve, reject) => {
      let code

      let timeout = setTimeout(() => {
        timeout = undefined
        if (!code) {
          const error = new Error('API timeout')
          code = error.code = 901
          reject(error)
        }
      }, TIMEOUT_MS)

      const req = https.request(qurl, options, res => {
        const responseBody = []

        res.on('data', data => responseBody.push(data))

        res.on('end', data => {
          responseBody.push(data)
          const body = responseBody.join('')
          const obj = (() => {
            try {
              return JSON.parse(body)
            } catch (e) {
            }
          })()
          if (timeout) {
            clearTimeout(timeout)
            timeout = undefined
          }
          if (!code) {
            if (!obj || res.statusCode < 200 || 299 < res.statusCode) {
              const error = new Error(`API error: ${res.statusCode}`)
              code = error.code = res.statusCode
              error.details = obj || body.trim()
              reject(error)
            } else {
              resolve(obj)
            }
          }
        })
      })

      req.on('error', error => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = undefined
        }
        if (!code) {
          const err = new Error(`Error sending request: ${error}`)
          code = error.code = 900
          reject(error)
        }
      })

      if (textEncoder) {
        req.write(textEncoder)
      }
      req.end()
    })
  }

  for (let delay = 1;; delay *= 2) {
    try {
      const res = await sendRequest()
      if (opts.verbose && 1 < delay) {
        process.stdout.write('\r                                    \r')
      }
      return res
    } catch (e) {
      if ((e.code !== 429 && e.code !== 901) || 900 < delay) {
        throw e
      }
      for (let i = 0; i < delay; i++) {
        if (opts.verbose) {
          process.stdout.write(`\rError ${e.code}. Sleeping ${i + 1}/${delay} seconds`)
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
}
