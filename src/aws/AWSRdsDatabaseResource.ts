// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import AWS from 'aws-sdk'
import crypto from 'crypto'
import { getClient } from './aws'
import { Resource } from '../resource/Resource'
import { AWSVpcResource } from './AWSVpcResource'

const CPACITIES = [2, 4, 8, 16, 32, 64, 192, 384]

export class AWSRdsDatabaseResource extends Resource {

  constructor(
    name: string,
    crn: string | undefined,
    private readonly minCapacity: number,
    private readonly maxCapacity: number,
    private readonly secondsUntilAutoPause: number,
    private dbSubnetGroupName?: string,
    private secretId?: string,
    private secretARN?: string,
    private clusterIdentifier?: string,
  ) {
    super(name, crn)
    if (!/^([a-zA-Z_]\w*)$/.test(name)) {
      throw new Error(`Invalid database name: ${name}`)
    }
    if (!CPACITIES.includes(minCapacity)) {
      throw new Error(`Invalid min capacity: ${minCapacity}`)
    }
    if (!CPACITIES.includes(maxCapacity)) {
      throw new Error(`Invalid max capacity: ${maxCapacity}`)
    }
    if (maxCapacity < minCapacity) {
      throw new Error(`Max capacity (${maxCapacity}) smaller than min capacity (${minCapacity})`)
    }
    if (Math.round(secondsUntilAutoPause) !== secondsUntilAutoPause) {
      throw new Error(`Invalid seconds until auto pause: ${secondsUntilAutoPause}`)
    }
    if (secondsUntilAutoPause < 300) {
      throw new Error(`Seconds until auto pause too small (min 300): ${secondsUntilAutoPause}`)
    }
    if (86400 < secondsUntilAutoPause) {
      throw new Error(`Seconds until auto pause too large (max 86400): ${secondsUntilAutoPause}`)
    }
  }

  public getClusterARN(): string {
    if (!this.crn) {
      throw new Error(`RDS databse has no cluster ARN: ${this.name}`)
    }
    return this.crn
  }

  public getSecretARN(): string {
    if (!this.secretARN) {
      throw new Error(`RDS database has no secret ARN: ${this.name}`)
    }
    return this.secretARN
  }

  // Persistance ///////////////////////////////////////////

  public isEqual(other: AWSRdsDatabaseResource): boolean {
    return true &&
      this.minCapacity === other.minCapacity &&
      this.maxCapacity === other.maxCapacity &&
      this.secondsUntilAutoPause === other.secondsUntilAutoPause
  }

  public toConstructorArguments(): any[] {
    return [
      this.minCapacity,
      this.maxCapacity,
      this.secondsUntilAutoPause,
      this.dbSubnetGroupName,
      this.secretId,
      this.secretARN,
      this.clusterIdentifier,
    ]
  }

  // Lifecycle /////////////////////////////////////////////

