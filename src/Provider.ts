// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Metadata } from './types'

export interface Provider {
  getJavascriptEncodeClassName: () => string,
  invokeAsync: (functionName: string, args: string) => Promise<void>,
  putObject: (url: string, buffer: Buffer, metadata?: Metadata) => Promise<void>
}
