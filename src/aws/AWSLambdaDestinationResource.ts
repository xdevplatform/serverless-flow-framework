// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getClient } from './aws'
import { Resource } from '../resource/Resource'
import { AWSLambdaFunctionResource } from './AWSLambdaFunctionResource'

export class AWSLambdaDestinationResource extends Resource {

  constructor(
    name: string,
    crn: string | undefined,
    public readonly destination: AWSLambdaFunctionResource,
  ) {
    super(name, crn)
  }

  // Persistance ///////////////////////////////////////////

  public isEqual(other: AWSLambdaDestinationResource): boolean {
    return true &&
      (this.parent && this.parent.name) === (other.parent && other.parent.name) &&
      this.destination.name === other.destination.name
  }

  public toConstructorArguments(): any[] {
    return [this.destination]
  }

  // Lifecycle /////////////////////////////////////////////

  public async create(): Promise<void> {
    console.info('Creating Lambda destination:', this.name)
    await this.setLambdaDestination(this.destination.crn)
    this.setCRN(this.name)
  }

  public async remove(): Promise<void> {
    console.info('Removing Lambda destination:', this.name)
    await this.setLambdaDestination()
  }

  public async update(): Promise<void> {
    console.info('Updating Lambda destination:', this.name)
    await this.setLambdaDestination(this.destination.crn)
  }

  private async setLambdaDestination(crn?: string): Promise<void> {
    await getClient('Lambda')
      .putFunctionEventInvokeConfig({
        FunctionName: this.parent!.name,
        DestinationConfig: {
          ...(crn ? { OnSuccess: { Destination: crn } } : {}),
        },
      })
      .promise()
  }
}

Resource.registerResourceClass(AWSLambdaDestinationResource)
