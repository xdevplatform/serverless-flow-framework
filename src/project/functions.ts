// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Func } from '../Func'
import { config } from '../util/config'
import { Future } from '../util/Future'
import { Resource } from '../resource/Resource'

export class DependentFunc extends Func {
  constructor(func: Func, public readonly dep: Future<Resource>) {
    super(func.type, func.name, func.body, func.env)
  }
}

export function createDeployableFunction(fn: Func, projectName: string, flowName?: string): Func {
  const name = `seff-${projectName}-${flowName || ''}-${fn.name}`
  return new Func(
    fn.type,
    name,
    fn.body,
    fn.env.unshift({
      SEFF_FULL_NAME: name,
      SEFF_FIRST_NAME: fn.name,
      ...(flowName ? { SEFF_FLOW_NAME: flowName } : {}),
      SEFF_PROJECT_NAME: projectName,
      SEFF_STATE_TABLE_NAME: `${config.STATE_TABLE_PREFIX}-${projectName}`
    }),
  )
}
