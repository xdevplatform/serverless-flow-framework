// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Env } from '../Environment'
import { library } from '../library'
import { Future } from '../util/Future'
import { Resource } from '../resource/Resource'
import { AWSVpcResource } from './AWSVpcResource'
import { DependentFunc } from '../project/functions'
import { AWSResourceProxy } from './AWSResourceProxy'
import { ResourceGraph } from '../resource/ResourceGraph'
import { AWSRdsTableResource } from './AWSRdsTableResource'
import { AWSRdsDatabaseResource } from './AWSRdsDatabaseResource'

export class AWSRdsTableProxy extends AWSResourceProxy {
  private database?: AWSRdsDatabaseResource
  private dbname?: string

  public createResource(graph: ResourceGraph): Resource {
    const vpc =
      graph.findResourceByName(`${graph.name}-vpc`, AWSVpcResource) ||
      graph.add(new AWSVpcResource(`${graph.name}-vpc`))

    this.dbname = `${graph.name}db`
    this.database =
      (graph.findResourceByName(this.dbname, AWSRdsDatabaseResource) as AWSRdsDatabaseResource) ||
      (() => {
        const db = new AWSRdsDatabaseResource(this.dbname, undefined, 2, 2, 300)
        db.addDependency('vpc', vpc)
        return graph.add(db)
      })()
    const table = new AWSRdsTableResource(this.name, undefined, this.initializer)
    table.addDependency('database', this.database!)
    return this.setResource(graph.add(table))
  }

  public get insert(): DependentFunc {
    return new DependentFunc(
      library.aws.rdsInsert.derive(
        new Future<Env>(
          () => {
            if (!this.dbname || !this.database || !this.resource) {
              throw new Error(`Resources not created for RDS table: ${this.name}`)
            }
            return {
              DATABASE_NAME: this.dbname,
              DATABASE_CLUSTER_ARN: this.database.getClusterARN(),
              DATABASE_SECRET_ARN: this.database.getSecretARN(),
              DATABASE_TABLE_NAME: this.name,
              DATABSE_TABLE_COLUMNS: JSON.stringify((this.resource as AWSRdsTableResource).columns),
            }
          },
          () => {
            if (!this.database || !this.database.crn) {
              throw new Error('AWSRdsTableProxy.insert cannot be created without an RDS database')
            }
          }
        )
      ),
      new Future<Resource>(() => this.database!),
    )
  }
}

AWSResourceProxy.registerResourceClass('RDS', AWSRdsTableProxy)
