// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

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
}
