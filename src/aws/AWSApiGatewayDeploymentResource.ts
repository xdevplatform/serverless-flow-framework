// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import AWS from 'aws-sdk'
import { getClient } from './aws'
import { Resource } from '../resource/Resource'
import { AWSApiGatewayApiResource } from './AWSApiGatewayApiResource'

const STAGE_NAME = 'dev'

export class AWSApiGatewayDeploymentResource extends Resource {

  constructor(
    name: string,
    crn: string | undefined,
    public readonly api: AWSApiGatewayApiResource,
  ) {
    super(name, crn)
  }

  // Persistance ///////////////////////////////////////////

  public isEqual(other: AWSApiGatewayDeploymentResource): boolean {
    return true
  }

  public toConstructorArguments(): any[] {
    return [this.api]
  }

  // Lifecycle /////////////////////////////////////////////

  public async create(): Promise<void> {
    console.info('Creating API deployment:', this.name)
    const agw = getClient('APIGateway')
    const dep = await agw.createDeployment({ restApiId: this.api.crn }).promise()
    await agw.createStage({
      restApiId: this.api.crn,
      deploymentId: dep.id,
      stageName: STAGE_NAME,
    }).promise()
    console.log(`API URL: https://${this.api.crn}.execute-api.us-east-1.amazonaws.com/dev/`)
    this.setCRN(dep.id)
  }

  public async dependenciesChanged(): Promise<void> {
    console.info('API deployment dependencies changed:', this.name)
    const agw = getClient('APIGateway')
    const dep = await agw.createDeployment({
      restApiId: this.api.crn,
      stageName: STAGE_NAME,
    }).promise()
    await agw.deleteDeployment({
      restApiId: this.api.crn,
      deploymentId: this.crn,
    }).promise()
    this.setCRN(dep.id)
  }

  public async remove(): Promise<void> {
    console.info('Removing API deployent:', this.name)
    const agw = getClient('APIGateway')
    await agw.deleteStage({
      restApiId: this.api.crn,
      stageName: STAGE_NAME,
    }).promise()
    await agw.deleteDeployment({
      deploymentId: this.crn,
      restApiId: this.api.crn,
    }).promise()
  }

  public async update(from: AWSApiGatewayDeploymentResource): Promise<void> {
    throw new Error(`Update of API deployent is not supported: ${this.name}`)
  }
}

Resource.registerResourceClass(AWSApiGatewayDeploymentResource)
