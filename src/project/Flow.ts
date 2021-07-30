// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Func } from '../Func'
import { parseURL } from '../util/url'
import { config } from '../util/config'
import { Future } from '../util/Future'
import { Resource } from '../resource/Resource'
import { ResourceGraph } from '../resource/ResourceGraph'
import { Collectible, Collector } from '../util/Collector'

export type FunctionResourceCreator = (functions: Func[], graph: ResourceGraph) => Resource[]

export class DepFunc extends Func {
  constructor(func: Func, public readonly dep: Future<Resource>) {
    super(func.type, func.name, func.body, func.env)
  }
}

export class Flow implements Collectible {
  private _name?: string
  private readonly functions: Func[] = []

  constructor(public readonly projectName: string, collector: Collector<Flow>, name?: string) {
    collector.add(this, name)
  }

  public get name(): string | undefined {
    return this._name
  }

  public setName(name: string): void {
    if (!/^[a-zA-Z_]\w*$/.test(name)) {
      throw new Error(`Invalid flow name: ${name}`)
    }
    this._name = name
  }

  public do(...args: any[]): Flow {
    return this.then(...args)
  }

  public then(...args: any[]): Flow {
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
      this.functions.push(args[0])
      return this
    }

    if (1 === args.length && typeof args[0] === 'function') {
      this.functions.push(new Func('code', args[0].name, args[0].toString(), envs))
      return this
    }

    if (1 === args.length && typeof args[0] === 'object' && args[0] !== null) {
      envs.unshift(args[0].env)
      this.functions.push(new Func('url', args[0].name, args[0].url, envs))
      return this
    }

    if (1 === args.length && typeof args[0] === 'string') {
      const url = parseURL(args[0])
      this.functions.push(new Func('url', url.corename, url.href, envs))
      return this
    }

    if (2 === args.length && typeof args[0] === 'string' && typeof args[1] === 'string') {
      const url = parseURL(args[1])
      this.functions.push(new Func('url', args[0], url.href, envs))
      return this
    }

    throw new Error(`Invalid function: ${args.map(a => `${a}`).join(', ')}`)
  }

  public createResources(graph: ResourceGraph): string | undefined {
    if (!Flow.functionResourceCreator) {
      throw new Error('No function resource creator')
    }

    if (this.functions.length === 0) {
      return
    }

    const dependencies: Record<string, Resource> = {}
    const functions = this.functions.map(fn => {
      const name = `sff-${this.projectName}-${this.name}-${fn.name}`
      if (fn instanceof DepFunc) {
        dependencies[name] = fn.dep.resolve()
      }
      return new Func(fn.type, name, fn.body, fn.env.unshift({
        SFF_FULL_NAME: name,
        SFF_FIRST_NAME: fn.name,
        SFF_FLOW_NAME: this.name,
        SFF_PROJECT_NAME: this.projectName,
        SFF_STATE_TABLE_NAME: `${config.STATE_TABLE_PREFIX}-${this.projectName}`
      }))
    })

    const resources = Flow.functionResourceCreator(functions, graph)
    for (const res of resources) {
      if (res.name in dependencies) {
        res.addDependency('proxy', dependencies[res.name])
      }
    }

    return functions[0].name
  }

  // Static ////////////////////////////////////////////////

  private static functionResourceCreator?: FunctionResourceCreator

  public static registerFunctionResourceCreator(creator: FunctionResourceCreator): void {
    if (typeof creator !== 'function') {
      throw new Error(`Invalid function resource creator: ${creator}`)
    }
    if (Flow.functionResourceCreator) {
      throw new Error('Duplicate function resource creator')
    }
    Flow.functionResourceCreator = creator
  }
}
