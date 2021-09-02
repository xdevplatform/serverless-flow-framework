// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Resource, ResourcePool } from './Resource'

export interface ResourceGraphChangeEvent {
  type: 'create' | 'remove' | 'update'
  resource: Resource
}

export type ResourceGraphChangeHandler = (event?: ResourceGraphChangeEvent) => Promise<void>

type UIDs = Record<string, boolean>

// Resource Graph holds a collection of resources and their
// parental and dependency relationships. The graph manages
// resource lifecycle through a mechanism to transition from
// one graph to another, creating, updating and removing
// resources as needed.
//
// Graphs support serialization and deserialization of their
// resources to allow resource state to be persisted and
// tracked over time.
//
export class ResourceGraph implements ResourcePool {
  private readonly resources: Record<string, Resource> = {}
  private readonly order: Resource[] = []

  constructor(public readonly name?: string) {
  }

  // Add a resource to this graph. We make sure that resource
  // UIDs (type and name) are unique in the graph and that the
  // resource's parent (if applicable) and dependencies are
  // already part of the graph.
  //
  add(resource: Resource): Resource {
    if (resource.uid in this.resources) {
      throw new Error(`Duplicate resource: ${resource.uid}`)
    }
    if (resource.parent && !(resource.parent.uid in this.resources)) {
      throw new Error(`Missing parent for resource ${resource.uid}: ${resource.parent.uid}`)
    }
    for (const [tag, res] of Object.entries(resource.dependencies)) {
      if (!(res.uid in this.resources)) {
        throw new Error(`Missing dependency for tag ${tag}: ${res.uid}`)
      }
    }
    this.resources[resource.uid] = resource
    this.order.push(resource)
    return resource
  }

  public findResourceByName(name: string, clas: Function): Resource | undefined {
    for (const [key, resource] of Object.entries(this.resources)) {
      if (key === name && resource instanceof clas) {
        return resource
      }
    }
  }

  // Find a resource by it's unique identifier.
  //
  public getResourceByUID(uid: string): Resource {
    if (!(uid in this.resources)) {
      throw new Error(`Resource not found: ${uid}`)
    }
    return this.resources[uid]
  }

  // Persistance ///////////////////////////////////////////

  // Create a new graph with the serialized "data". The data
  // is parsed and validated for correctness and integrity.
  //
  public static deserialize(data: any): ResourceGraph {
    if (!Array.isArray(data)) {
      throw new Error(`Serialized graph data is not an array: ${data}`)
    }
    const graph = new ResourceGraph()
    for (const item of data) {
      if (!Array.isArray(item) || item.length !== 2) {
        throw new Error(`Invalid item in serialized graph data: ${item}`)
      }
      const [uid, serialized] = item
      graph.add(Resource.deserialize(uid, serialized, graph))
    }
    return graph
  }

  // Serialize the graph and all its resources.
  //
  public serialize(): [string, any][] {
    return this.order.map(res => [res.uid, res.serialize()])
  }

  // Lifecycle /////////////////////////////////////////////

  // Transition to a new graph state. This triggers a series
  // of resource lifecycle changes:
  //
  // * Resources that appear in the target graph but not in
  //   this graph are created.
  //
  // * Resources that appear in this graph and not the traget
  //   graph are removed.
  //
  // * Resources that appear in both graphs, but have had their
  //   configuration changed are updated.
  //
  // This is a asyncroneous and potentially long process, that
  // may result in multiple API calls to update the state of
  // corresponding cloud services.
  //
  public async transitionToGraph(
    target: ResourceGraph,
    changeHandler?: ResourceGraphChangeHandler,
  ): Promise<void> {
    const handler = changeHandler || (async (event?: ResourceGraphChangeEvent) => {})
    const updated = await this.createOrUpdateResources(target, handler)
    await this.removeResourceAndDependents(target, handler)
    await this.handleDependencyChanges(target, handler, updated)
  }

