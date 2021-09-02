// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Func } from '../Func'
import { DependentFunc } from './functions'
import { Resource } from '../resource/Resource'
import { ResourceGraph } from '../resource/ResourceGraph'
import { createDeployableFunction } from './functions'

export type ApiEndpoints = Record<string, Record<string, Func>>

type ResourceCreator = (
  name: string,
  endpoints: ApiEndpoints,
  graph: ResourceGraph,
) => Resource[]

const HTTP_METHODS: Record<string, boolean> = {
  ANY: true,
  CONNECT: true,
  DELETE: true,
  GET: true,
  HEAD: true,
  OPTIONS: true,
  PATCH: true,
  POST: true,
  PUT: true,
  TRACE: true,
}

export class Api {
  public readonly endpoints: ApiEndpoints = {}

  constructor(public readonly projectName: string) {
  }

  private method(method: string, pathPart: string, args: any[]): void {
    method = Api.validateHttpMethod(method)
    pathPart = Api.validateHttpPathPart(pathPart)

    if (this.endpoints[pathPart] && this.endpoints[pathPart][method]) {
      throw new Error(`Duplicate API method: ${method} ${pathPart}`)
    }

    const func = Func.create(args)

    if (!this.endpoints[pathPart]) {
      this.endpoints[pathPart] = {}
    }
    this.endpoints[pathPart][method] = func
  }

  public getHttpMethodFunctions() {
    const methods: Record<string, Function> = {}
    for (const method of Object.keys(HTTP_METHODS)) {
      methods[method] = (pp: string, ...args: any[]) => {
        this.method(method, pp, args)
        return methods
      }
    }
    return methods
  }

  public createResources(graph: ResourceGraph): void {
    if (!Api.resourceCreator) {
      throw new Error('No function resource creator')
    }

    const dependencies: Record<string, Resource> = {}

    const endpoints: ApiEndpoints = {}
    for (const [pathPart, methods] of Object.entries(this.endpoints)) {
      endpoints[pathPart] = {}
      for (const [method, fn] of Object.entries(methods)) {
        const func = createDeployableFunction(fn, this.projectName)
        endpoints[pathPart][method] = func
        if (fn instanceof DependentFunc) {
          dependencies[func.name] = fn.dep.resolve()
        }
      }
    }

    const resources = Api.resourceCreator(
      this.projectName,
      endpoints,
      graph,
    )

    for (const res of resources) {
      if (res.name in dependencies) {
        res.addDependency('proxy', dependencies[res.name])
      }
    }
  }

  // Static ////////////////////////////////////////////////

  private static resourceCreator?: ResourceCreator

  public static registerResourceCreator(creator: ResourceCreator): void {
    if (typeof creator !== 'function') {
      throw new Error(`Invalid function resource creator: ${creator}`)
    }
    if (Api.resourceCreator) {
      throw new Error('Duplicate function resource creator')
    }
    Api.resourceCreator = creator
  }

  public static validateHttpMethod(method: string): string {
    method = method.toLocaleUpperCase()
    if (!HTTP_METHODS[method]) {
      throw new Error(`Invalid HTTP method: ${method}`)
    }
    return method
  }

  public static validateHttpPathPart(pathPart: string): string {
    const match = pathPart.match(/^\/?([a-zA-Z0-9_\-]+)$/)
    if (!match) {
      throw new Error(`Invalid HTTP path part: ${pathPart}`)
    }
    return match[1]
  }
}
