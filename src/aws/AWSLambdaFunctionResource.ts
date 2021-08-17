// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import AWS from 'aws-sdk'
import crypto from 'crypto'
import { zipOne } from '../util/zip'
import { hashStr } from '../util/hash'
import { config } from '../util/config'
import { Environment } from '../Environment'
import { getClient, parseS3URL } from './aws'
import { Resource } from '../resource/Resource'

type Functioncode = { ZipFile: Buffer } | { S3Bucket: string, S3Key: string }

export class AWSLambdaFunctionResource extends Resource {
  private body?: string
  private bodySignature: string
  private env?: Environment
  private envSignature: string

  constructor(
    name: string,
    crn: string | undefined,
    private readonly type: string,
    bodyOrSignature: string,
    envOrSignature: Environment | string,
  ) {
    super(name, crn)
    if (type !== 'code' && type !== 'url') {
      throw new Error(`Unsupported Lambda function type: ${type}`)
    }
    if (typeof envOrSignature === 'string') {
      this.bodySignature = bodyOrSignature
      this.envSignature = envOrSignature
    } else {
      this.body = bodyOrSignature
      this.bodySignature = hashStr(this.body)
      this.env = envOrSignature
      this.envSignature = '' // hashObj(this.env) // XXX resolve at update time?
    }
  }

  // Persistance ///////////////////////////////////////////

  public isEqual(other: AWSLambdaFunctionResource): boolean {
    return true && // XXX if no dep crn will need to return false and diff env in update?
      this.type === other.type &&
      this.bodySignature === other.bodySignature &&
      this.envSignature === other.envSignature
  }

  public toConstructorArguments(): any[] {
    return [this.type, this.bodySignature, this.envSignature]
  }

  // Lifecycle /////////////////////////////////////////////

  public async create(): Promise<void> {
    console.info('Creating Lambda function:', this.name)

    const code = await this.getCode()

    const roleArn = config.AWS_LAMBDA_ROLE_ARN || await getOrCreateServiceRoleARN(
      config.AWS_LAMBDA_ROLE_NAME,
      'lambda.amazonaws.com',
      createSimplePolicy('arn:aws:dynamodb:*:*:table/*', [
        'dynamodb:BatchGetItem',
        'dynamodb:BatchWriteItem',
        'dynamodb:ConditionCheckItem',
        'dynamodb:DeleteItem',
        'dynamodb:DescribeTable',
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:UpdateItem',
      ]),
      createSimplePolicy('arn:aws:lambda:*:*:*', [
        'lambda:InvokeFunction'
      ]),
      createSimplePolicy('arn:aws:logs:*:*:*', [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ]),
      createSimplePolicy('arn:aws:rds:*:*:*:*', [
        'rds-data:ExecuteStatement',
      ]),
      createSimplePolicy('arn:aws:rds-db:*:*:*:*/*', [
        'rds-db:connect',
      ]),
      createSimplePolicy('arn:aws:s3:::*', [
        's3:DeleteObject',
        's3:GetBucketLocation',
        's3:GetObject',
        's3:ListAllMyBuckets',
        's3:ListBucket',
        's3:PutObject',
      ]),
      createSimplePolicy('arn:aws:secretsmanager:*:*:*:*', [
        'secretsmanager:GetSecretValue',
      ]),
    )

    const res: AWS.Lambda.FunctionConfiguration = await getClient('Lambda').createFunction({
      Code: code,
      Environment: { Variables: this.env!.get() },
      FunctionName: this.name,
      Handler: config.SERVERLESS_FUNCTION_HANDLER,
      MemorySize: parseInt(config.SERVERLESS_FUNCTION_MEMORY),
      Publish: true,
      Runtime: config.SERVERLESS_FUNCTION_RUNTIME,
      Role: roleArn,
      Tags: {},
      Timeout: parseInt(config.SERVERLESS_FUNCTION_TIMEOUT_SECONDS),
    }).promise()

    if (!res.FunctionArn) {
      throw new Error(`Unable to create Lambda function: ${this.name}`)
    }
    this.setCRN(res.FunctionArn)
  }

  public async remove(): Promise<void> {
    console.info('Removing Lambda function:', this.name)
    await getClient('Lambda').deleteFunction({ FunctionName: this.name }).promise()
  }

  public async update(from: AWSLambdaFunctionResource): Promise<void> {
    console.info('Updating Lambda function:', this.name)
    if (this.type !== from.type || this.bodySignature !== from.bodySignature) {
      console.info('Updating function code')
      const code = await this.getCode()
      await getClient('Lambda').updateFunctionCode({ FunctionName: this.name, ...code }).promise()
    }
    if (this.envSignature !== from.envSignature) {
      console.info('Updating function configuration')
      await getClient('Lambda')
        .updateFunctionConfiguration({
          FunctionName: this.name,
          Environment: { Variables: this.env },
        // ...(options.memorySize ? { MemorySize: options.memorySize } : {}),
        // ...(options.runtime ? { Runtime: options.runtime } : {}),
        // ...(options.tags ? { Tags: options.tags } : {}),
        // ...(options.timeout ? { Timeout: options.timeout } : {}),
        })
        .promise()
    }
  }

