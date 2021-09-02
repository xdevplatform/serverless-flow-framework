// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Func } from '../Func'
import { Resource } from '../resource/Resource'
import { ResourceGraph } from '../resource/ResourceGraph'
import { Collectible, Collector } from '../util/Collector'
import { DependentFunc, createDeployableFunction } from './functions'

export type FunctionResourceCreator = (functions: Func[], graph: ResourceGraph) => Resource[]

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
    this.functions.push(Func.create(args))
    return this
  }

  public createResources(graph: ResourceGraph): string | undefined {
    if (!Flow.functionResourceCreator) {
      throw new Error('No function resource creator')
    }

    if (this.functions.length === 0) {
      return
    }

    const dependencies: Record<string, Resource> = {}

    const funcs = this.functions.map(fn => {
      const func = createDeployableFunction(fn, this.projectName, this.name)
      if (fn instanceof DependentFunc) {
        dependencies[func.name] = fn.dep.resolve()
      }
      return func
    })

    const resources = Flow.functionResourceCreator(funcs, graph)
    for (const res of resources) {
      if (res.name in dependencies) {
        res.addDependency('proxy', dependencies[res.name])
      }
    }

    return funcs[0].name
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
