// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getClient } from './aws'
import { Resource } from '../resource/Resource'
import { AWSApiGatewayApiResource } from './AWSApiGatewayApiResource'

export class AWSApiGatewayResourceResource extends Resource {

  constructor(
    name: string,
    crn: string | undefined,
    public readonly api: AWSApiGatewayApiResource,
    public readonly pathPart: string,
  ) {
    super(name, crn)
  }

  // Persistance ///////////////////////////////////////////

  public isEqual(other: AWSApiGatewayResourceResource): boolean {
    return this.pathPart === other.pathPart
  }

  public toConstructorArguments(): any[] {
    return [this.api, this.pathPart]
  }

  // Lifecycle /////////////////////////////////////////////

  public async create(): Promise<void> {
    console.info('Creating API Resource:', this.name)
    const resource = await getClient('APIGateway').createResource({
      restApiId: this.api.crn,
      parentId: await this.api.getRoot(),
      pathPart: this.pathPart,
    }).promise()
    this.setCRN(resource.id)
  }

  public async remove(): Promise<void> {
    console.info('Removing API Resource:', this.name)
    await getClient('APIGateway').deleteResource({
      restApiId: this.api.crn,
      resourceId: this.crn,
    }).promise()
  }

  public async update(from: AWSApiGatewayResourceResource): Promise<void> {
    throw new Error('API Resource update is not supported')
  }
}

Resource.registerResourceClass(AWSApiGatewayResourceResource)
