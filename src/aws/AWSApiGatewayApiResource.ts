// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import AWS from 'aws-sdk'
import { getClient } from './aws'
import { Resource } from '../resource/Resource'

export class AWSApiGatewayApiResource extends Resource {
  private _root?: string

  constructor(name: string, crn: string | undefined) {
    super(name, crn)
  }

  public async getRoot(): Promise<string> {
    if (!this._root) {
      const agw = getClient('APIGateway')
      const resources = await agw.getResources({ restApiId: this.crn }).promise()
      if (!Array.isArray(resources.items)) {
        throw new Error(`Missing or invalid resources on API: ${this.name} (${this.crn})`)
      }
      const roots = resources.items.filter((r: any) => r.path === '/')
      if (roots.length !== 1) {
        throw new Error(`Missing root resource on API: ${this.name} (${this.crn})`)
      }
      this._root = roots[0].id
    }
    return this._root!
  }

  // Persistance ///////////////////////////////////////////

  public isEqual(other: AWSApiGatewayApiResource): boolean {
    return true
  }

  public toConstructorArguments(): any[] {
    return [this._root]
  }

  // Lifecycle /////////////////////////////////////////////

  public async create(): Promise<void> {
    console.info('Creating API:', this.name)
    const agw = getClient('APIGateway')
    const api: AWS.APIGateway.RestApi = await agw.createRestApi({
      name: this.name,
      endpointConfiguration: {
        types: ['REGIONAL'],
      },
    }).promise()
    if (!api.id) {
      throw new Error('Error create APIGateway API')
    }
    this.setCRN(api.id)
  }

  public async remove(): Promise<void> {
    console.info('Removing API:', this.name)
    await getClient('APIGateway').deleteRestApi({ restApiId: this.crn }).promise()
  }

  public async update(from: AWSApiGatewayApiResource): Promise<void> {
    throw new Error('API update is not supported')
  }
}

Resource.registerResourceClass(AWSApiGatewayApiResource)
