// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export interface Collectible {
  setName: (name: string) => void
}

export class Collector<T extends Collectible> {
  public readonly objects: T[] = []

  constructor(public readonly prefix?: string) {
  }

  add(object: T, name?: string): T {
    if (name || this.prefix) {
      object.setName(name || `${this.prefix}${this.objects.length}`)
    }
    this.objects.push(object)
    return object
  }
}
