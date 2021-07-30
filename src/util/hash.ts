// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import crypto from 'crypto'

function obj2str(obj: any): string {
  const type = typeof obj
  if (type === 'boolean' || type === 'number') {
    return String(obj)
  }
  if (type === 'string') {
    return `"${obj.replace(/\"/g, '\\"')}"`
  }
  if (obj === null) {
    return 'null'
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(e => obj2str(e)).join(',')}]`
  }
  if (type === 'object') {
    return `{${
      Object
        .keys(obj)
        .sort()
        .map(key => `${key}:${obj2str(obj[key])}`)
        .join(',')
    }}`
  }
  throw new Error(`Cannot stringify: ${obj}`)
}

export function hashStr(str: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(str)
  return hash.digest('hex')
}

export function isStrHash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash)
}

export function hashObj(obj: any): string {
  return hashStr(obj2str(obj))
}
