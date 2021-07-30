// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Future } from './util/Future'

export type Env = Record<string, string>

type MaybeEnv = Record<string, any>

type PotentialEnv = MaybeEnv | MaybeEnv[] | Future<MaybeEnv>

type AlmostEnv = Env | Future<MaybeEnv>

export class Environment {
  constructor(potential: PotentialEnv | undefined, private readonly envs: AlmostEnv[] = []) {
    this.push(potential)
  }

  public clone(): Environment {
    return new Environment(undefined, this.envs)
  }

  public get(): Env {
    const envs = this.envs.map(e => e instanceof Future ? validateEnv(e.resolve()) : e)
    return Object.assign({}, ...envs)
  }

  public push(potential?: PotentialEnv): Environment {
    return this.add('push', potential)
  }

  public unshift(potential?: PotentialEnv): Environment {
    return this.add('unshift', potential)
  }

  private add(method: 'push' | 'unshift', potential?: PotentialEnv): Environment {
    if (Array.isArray(potential)) {
      for (const p of potential) {
        this.add(method, p)
      }
    }
    else if (potential instanceof Future) {
      this.envs[method](potential)
    }
    else if (potential !== undefined) {
      this.envs[method](validateEnv(potential))
    }
    return this
  }
}

function validateEnv(maybe: any): Env {
  if (typeof maybe !== 'object' || maybe === null) {
    throw new Error(`Invalid environment: ${maybe}`)
  }
  const env: Env = {}
  for (const [key, value] of Object.entries(maybe)) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error(`Invalid environment value for ${key}: ${value}`)
    }
    env[key] = String(value)
  }
  return env
}
