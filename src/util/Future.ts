// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export class Future<T> {
  constructor(
    private readonly resolver: () => T,
    private readonly validateCanBeResolved?: () => void) {
  }

  public resolve(): T {
    if (this.validateCanBeResolved) {
      this.validateCanBeResolved()
    }
    return this.resolver()
  }
}
