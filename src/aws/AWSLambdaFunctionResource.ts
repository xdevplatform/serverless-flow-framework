// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import AWS from 'aws-sdk'
import { zipOne } from '../util/zip'
import { config } from '../util/config'
import { Environment } from '../Environment'
import { stateWrapper } from './stateWrapper'
import { Resource } from '../resource/Resource'
import { hashObj, hashStr } from '../util/hash'
import { createSimplePolicy, getClient, getOrCreateServiceRole, parseS3URL } from './aws'

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

    const role = await getOrCreateServiceRole(
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
      Handler: config.SERVERLESS_FUNCTION_HANDLER || 'index.handler',
      MemorySize: parseInt(config.SERVERLESS_FUNCTION_MEMORY || '256'),
      Publish: true,
      Runtime: config.SERVERLESS_FUNCTION_RUNTIME || 'nodejs14.x',
      Role: role.Arn,
      Tags: {},
      Timeout: parseInt(config.SERVERLESS_FUNCTION_TIMEOUT_SECONDS || '3'),
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
    if (2 <= AWSLambdaFunctionResource.getJavaScriptArgumentList(body).length) {
      out.push(stateWrapper.toString())
      out.push(`const body = stateWrapper(${variable || body});`)
    } else {
      out.push(`const body = ${variable || body};`)
    }
    out.push(`exports.handler = async (event) => {`)
    out.push(`  const ev = event.responsePayload || event;`)
    out.push(`  return Array.isArray(ev) ? ev.map(body) : body(ev);`)
    out.push(`}`)
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
