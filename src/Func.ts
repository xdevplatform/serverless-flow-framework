// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { parseURL } from './util/url'
import { Environment } from './Environment'

export type FuncType = 'code' | 'url'

export class Func {
  public readonly env: Environment

  constructor(
    public readonly type: FuncType,
    public readonly name: string,
    public readonly body: string, // code or url
    env?: any,
  ) {
    this.env = env instanceof Environment ? env : new Environment(env)
  }

  public derive(moreEnv: any, newName?: string): Func {
    return new Func(this.type, newName || this.name, this.body, this.env.clone().push(moreEnv))
  }

  // Static ////////////////////////////////////////////////

  public static create(args: any[]): Func {
    const envs: Object[] = []
    while (
      1 < args.length &&
      typeof args[args.length - 1] === 'object' &&
      args[args.length - 1] !== null
    ) {
      envs.unshift(args.pop())
    }

    if (1 === args.length && args[0] instanceof Func) {
      args[0].env.push(envs)
      return args[0]
    }

    if (1 === args.length && typeof args[0] === 'function') {
      return new Func('code', args[0].name, args[0].toString(), envs)
    }

    if (1 === args.length && typeof args[0] === 'object' && args[0] !== null) {
      envs.unshift(args[0].env)
      return new Func('url', args[0].name, args[0].url, envs)
    }

    if (1 === args.length && typeof args[0] === 'string') {
      const url = parseURL(args[0])
      return new Func('url', url.corename, url.href, envs)
    }

    if (2 === args.length && typeof args[0] === 'string' && typeof args[1] === 'string') {
      const url = parseURL(args[1])
      return new Func('url', args[0], url.href, envs)
    }

    throw new Error(`Invalid function: ${args.map(a => `${a}`).join(', ')}`)
  }
}