  public async getCode(): Promise<Functioncode> {
    if (!this.body || !this.env) {
      throw new Error(`Unable to deploy function without body or env: ${this.name}`)
    }
    if (this.type === 'code') {
      const code = AWSLambdaFunctionResource.encodeJavascriptFunction(this.body!)
      const buffer = await zipOne('index.js', code)
      return { ZipFile: buffer }
    }
    if (this.type === 'url') {
      const { bucket, key } = parseS3URL(this.body)
      return { S3Bucket: bucket, S3Key: key }
    }
    throw new Error(`Invalid type "${this.type}" for Lambda function: ${this.name}`)
  }

  // Encode ////////////////////////////////////////////////

  public static encodeJavascriptFunction(body: string, variable?: string): string {
    const out: string[] = []
    out.push(handlerWrapper.toString())
    if (2 <= AWSLambdaFunctionResource.getJavaScriptArgumentList(body).length) {
      out.push(stateWrapper.toString())
      out.push(`const body = stateWrapper(${variable || body});`)
    } else {
      out.push(`const body = ${variable || body};`)
    }
    out.push(`exports.handler = handlerWrapper(body)`)
    return out.join('\n')
  }

  private static getJavaScriptArgumentList(func: string): string[] {
    const args = func.substring(func.indexOf('(') + 1, func.indexOf(')')).trim().split(/\s*,\s*/g)
    if (0 < args.length && args[args.length - 1].length === 0) {
      args.pop()
    }
    return args
  }
}

Resource.registerResourceClass(AWSLambdaFunctionResource)

interface AWSPolicyStatement {
  action: string[]
  effect: string
  resource: string
}

function createPolicy(statements: AWSPolicyStatement | AWSPolicyStatement[]) {
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

function createSimplePolicy(resource: string, action: string[], effect = 'Allow') {
  return createPolicy({ action, effect, resource })
}

async function getOrCreateServiceRoleARN(
  roleName: string,
  service: string,
  ...policies: (string | Record<string, any>)[]
): Promise<string> {
  const iam = getClient('IAM')

  try {
    const res = await getClient('IAM').getRole({ RoleName: roleName }).promise()
    return res.Role.Arn
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

    return res.Role.Arn
  }
}

interface State {
  prev: any
  next?: any
}

type EventHandler = (event: any) => any

export function handlerWrapper(body: EventHandler): EventHandler {
  return async (event) => {
    const events = event.responsePayload || event
    if (!Array.isArray(events)) {
      return body(events)
    }
    const interval = parseInt(process.env.SEFF_RATE_LIMIT_INTERVAL_MS || '0')
    const results = []
    for (let i = 0; i < events.length; i++) {
      const start = Date.now()
      console.log(`Processing event ${i + 1} of ${events.length}`)
      results.push(await body(events[i]))
      const sleep = start + interval - Date.now()
      if (i !== events.length - 1 && 0 < sleep) {
        console.log(`Sleeping ${sleep} milliseconds before next call`)
        await new Promise(resolve => setTimeout(resolve, sleep))
      }
    }
  }
}

type StatefulEventHandler = (event: any, state: any) => Promise<any>

export function stateWrapper(func: StatefulEventHandler): EventHandler {
  if (!process.env.SEFF_STATE_TABLE_NAME) {
    throw new Error('Missing environment variable: SEFF_STATE_TABLE_NAME')
  }
  if (!process.env.SEFF_FULL_NAME) {
    throw new Error('Missing environment variable: SEFF_FULL_NAME')
  }

  const AWS = require('aws-sdk')
  const dynamodb = new AWS.DynamoDB()

  function obj2str(obj: any): string {
    const type = typeof obj
    if (type === 'boolean' || type === 'number') {
      return String(obj)
    }
    if (type === 'string') {
      return `"${obj.replace(/\"/g, '\\"')}"`
    }
    if (obj === null) {
      return 'null'
    }
    if (obj === undefined) {
      return 'undefined'
    }
    if (Array.isArray(obj)) {
      return `[${obj.map(e => obj2str(e)).join(',')}]`
    }
    if (type === 'object') {
      return `{${
        Object
          .keys(obj)
          .sort()
          .map(key => `${key}:${obj2str(obj[key])}`)
          .join(',')
      }}`
    }
    throw new Error(`Cannot stringify: ${obj}`)
  }

  function objeq(obj1: any, obj2: any): boolean {
    return obj2str(obj1) === obj2str(obj2)
  }

  function mkitem(state?: any): any {
    return {
      TableName: process.env.SEFF_STATE_TABLE_NAME,
      [state ? 'Item' : 'Key']: {
        functionName: { S: process.env.SEFF_FULL_NAME },
        ...(state ? { state: { S: JSON.stringify(state.next) } } : {}),
      },
    }
  }

  return async function(event: any): Promise<any> {
    const prev = await dynamodb.getItem(mkitem()).promise()
    const json = prev.Item && prev.Item.state.S
    const state: State = { prev: json && JSON.parse(json) }

    const res = await func(event, state)

    if (state.next !== undefined && !objeq(state.next, json && JSON.parse(json))) {
      await dynamodb.putItem(mkitem(state)).promise()
    }
    if (state.next === undefined && json !== undefined) {
      await dynamodb.deleteItem(mkitem()).promise()
    }

    return res
  }
}
