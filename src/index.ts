// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as aws from './aws/aws'
import { File } from './util/file'
import { joinURL } from './util/url'
import { Provider } from './Provider'
import { initLibrary } from './library'
import { packFolder } from './util/pack'
import { colorizeConsole } from './util/console'
import { humanizedDataSize } from './util/format'
import { CommandLineArgumentsParser } from './util/cla'
import { ResourceGraph } from './resource/ResourceGraph'
import { Project, loadProject } from './project/Project'
import { Config, config, initConfig } from './util/config'

const providers: Record<string, Provider> = { aws }

colorizeConsole({
  debug: ['33m', '38;5;3m'],
  info:  ['37m', '38;5;240m'],
  log:   ['37m', '38;5;7m'],
  warn:  ['31m', '38;5;214m'],
  error: ['31m', '38;5;9m'],
})

const DEFAULT_CONFIG: Config = {
  AWS_LAMBDA_ROLE_ARN: '',
  AWS_LAMBDA_ROLE_NAME: 'seff-lambda-role',
  CLOUD_PROVIDER: 'aws',
  CONFIG_FILE: 'seff.config.json',
  FUNCTION_LIBRARY_BASEURL: 's3://seff-function-library/',
  JAVASCRIPT_SKIP_FILES: 'dist,node_modules',
  SERVERLESS_FUNCTION_HANDLER: 'index.handler',
  SERVERLESS_FUNCTION_MEMORY: '256',
  SERVERLESS_FUNCTION_RUNTIME: 'nodejs14.x',
  SERVERLESS_FUNCTION_TIMEOUT_SECONDS: '60',
  STATE_FILE_POSTFIX: '.state.json',
  STATE_TABLE_PREFIX: 'seff-state',
}

async function main() {
  const claParser = new CommandLineArgumentsParser()
    .addOption('config', 'c', 'Configuration file')
    // .addOption('provider', 'p', 'Cloud provider: only aws for now')
    .addOption(
      'state',
      's',
      `State file name (default <project>${DEFAULT_CONFIG.STATE_FILE_POSTFIX})`,
    )
    .addOption(
      'table',
      't',
      `Action state table name (default ${DEFAULT_CONFIG.STATE_TABLE_PREFIX}-<project>)`,
    )

  claParser
    .addCommand('deploy', 'Deploy or update project resources to the cloud')
    .addArg('project', 'Project file')

  claParser
    .addCommand('destroy', 'Remove deployed project resources from the cloud')
    .addArg('project', 'Project file')

  claParser
    .addCommand('run', 'Run a data flow in the cloud')
    .addOption('event', 'e', 'Event object in JSON format')
    .addArg('project', 'Project file')
    .addArg('flow', 'Flow name')

  claParser
    .addCommand('test', 'Test project file')
    .addArg('project', 'Project file')

  claParser
    .addCommand('upload', 'Create and upload a zip file with function code')
    .addOption('cross', 'c', 'Treat JavaScript as cross cloud code', false)
    .addOption('javascript', 'j', 'Build JavaScript code', false)
    .addOption('handler', 'h', 'Serverless function entry point')
    .addOption('memory', 'm', 'Serverless function memory size (MB)')
    .addOption('runtime', 'r', 'Serverless function runtime version')
    .addOption('url', 'u', 'Target object store URL (default is library bucket and folder name)')
    .addArg('path', 'folder path to compress')

  claParser
    .addHelpCommand()

  const cla = claParser.parse()

  await initConfig(
    DEFAULT_CONFIG,
    {
      STATE_TABLE_PREFIX: cla.globalOptions.table,
      CLOUD_PROVIDER: cla.globalOptions.provider,
      CONFIG_FILE: cla.globalOptions.config,
      STATE_FILE: cla.globalOptions.state,
    },
  )

  initLibrary()

  const providerName = cla.globalOptions.provider || config.CLOUD_PROVIDER
  if (!providers[providerName]) {
    throw new Error(`Unsupported cloud provider: ${providerName}`)
  }
  const provider = providers[providerName]

  let project: Project
  let stateGraph: ResourceGraph
  let stateFile: File
  const index = claParser.getCommand(cla.commandName).args.indexOf('project')
  if (0 <= index) {
    project = await loadProject(cla.args[index])
    stateFile = new File(config.STATE_FILE || project.name + config.STATE_FILE_POSTFIX, 'state')
    const stateData = await stateFile.loadJSON({ undefinedIfNotExist: true })
    stateGraph = ResourceGraph.deserialize(stateData || [])
  }

  const startTime = Date.now()
  switch (cla.commandName) {
    case 'deploy':
      await stateGraph!.transitionToGraph(
        project!.getResouceGraph(),
        async () => stateFile!.storeJSON(project!.getResouceGraph().serialize()),
      )
      break

    case 'destroy':
      await stateGraph!.transitionToGraph(
        new ResourceGraph(),
        async () => stateFile!.storeJSON(project!.getResouceGraph().serialize()),
      )
      await stateFile!.remove()
      break

    case 'run': {
      const functionName = project!.getNameOfFirstFunctionInFlow(cla.args[1]!)
      const event = cla.commandOptions.event || '{}'
      try {
        JSON.parse(event)
      } catch (e: any) {
        throw new e.constructor(`Invalid event object: ${e.message}`)
      }
      provider.invokeAsync(functionName, event)
    } break

    case 'test':
      break

    case 'upload': {
      const path = cla.args[0]
      console.log('Packing code in:', path)
      const lang = cla.commandOptions.hasOwnProperty('javascript')
        ? (cla.commandOptions.hasOwnProperty('cross') ? 'cross-cloud-javascript' : 'javascript')
        : 'autodetect'
      const buffer = await packFolder(path, lang, provider.getJavascriptEncodeClassName())
      console.log(`Uploading ${humanizedDataSize(buffer.length, false)}`)
      await provider.putObject(
        cla.commandOptions.url || joinURL(config.FUNCTION_LIBRARY_BASEURL, path, 'zip'),
        buffer,
        {
          handler: cla.commandOptions.handler || config.SERVERLESS_FUNCTION_HANDLER,
          memory: cla.commandOptions.memory || config.SERVERLESS_FUNCTION_MEMORY,
          runtime: cla.commandOptions.runtime || config.SERVERLESS_FUNCTION_RUNTIME,
        }
      )
    } break

    case 'help':
      claParser.help(cla.args[0])
  }

  const seconds = Math.round((Date.now() - startTime) / 100.0) / 10.0
  console.log(`Command ${cla.commandName} complete in ${seconds} secs`)
}

if (typeof require === 'function' && require.main === module) {
  main().catch(console.error)
}
