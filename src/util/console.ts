// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export interface ConsoleColors {
  debug: string[],
  info: string[],
  log: string[],
  warn: string[],
  error: string[],
}

export function colorizeConsole(colors: ConsoleColors) {
  if (!process.stdout.hasColors || !process.stdout.hasColors()) {
    return
  }

  const has256 = process.stdout.hasColors(256)
  const colorTable = Object.entries(colors).map(([level, colors]) => {
    if (colors.length === 0) {
      throw new Error(`No colors for level: ${level}`)
    }
    return [level, has256 && 1 < colors.length ? colors[1] : colors[0]]
  })

  const stream: Record<string, any> = {
    debug: process.stdout,
    info: process.stdout,
    log: process.stdout,
    warn: process.stderr,
    error: process.stderr,
  }

  for (const [level, color] of colorTable) {
    const printer = (console as any)[level]
    ;(console as any)[level] = (...args: any[]) => {
      stream[level].write(`\x1b[${color}`)
      printer(...args, '\x1b[0m')
    }
  }
}
