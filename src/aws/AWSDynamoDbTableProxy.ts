// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Env } from '../Environment'
import { library } from '../library'
import { Future } from '../util/Future'
import { Resource } from '../resource/Resource'
import { DependentFunc } from '../project/functions'
import { AWSResourceProxy } from './AWSResourceProxy'
import { ResourceGraph } from '../resource/ResourceGraph'
import { AWSDynamoDbTableResource } from './AWSDynamoDbTableResource'

export class AWSDynamoDbTableProxy extends AWSResourceProxy {

  public createResource(graph: ResourceGraph): Resource {
    return this.setResource(
      graph.add(
        new AWSDynamoDbTableResource(
          this.name,
          undefined,
          this.initializer.pkey,
          this.initializer.skey,
        )
      )
    )
  }

  public get write(): DependentFunc {
    return new DependentFunc(
      library.aws.dynamodbWrite.derive(
        new Future<Env>(
          () => ({
            DYNAMODB_TABLE_NAME: this.name,
            DYNAMODB_PARTITION_KEY: this.initializer.pkey,
          })
        )
      ),
      new Future<Resource>(() => this.resource),
    )
  }
}

AWSResourceProxy.registerResourceClass('DynamoDB', AWSDynamoDbTableProxy)
