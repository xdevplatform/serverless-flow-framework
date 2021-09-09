// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import osurl from 'url'
import ospath from 'path'

export function joinURL(baseurl: string, filepath: string, extension?: string): string {
  return baseurl + (baseurl.endsWith('/') ? '' : '/') +
    ospath.basename(filepath) + (extension ? '.' + extension : '')
}

export interface URL {
  protocol: string
  hostname: string
  pathname: string
  filename: string
  corename: string
  href: string
}

export function parseURL(url: string): URL {
  const u = new osurl.URL(url)
  if (!u.protocol || !u.hostname || !u.pathname) {
    throw new Error(`Invalid URL: ${url}`)
  }
  const filename = ospath.basename(u.pathname)
  return {
    protocol: u.protocol.endsWith(':') ? u.protocol.slice(0, -1) : u.protocol,
    hostname: u.hostname,
    pathname: u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname,
    filename,
    corename: filename.split('.').slice(0, -1).join('.'),
    href: u.href,
  }
}
