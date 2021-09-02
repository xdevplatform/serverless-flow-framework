// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getClient } from './aws'
import { Resource } from '../resource/Resource'
import { AWSLambdaFunctionResource } from './AWSLambdaFunctionResource'
import { AWSApiGatewayResourceResource } from './AWSApiGatewayResourceResource'

export class AWSApiGatewatLambdaPermissionResource extends Resource {

  constructor(
    name: string,
    crn: string | undefined,
    private method: string,
    private resource: AWSApiGatewayResourceResource,
    private lambda: AWSLambdaFunctionResource,
  ) {
    super(name, crn)
  }

  // Persistance ///////////////////////////////////////////

  public isEqual(other: AWSApiGatewatLambdaPermissionResource): boolean {
    return this.method === other.method &&
      this.resource.name === other.resource.name &&
      this.lambda.name === other.lambda.name
  }

  public toConstructorArguments(): any[] {
    return [this.method, this.resource, this.lambda]
  }

  // Lifecycle /////////////////////////////////////////////

  private get statementId(): string {
    return `seff-apigateway-${this.resource.api.crn}-${this.resource.pathPart}-${this.method}`
  }

  public async create(): Promise<void> {
    console.info('Creating API Lambda permission:', this.name)
    const [region, account, _, functionName] = this.lambda.crn!.split(':').slice(3)
    await getClient('Lambda').addPermission({
      FunctionName: functionName,
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
      SourceArn: `arn:aws:execute-api:${region}:${account}:${
        this.resource.api.crn}/*/*/${this.resource.pathPart}`,
      StatementId: this.statementId,
    }).promise()
    this.setCRN(`permission:${this.resource.api.crn}:${this.resource.crn}:${this.method}`)
  }

  public async dependenciesChanged(): Promise<void> {
    console.info('API Lambda permission dependencies changed:', this.name)
    await this.remove()
  }

  public async remove(): Promise<void> {
    console.info('Removing API Lambda permission:', this.name)
    await getClient('Lambda').removePermission({
      FunctionName: this.lambda.crn!.split(':')[6],
      StatementId: this.statementId,
    }).promise()
  }

  public async update(from: AWSApiGatewatLambdaPermissionResource): Promise<void> {
    await from.remove()
    await this.create()
  }
}

Resource.registerResourceClass(AWSApiGatewatLambdaPermissionResource)