  public async create(): Promise<void> {
    console.info('Creating RDS database:', this.name)
    const password = process.env.AWS_RDS_PASSWORD || crypto.randomBytes(16).toString('hex')

    const vpc = this.dependencies['vpc'] as AWSVpcResource
    if (!vpc) {
      throw new Error(`Missing VPC dependency for RDS database: ${this.name}`)
    }

    const group: AWS.RDS.DBSubnetGroup =
      (await getClient('RDS').createDBSubnetGroup({
        DBSubnetGroupName: `rds-subnetgroup-${this.name}`,
        DBSubnetGroupDescription: `Subnet group for database: ${this.name}`,
        SubnetIds: vpc.getSubnetIds(),
      }).promise())
      .DBSubnetGroup
    if (!group || !group.DBSubnetGroupName) {
      throw new Error(`Error creating databse subnet group for RDS database: ${this.name}`)
    }

    let cluster: AWS.RDS.DBCluster | undefined
    let secret: AWS.SecretsManager.CreateSecretResponse | undefined

    try {
      cluster =
        (await getClient('RDS').createDBCluster({
          DBClusterIdentifier: `rds-cluster-${this.name}`,
          DBSubnetGroupName: group.DBSubnetGroupName,
          EnableHttpEndpoint: true,
          Engine: 'aurora-postgresql',
          EngineMode: 'serverless',
          EngineVersion: '10.14',
          MasterUsername: 'postgres',
          MasterUserPassword: password,
          ScalingConfiguration: {
            AutoPause: true,
            MaxCapacity: this.maxCapacity,
            MinCapacity: this.minCapacity,
            SecondsUntilAutoPause: this.secondsUntilAutoPause,
            TimeoutAction: 'ForceApplyCapacityChange',
          },
        }).promise())
        .DBCluster
      if (!cluster || !cluster.DBClusterArn || !cluster.DBClusterIdentifier) {
        throw new Error(`Error creting RDS database cluster: ${this.name}`)
      }

      await waitForClusterStatus(cluster.DBClusterIdentifier, 'available')

      secret =
        (await getClient('SecretsManager').createSecret({
          Name: `secret-rds-${this.name}-${crypto.randomBytes(8).toString('hex')}`,
          SecretString: JSON.stringify({
            dbInstanceIdentifier: cluster.DBClusterIdentifier,
            engine: cluster.Engine,
            host: cluster.Endpoint,
            password,
            port: cluster.Port,
            resourceId: cluster.DbClusterResourceId,
            username: cluster.MasterUsername,
          }),
        }).promise())
      if (!secret || !secret.Name || !secret.ARN ) {
        throw new Error(`Error creating secret for RDS database: ${this.name}`)
      }

      await getClient('RDSDataService').executeStatement({
        database: 'postgres',
        resourceArn: cluster!.DBClusterArn,
        secretArn: secret!.ARN,
        sql: `CREATE DATABASE ${this.name};`,
      }).promise()

    } catch (e) {
      console.info(`Error creating RDS database ${this.name}: cleaning up`)
      if (secret) {
        try {
          await this.removeSecret(secret.Name!)
        } catch (e: any) {
          console.error(`Error deleting secret for RDS database ${this.name}: ${e.message}`)
        }
      }
      if (cluster) {
        try {
          await this.removeCluster(cluster.DBClusterIdentifier!)
        } catch (e: any) {
          console.error(`Error deleting cluster for RDS database ${this.name}: ${e.message}`)
        }
      }
      try {
        await this.removeDBSubnetGroup(group.DBSubnetGroupName)
      } catch (e: any) {
        console.error(`Error deleting subnet group for RDS database ${this.name}: ${e.message}`)
      }
      throw e
    }

    this.dbSubnetGroupName = group.DBSubnetGroupName
    this.secretId = secret.Name
    this.secretARN = secret.ARN
    this.clusterIdentifier = cluster.DBClusterIdentifier
    this.setCRN(cluster.DBClusterArn)
  }

  public async remove(): Promise<void> {
    console.info('Removing RDS database:', this.name)
    if (!this.secretId || !this.clusterIdentifier ||  !this.dbSubnetGroupName) {
      throw new Error(`No resource information for RDS database: ${this.name}`)
    }
    await this.removeSecret(this.secretId)
    await this.removeCluster(this.clusterIdentifier)
    await this.removeDBSubnetGroup(this.dbSubnetGroupName)
  }

  private async removeSecret(id: string): Promise<void> {
    await getClient('SecretsManager').deleteSecret({
      SecretId: id,
      ForceDeleteWithoutRecovery: true,
    }).promise()
  }

  private async removeCluster(id: string): Promise<void> {
    await getClient('RDS').deleteDBCluster({
      DBClusterIdentifier: id,
      SkipFinalSnapshot: true,
    }).promise()
    await waitForClusterStatus(id, 'offline')
  }

  private async removeDBSubnetGroup(name: string): Promise<void> {
    await getClient('RDS').deleteDBSubnetGroup({ DBSubnetGroupName: name }).promise()
  }

  public async update(): Promise<void> {
    console.info(`Updating RDS database: ${this.name}`)
    throw new Error('Not implemented')
  }
}

Resource.registerResourceClass(AWSRdsDatabaseResource)

type ClusterStatus = 'creating' | 'available' | 'deleting' | 'offline'

async function waitForClusterStatus(id: string, target: ClusterStatus): Promise<void> {
  let count = 0
  const attempts = 12
  while (true) {
    console.info(`Checking status of RDS database ${id} (attempt ${count + 1} of ${attempts})`)
    const status = await getSafeClusterStatus(id)
    if (status === target) {
      console.info(`RDS database ${id} is ${status}`)
      if (target === 'offline') {
        console.info(`Waiting another 60 seconds for network resources to clear`)
        await new Promise(resolve => setTimeout(resolve, 60000))
      }
      return
    }
    if (++count === attempts) {
      throw new Error(
        `Error waiting for RDS database ${id} to reach status ${
        target}. Giving up after ${attempts / 2} min`
      )
    }
    console.info(`Status is ${status}. Waiting 30 seconds for ${id} to reach status ${target}`)
    await new Promise(resolve => setTimeout(resolve, 30000))
  }
}

async function getSafeClusterStatus(id: string): Promise<ClusterStatus> {
  try {
    const des = await getClient('RDS').describeDBClusters({ DBClusterIdentifier: id }).promise()
    if (!Array.isArray(des.DBClusters) || des.DBClusters.length !== 1) {
      throw new Error(`Error getting status for RDS cluster: ${id}`)
    }
    return des.DBClusters[0].Status
  } catch (e: any) {
    if (e.code === 'DBClusterNotFoundFault') {
      return 'offline'
    }
    throw e
  }
}
