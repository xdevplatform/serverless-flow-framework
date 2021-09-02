// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getClient } from './aws'
import { config } from '../util/config'
import { Resource } from '../resource/Resource'
import { AWSLambdaFunctionResource } from './AWSLambdaFunctionResource'
import { AWSApiGatewayResourceResource } from './AWSApiGatewayResourceResource'

export class AWSApiGatewayMethodResource extends Resource {

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

  public isEqual(other: AWSApiGatewayMethodResource): boolean {
    return this.method === other.method &&
      this.resource.name === other.resource.name &&
      this.lambda.name === other.lambda.name
  }

  public toConstructorArguments(): any[] {
    return [this.method, this.resource, this.lambda]
  }

  // Lifecycle /////////////////////////////////////////////

  private getLambdaInvocationURI(): string {
    const arn = this.lambda.crn
    const region = this.lambda.crn!.split(':')[3]
    return `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${arn}/invocations`
  }

  public async create(): Promise<void> {
    console.info('Creating API Method:', this.name)
    const agw = getClient('APIGateway')

    await agw.putMethod({
      restApiId: this.resource.api.crn,
      resourceId: this.resource.crn,
      httpMethod: this.method,
      authorizationType: 'NONE',
    }).promise()

    await agw.putMethodResponse({
      restApiId: this.resource.api.crn,
      resourceId: this.resource.crn,
      httpMethod: this.method,
      statusCode: '200',
      responseModels: { 'application/json': 'Empty' },
    }).promise()

    await agw.putIntegration({
      restApiId: this.resource.api.crn,
      resourceId: this.resource.crn,
      httpMethod: this.method,
      type: 'AWS_PROXY',
      uri: this.getLambdaInvocationURI(),
      integrationHttpMethod: 'POST',
      passthroughBehavior: 'WHEN_NO_MATCH',
      contentHandling: 'CONVERT_TO_TEXT',
      timeoutInMillis: parseInt(config.SERVERLESS_FUNCTION_TIMEOUT_SECONDS) + 1000,
    }).promise()

    await agw.putIntegrationResponse({
      restApiId: this.resource.api.crn,
      resourceId: this.resource.crn,
      httpMethod: this.method,
      statusCode: '200',
      responseTemplates: { 'application/json': '' },
    }).promise()

    this.setCRN(`method:${this.resource.api.crn}:${this.resource.crn}:${this.method}`)
  }

  public async remove(): Promise<void> {
    console.info('Removing API Method:', this.name)
    const agw = getClient('APIGateway')

    await agw.deleteIntegrationResponse({
      restApiId: this.resource.api.crn,
      resourceId: this.resource.crn,
      httpMethod: this.method,
      statusCode: '200',
    }).promise()

    await agw.deleteIntegration({
      restApiId: this.resource.api.crn,
      resourceId: this.resource.crn,
      httpMethod: this.method,
    }).promise()

    await agw.deleteMethodResponse({
      restApiId: this.resource.api.crn,
      resourceId: this.resource.crn,
      httpMethod: this.method,
      statusCode: '200',
    }).promise()

    await agw.deleteMethod({
      restApiId: this.resource.api.crn,
      resourceId: this.resource.crn,
      httpMethod: this.method,
    }).promise()
  }

  public async update(from: AWSApiGatewayMethodResource): Promise<void> {
    console.info('Updating API Method:', this.name)
    if (this.method !== from.method || this.resource.name !== from.resource.name) {
      throw new Error('Method or resource update for API method is not supported')
    }
    const agw = getClient('APIGateway')
    await agw.updateIntegration({
      restApiId: this.resource.api.crn,
      resourceId: this.resource.crn,
      httpMethod: this.method,
      patchOperations: [
        {
          op: 'replace',
          path: '/uri',
          value: this.getLambdaInvocationURI(),
        },
      ],
    }).promise()
  }
}

Resource.registerResourceClass(AWSApiGatewayMethodResource)
