// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ResourceProxy } from '../resource/ResourceProxy'

export abstract class AWSResourceProxy extends ResourceProxy {

  public setName(name: string): string {
    return super.setName(
      name.replace(/[A-Z]+/g, (tok, ofs) => `${ofs ? '-' : ''}${tok.toLowerCase()}`)
    )
  }

  public static registerResourceClass(name: string, clas: any): void {
    ResourceProxy.registerResourceClass(name, clas)
  }
}
