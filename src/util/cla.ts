// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import ospath from 'path'
import { Options } from '../types'

function pad(str: string, width: number) {
  const wd = Math.max(Math.round(Math.abs(width)), str.length)
  const padLeft = width < 0 ? wd - str.length : 0
  const padRight = 0 < width ? wd - str.length : 0
  return `${' '.repeat(padLeft)}${str}${' '.repeat(padRight)}`
}

class ExclusiveRecord<T> {
  public readonly values: Record<string, T> = {}
  public readonly order: [string, T][] = []

  constructor(public readonly name: string) {
  }

  public add(key: string, value: T): void {
    if (this.values.hasOwnProperty(key)) {
      throw new Error(`Duplicate ${this.name}: ${value}`)
    }
    this.values[key] = value
    this.order.push([key, value])
  }

  public get count(): number {
    return this.order.length
  }

  public get(key: string): T {
    return this.values[key]
  }

  public includes(key: string): boolean {
    return this.values.hasOwnProperty(key)
  }

  public indexOf(key: string): number {
    return this.order.findIndex(e => e[0] === key)
  }
}

class Option {
  public static readonly maxLongLength = 13

  constructor(
    public readonly long: string,
    public readonly short: string,
    public readonly description: string,
    public readonly hasArg: boolean,
  ) {
    if (short.length !== 1) {
      throw new Error(`Invalid short option name: ${short}`)
    }
    if (long.length < 2 || Option.maxLongLength < long.length) {
      throw new Error(`Invalid long option name: ${long}`)
    }
  }

  public toString(): string {
    return `-${this.short}, --${pad(this.long, Option.maxLongLength)} ${this.description}`
  }
}

class Optional<T> {
  public readonly longs = new ExclusiveRecord<Option>('long option')
  public readonly shorts = new ExclusiveRecord<Option>('short option')

  public addOption(long: string, short: string, help: string, hasArg = true): T {
    const opt = new Option(long, short, help, hasArg)
    this.longs.add(long, opt)
    this.shorts.add(short, opt)
    return this as unknown as T
  }
}

class Argument {
  constructor(public readonly name: string, public readonly help: string) {
    if (!/^[a-zA-Z0-9_\-]+$/.test(name)) {
      throw new Error(`Invalid argument name: ${name}`)
    }
  }
}

export class Command extends Optional<Command> {
  public readonly args = new ExclusiveRecord<Argument>('argument')

  constructor(public readonly name: string, public readonly help: string) {
    super()
  }

  public addArg(name: string, help: string): Command {
    this.args.add(name, new Argument(name, help))
    return this
  }

  public toString(): string {
    const args = this.args.order.map(([an, _]) => `<${an}>`).join(' ')
    return `${this.name} ${0 < this.longs.count ? '[options...] ' : ''}${args}`
  }
}

class ParseError extends Error {
}

export interface CommandLineArguments {
  globalOptions: Options
  commandOptions: Options
  commandName: string
  args: string[]
}

export class CommandLineArgumentsParser extends Optional<CommandLineArgumentsParser> {
  private commands = new ExclusiveRecord<Command>('command')

  private getUsageHeader() {
    return `Usage: ${ospath.basename(process.argv[1])} ${
      0 < this.longs.count ? '[options...] ' : ''}`
  }

  // Commands //////////////////////////////////////////////

  public addCommand(name: string, help: string): Command {
    const command = new Command(name, help)
    this.commands.add(command.name, command)
    return command
  }

  public getCommand(name: string): Command {
    return this.commands.get(name)
  }

  // Help //////////////////////////////////////////////////

  public addHelpCommand() {
    this
      .addCommand('help', 'Display this message or command help')
      .addArg('command', 'Command name')
    return this
  }

  public async help(commandName: string) {
    const command = this.commands.get(commandName)
    if (!command) {
      this.usage()
    }

    const lines = []
    lines.push(`${this.getUsageHeader()}${command}`)

    lines.push('')
    lines.push(command.help)

    lines.push('')
    lines.push('Arguments:')
    for (const [an, arg] of command.args.order) {
      lines.push(`  ${pad(an, 10)} ${arg.help}`)
    }

    if (0 < command.longs.count) {
      lines.push('')
      lines.push('Command options:')
      for (const [name, opt] of command.longs.order) {
        lines.push('  ' + opt.toString())
      }
    }

    if (0 < this.longs.count) {
      lines.push('')
      lines.push('Global options:')
      for (const [name, opt] of this.longs.order) {
        lines.push('  ' + opt.toString())
      }
    }

    lines.push('')
    console.error(lines.join('\n'))
    process.exit(1)
  }

  public usage(error?: string): void {
    const lines = []

    if (typeof error === 'string' && 0 < error.length) {
      lines.push(error)
      lines.push('')
    }

    lines.push(this.getUsageHeader() + '<command> [options...] [args...]')

    lines.push('')
    lines.push('Commands:')
    for (const [name, command] of this.commands.order) {
      lines.push(`  ${command}`)
    }

    if (0 < this.longs.count) {
      lines.push('')
      lines.push('Options:')
      for (const [name, opt] of this.longs.order) {
        lines.push('  ' + opt.toString())
      }
    }

    lines.push('')
    console.error(lines.join('\n'))
    process.exit(1)
  }

  // Parse /////////////////////////////////////////////////

  private parseOptions(args: string[], optional: Optional<unknown>): Options {
    const options: Options = {}

    while (0 < args.length) {
      if (args[0][0] !== '-') {
        break
      }
      const arg = args.shift()!

      const opt = 2 <= arg.length && arg[1] === '-'
        ? optional.longs.get(arg.substr(2))
        : optional.shorts.get(arg.substr(1))
      if (!opt) {
        throw new ParseError(`Invalid option: ${arg}`)
      }

      let value: string | null = null
      if (opt.hasArg) {
        if (args.length === 0) {
          throw new ParseError(`Option requires an argument: ${arg}`)
        }
        value = args.shift()!
      }

      options[opt.long] = value
    }

    return options
  }

  public parse(args?: string[]): CommandLineArguments {
    try {
      args = args || process.argv.slice(2)

      const globalOptions = this.parseOptions(args, this)

      const commandName = args.shift()
      if (!commandName) {
        throw new ParseError('Missing command')
      }

      const command = this.commands.get(commandName)
      if (!command) {
        throw new ParseError(`Unrecognized command: ${commandName}`)
      }

      const commandOptions = this.parseOptions(args, command)

      if (args.length !== command.args.count) {
        throw new ParseError(`Command ${command.name} requires ${command.args.count} args`)
      }

      return { globalOptions, commandName, commandOptions, args }

    } catch (e) {
      if (e instanceof ParseError) {
        this.usage(e.message)
      }
      throw e
    }
  }
}
