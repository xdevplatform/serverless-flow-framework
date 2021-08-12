// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import vm from 'vm'
import ospath from 'path'
import { Flow } from './Flow'
import { promises as fs } from 'fs'
import { library } from '../library'
import { Collector } from '../util/Collector'
import { IntervalTrigger } from './IntervalTrigger'
import { ResourceGraph } from '../resource/ResourceGraph'
import { ResourceProxy } from '../resource/ResourceProxy'

type GlobalResourceCreator = (graph: ResourceGraph) => void

export class Project {
  constructor(
    private readonly graph: ResourceGraph,
    private firstFunctions: Record<string, string>,
  ) {
  }

  public getResouceGraph() : ResourceGraph {
    return this.graph
  }

  public getNameOfFirstFunctionInFlow(flowName: string): string {
    const functionName = this.firstFunctions[flowName]
    if (!functionName) {
      throw new Error(`Flow not found: ${flowName}`)
    }
    return functionName
  }

  // Static ////////////////////////////////////////////////

  private static globalResourceCreator?: GlobalResourceCreator

  public static createGlobalResources(graph: ResourceGraph): void {
    if (!Project.globalResourceCreator) {
      throw new Error('No global resource creator')
    }
    Project.globalResourceCreator(graph)
  }

  public static registerGlobalResourceCreator(creator: GlobalResourceCreator): void {
    if (typeof creator !== 'function') {
      throw new Error(`Invalid global resource creator: ${creator}`)
    }
    if (Project.globalResourceCreator) {
      throw new Error('Duplicate global resource creator')
    }
    Project.globalResourceCreator = creator
  }
}

export async function loadProject(filename: string): Promise<Project> {
  const baseName = ospath.basename(filename)
  const match = baseName.match(/^([a-zA-Z_]\w*)\.js$/)
  if (!match) {
    throw new Error(`Invalid project name: ${baseName}`)
  }
  const projectName = match[1]

  const code = await fs.readFile(filename)

  const flowCollector = new Collector<Flow>('flow')
  const resourceCollector = new Collector<ResourceProxy>()
  const context = runCodeInVM(projectName, code, flowCollector, resourceCollector)

  applyNamesFromRuntimeContext(context)

  const graph = new ResourceGraph(projectName)
  Project.createGlobalResources(graph)
  createResourcesFromProxies(resourceCollector.objects, graph)
  const functionNames = createResourcesFromFlows(flowCollector.objects, graph)
  return new Project(graph, functionNames)
}

function runCodeInVM(
  projectName: string,
  code: Buffer,
  flowCollector: Collector<Flow>,
  resourceCollector: Collector<ResourceProxy>,
): Object {
  const flow = new Flow(projectName, flowCollector)
  const context = {
    seff: {
      aws: new Proxy({}, {
        get: (target: any, name: string) => {
          const clas = ResourceProxy.getClassByName(name)
          return (initializer: any) => resourceCollector.add(new clas(name, initializer))
        },
      }),
      do: (...args: any[]) => flow.do(...args),
      env: { ...process.env },
      every: (interval: string) => new IntervalTrigger(projectName, flowCollector, interval),
      lib: library,
      then: (...args: any[]) => flow.then(...args),
    },
  }
  vm.createContext(context)
  vm.runInContext(code as any, context)
  return context
}

function applyNamesFromRuntimeContext(context: Record<string, any>): void {
  const { seff, ...project } = context
  for (const [name, value] of Object.entries(project)) {
    if (value instanceof Flow) {
      value.setName(name)
    }
    if (value instanceof ResourceProxy && !value.hasName()) {
      value.setName(name)
    }
  }
}

function createResourcesFromProxies(resourceProxies: ResourceProxy[], graph: ResourceGraph): void {
  for (const resourceProxy of resourceProxies) {
    if (!resourceProxy.hasName()) {
      throw new Error(`Missing name for resource of class: ${resourceProxy.className}`)
    }
    resourceProxy.createResource(graph)
  }
}

function createResourcesFromFlows(flows: Flow[], graph: ResourceGraph): Record<string, string> {
  const firstFunctions: Record<string, string> = {}
  for (const flow of flows) {
    const functionName = flow.createResources(graph)
    if (functionName) {
      firstFunctions[flow.name!] = functionName
    }
  }
  return firstFunctions
}
