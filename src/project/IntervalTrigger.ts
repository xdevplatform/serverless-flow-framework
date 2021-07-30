// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Flow } from './Flow'
import { Collector } from '../util/Collector'

export class IntervalTrigger extends Flow {
  // public readonly cronExpression: string

  constructor(projectName: string, collector: Collector<Flow>, interval: string) {
    super(projectName, collector)

    if (typeof interval !== 'string') {
      throw new Error(`Interval must be a string: ${interval}`)
    }
    const intr = interval.toLowerCase()

    const match = intr.match(/^\s*(\d+)?\s*(s(ec(onds?)?)?|m(in(utes?)?)?|h(our?)?)\s*$/)
    // this.cronExpression = match
    //   ? `${match[1] === undefined ? '*' : `0/${match[1]}`} * * * ? *`
    //   : intr
  }
}