  private async createOrUpdateResources(
    target: ResourceGraph,
    changeHandler: ResourceGraphChangeHandler,
  ): Promise<UIDs> {

    let pendingChanges = 0
    // type UIDs = Record<string, boolean>
    const updated: UIDs = {}

    // function dependenciesToUIDs(dependencies: Record<string, Resource>): UIDs {
    //   return Object.values(dependencies).reduce(
    //     (acc: UIDs, dep: Resource) => { acc[dep.uid] = true; return acc },
    //     {} as UIDs,
    //   )
    // }

    for (const tgtRes of target.order) {
      const srcRes = this.resources[tgtRes.uid]
      if (srcRes && srcRes.crn) {
        tgtRes.setCRN(srcRes.crn)
        if (!tgtRes.isEqual(srcRes)) {
          console.log(`Updating ${tgtRes.className} resource: ${tgtRes.name}`)
          await tgtRes.update(srcRes)
          await changeHandler({ type: 'update', resource: tgtRes })
          pendingChanges = 0
          updated[tgtRes.uid] = true
        } else {
          // const fromUIDs = dependenciesToUIDs(r.dependencies)
          // const toUIDs = dependenciesToUIDs(res.dependencies)
          // const changeCount =
          //   Object.keys(toUIDs).filter(uid => updated[uid] || !fromUIDs[uid]).length +
          //   Object.keys(fromUIDs).filter(uid => !toUIDs[uid]).length
          // if (changeCount) {
          //   await res.dependenciesChanged()
          //   await changeHandler({ type: 'update', resource: res })
          //   pendingChanges = 0
          //   updated[res.uid] = true
          // } else {
            pendingChanges++
          // }
        }
      }
      else {
        console.log(`Creating ${tgtRes.className} resource: ${tgtRes.name}`)
        await tgtRes.create()
        await changeHandler({ type: 'create', resource: tgtRes })
        pendingChanges = 0
      }
    }

    if (pendingChanges) {
      await changeHandler()
    }

    return updated
  }

  private async handleDependencyChanges(
    target: ResourceGraph,
    changeHandler: ResourceGraphChangeHandler,
    updated: UIDs,
  ): Promise<void> {

    function dependenciesToUIDs(dependencies: Record<string, Resource>): UIDs {
      return Object.values(dependencies).reduce(
        (acc: UIDs, dep: Resource) => { acc[dep.uid] = true; return acc },
        {} as UIDs,
      )
    }

    for (const tgtRes of target.order) {
      const srcRes = this.resources[tgtRes.uid]
      if (srcRes && srcRes.crn && tgtRes.isEqual(srcRes)) {
        const srcUIDs = dependenciesToUIDs(srcRes.dependencies)
        const tgtUIDs = dependenciesToUIDs(tgtRes.dependencies)
        const changeCount =
          Object.keys(tgtUIDs).filter(uid => updated[uid] || !srcUIDs[uid]).length +
          Object.keys(srcUIDs).filter(uid => !tgtUIDs[uid]).length
        if (changeCount) {
          await tgtRes.dependenciesChanged()
          await changeHandler({ type: 'update', resource: tgtRes })
          updated[tgtRes.uid] = true
        }
      }
    }
  }

  private async removeResourceAndDependents(
    target: ResourceGraph,
    changeHandler: ResourceGraphChangeHandler,
  ): Promise<void> {

    function getRootParent(res: Resource) {
      let r = res
      while (r.parent) {
        r = r.parent
      }
      return r
    }

    type Deps = Record<string, true>

    function addDependencies(deps: Deps, res: Resource) {
      for (const dep of Object.values(res.dependencies)) {
        deps[getRootParent(dep).uid] = true
      }
      return deps
    }

    function isAncestor(res: Resource, maybeAncestor: Resource): boolean {
      for (let r = res.parent; r; r = r.parent) {
        if (r.uid === maybeAncestor.uid) {
          return true
        }
      }
      return false
    }

    const removals: Record<string, Resource> = {}
    const groups: { deps: Deps, res: Resource }[] = []
    this.order
      .filter(res => res.crn && !target.resources[res.uid])
      .forEach(res => {
        removals[res.uid] = res
        for (const g of groups) {
          if (isAncestor(res, g.res)) {
            return addDependencies(g.deps, res)
          }
        }
        groups.push({ res, deps: addDependencies({}, res) })
      })

    for (const res of Object.values(removals)) {
      for (const dep of Object.values(res.dependencies)) {
        if (!(dep.uid in removals)) {
          console.log(`Removing configuration of ${res.uid} from resource: ${dep.uid}`)
          await res.removeConfigurationFromDependency(dep)
        }
      }
    }

    groups.sort((g1, g2) => g1.res.uid in g2.deps ? 1 : (g2.res.uid in g1.deps ? -1 : 0))

    for (const { res } of groups) {
      console.log(`Removing ${res.className} resource: ${res.name}`)
      await res.remove()
      await changeHandler({ type: 'remove', resource: res })
      res.hasBeenRemoved()
    }
  }
}
