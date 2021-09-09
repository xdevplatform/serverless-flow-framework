// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

function floor(n: number, decimals: number = 0) {
  const scale = Math.pow(10, decimals)
  return Math.floor(n * scale) / scale
}

export function humanizedDataSize(size: number, short = true) {
  if (typeof size !== 'number' || size < 0) {
    throw new Error(`Invalid size: ${size}`)
  }
  const sz = Math.floor(size)
  if (sz === 0) {
    return short ? '0' : 'zero'
  }
  if (sz < 1024) {
    return short ? `${sz}B` : `${sz} byte${sz === 1 ? '' : 's'}`
  }
  if (sz < 1024 * 1024) {
    return `${floor(sz / 1024, 1)}${short ? '' : ' '}KB`
  }
  if (sz < 1024 * 1024 * 1024) {
    return `${floor(sz / 1024 / 1024, 1)}${short ? '' : ' '}MB`
  }
  return `${floor(sz / 1024 / 1024 / 1024, 1)}${short ? '' : ' '}GB`
}
