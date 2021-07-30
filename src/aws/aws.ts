// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import AWS from 'aws-sdk'
import crypto from 'crypto'
import { Func } from '../Func'
import { Flow } from '../project/Flow'
import { hashObj } from '../util/hash'
import { parseURL } from '../util/url'
import { config } from '../util/config'
import { Project } from '../project/Project'
import { Metadata, Options } from '../types'
import { Resource } from '../resource/Resource'
import { ResourceGraph } from '../resource/ResourceGraph'
import { AWSDynamoDbTableResource } from './AWSDynamoDbTableResource'
import { AWSLambdaFunctionResource } from './AWSLambdaFunctionResource'
import { AWSLambdaDestinationResource } from './AWSLambdaDestinationResource'

// Import all AWS proxies and resources to make sure they
// are all registered and can be used by project code.
//
import './AWSDynamoDbTableProxy'
import './AWSDynamoDbTableResource'
import './AWSLambdaDestinationResource'
import './AWSLambdaFunctionResource'
import './AWSRdsDatabaseResource'
import './AWSRdsTableProxy'
import './AWSRdsTableResource'
import './AWSS3BucketProxy'
import './AWSS3BucketResource'
import './AWSVpcResource'

//// Provider interfcae ////////////////////////////////////

export function getJavascriptEncodeClassName(): string {
  return 'AWSLambdaFunctionResource'
}

export async function invokeAsync(functionName: string, args: string): Promise<void> {
  await getClient('Lambda').invokeAsync({ FunctionName: functionName, InvokeArgs: args }).promise()
}

export async function putObject(url: string, buffer: Buffer, metadata?: Metadata): Promise<void> {
  const { bucket, key } = parseS3URL(url)
  await getClient('S3')
    .putObject({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ...(metadata ? { Metadata: metadata } : {}),
    })
    .promise()
}

//// Register resource creators ////////////////////////////

Flow.registerFunctionResourceCreator(
  (functions: Func[], graph: ResourceGraph): Resource[] => {
    let prev: AWSLambdaFunctionResource | undefined
    const res: AWSLambdaFunctionResource[] = []
    for (const fn of functions) {
      const f = new AWSLambdaFunctionResource(fn.name, undefined, fn.type, fn.body, fn.env)
      graph.add(f)
      if (prev) {
        const dest = new AWSLambdaDestinationResource(`${prev.name}--${f.name}`, undefined, f)
        dest.setParent(prev)
        dest.addDependency('dest', f)
        graph.add(dest)
      }
      prev = f
      res.push(f)
    }
    return res
  }
)

Project.registerGlobalResourceCreator(
  (graph: ResourceGraph) => {
    const stateTableName = `${config.STATE_TABLE_PREFIX}-${graph.name}`
    graph.add(new AWSDynamoDbTableResource(stateTableName, undefined, 'functionName'))
  }
)

//// For AWS... classes ////////////////////////////////////

AWS.config.signatureVersion = 'v4'

const region = process.env.AWS_REGION || 'us-east-1'
if (!/^(af|ap|ca|cn|eu|me|sa|us|us-gov)-(central|east|north|northeast|northwest|south|southeast|southwest|west)-\d$/.test(region)) {
  throw new Error(`Invalid AWS region: ${region}`)
}
AWS.config.update({ region })

export interface AWSPolicyStatement {
  action: string[]
  effect: string
  resource: string
}

export function createPolicy(statements: AWSPolicyStatement | AWSPolicyStatement[]) {
  const sts = Array.isArray(statements) ? statements : [statements]
  return {
    Version: '2012-10-17',
    Statement: sts.map((st) => ({
      Effect: st.effect,
      Action: st.action,
      Resource: st.resource,
    })),
  }
}

export function createSimplePolicy(resource: string, action: string[], effect = 'Allow') {
  return createPolicy({ action, effect, resource })
}

export const getClient = (() => {
  const clients: Record<string, any> = {}

  return function getClient(service: string, opts: Options = {}): any {
    const hash = hashObj({ service, opts })
    if (!clients[hash]) {
      const constructor: any = (AWS as any)[service]
      clients[hash] = new constructor(opts)
    }
    return clients[hash]
  }
})()

export async function getOrCreateServiceRole(
  roleName: string,
  service: string,
  ...policies: (string | Record<string, any>)[]
) {
  const iam = getClient('IAM')

  try {
    const res = await getClient('IAM').getRole({ RoleName: roleName }).promise()
    return res.Role
  } catch (e) {
    if (e.code !== 'NoSuchEntity') {
      throw e
    }
    console.info(`Creating IAM role for service ${service}: ${roleName}`)
    const res = await getClient('IAM').createRole({
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: service,
            },
            Action: 'sts:AssumeRole',
          },
        ],
      }),
    }).promise()

    const policiesArray = policies === undefined
      ? []
      : Array.isArray(policies) ? policies : [policies]

    for (const policy of policiesArray) {
      if (typeof policy === 'string') {
        await getClient('IAM').attachRolePolicy({
          RoleName: roleName,
          PolicyArn: policy,
        }).promise()
      } else {
        await getClient('IAM').putRolePolicy({
          PolicyDocument: JSON.stringify(policy),
          PolicyName: `policy_${roleName}_${crypto.randomBytes(4).toString('hex')}`,
          RoleName: roleName,
        })
        .promise()
      }
    }

    // It takes a while for a service role to become assumable
    await new Promise((resolve) => setTimeout(resolve, 10000))

    return res.Role
  }
}

export function parseS3URL(url: string): { bucket: string, key: string } {
  const u = parseURL(url)
  if (u.protocol !== 's3' || u.hostname.length < 3 || 63 < u.hostname.length) {
    throw new Error(`Invalid S3 URL : ${url}`)
  }
  return { bucket: u.hostname, key: u.pathname }
}
