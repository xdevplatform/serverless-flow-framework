// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Resource } from './Resource'
import { Collectible } from '../util/Collector'
import { ResourceGraph } from './ResourceGraph'

export abstract class ResourceProxy implements Collectible {
  private _name?: string
  private _resource?: Resource

  constructor(public readonly className: string, public readonly initializer: any) {
    if (
      typeof initializer === 'object' &&
      initializer !== null &&
      typeof initializer.name === 'string'
    ) {
      this.setName(initializer.name)
    }
  }

  public get name(): string {
    if (!this._name) {
      throw new Error(`${this.className} resource proxy has no name`)
    }
    return this._name
  }

  public hasName(): boolean {
    return this._name !== undefined
  }

  public setName(name: string): string {
    if (!/^[a-zA-Z_][\w\-]*$/.test(name)) {
      throw new Error(`Invalid name for ${this.className} resource: ${name}`)
    }
    return this._name = name
  }

  public get resource() : Resource {
    if (!this._resource) {
      throw new Error(`${this.className} resource proxy has no resource: ${this._name}`)
    }
    return this._resource
  }

  protected setResource(resource: Resource): Resource {
    return this._resource = resource
  }

  public abstract createResource(graph: ResourceGraph): Resource

  // Static ////////////////////////////////////////////////

  private static readonly classes: Record<string, any> = {}

  public static getClassByName(name: string): any {
    const clas = ResourceProxy.classes[name]
    if (!clas) {
      throw new Error(`Unsupported resource: ${name}`)
    }
    return clas
  }

  public static registerResourceClass(name: string, clas: any): void {
    if (!/^[a-zA-Z_]\w*$/.test(name)) {
      throw new Error(`Invalid resource proxy name: ${name}`)
    }
    if (typeof clas !== 'function') {
      throw new Error(`Invalid resource proxy class: ${clas}`)
    }
    if (ResourceProxy.classes[name]) {
      throw new Error(`Duplicate resource proxy class: ${clas}`)
    }
    ResourceProxy.classes[name] = clas
  }
}
