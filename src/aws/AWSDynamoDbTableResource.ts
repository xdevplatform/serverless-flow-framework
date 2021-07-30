// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import AWS from 'aws-sdk'
import { getClient } from './aws'
import { Resource } from '../resource/Resource'

export class AWSDynamoDbTableResource extends Resource {
  public readonly pkey: DynamoDbKey
  public readonly skey?: DynamoDbKey

  constructor(
    name: string,
    crn: string | undefined,
    pkey: DynamoDbKey | string,
    skey?: DynamoDbKey | string,
  ) {
    super(name, crn)
    this.pkey = typeof pkey === 'string' ? new DynamoDbKey(pkey) : pkey
    if (skey) {
      this.skey = typeof skey === 'string' ? new DynamoDbKey(skey) : skey
    }
  }

  // Persistance ///////////////////////////////////////////

  public isEqual(other: AWSDynamoDbTableResource): boolean {
    return true &&
      this.name === other.name &&
      DynamoDbKey.isEqual(this.pkey, other.pkey) &&
      DynamoDbKey.isEqual(this.skey, other.skey)
  }

  public toConstructorArguments(): any[] {
    return [this.pkey, this.skey]
  }

  // Lifecycle /////////////////////////////////////////////

  public async create(): Promise<void> {
    console.info('Creating DynamoDB table:', this.name)
    const keySchema = [{ AttributeName: this.pkey.attrName, KeyType: this.pkey.keyType }]
    const attrDefs = [{ AttributeName: this.pkey.attrName, AttributeType: this.pkey.attrType }]
    if (this.skey) {
      keySchema.push({ AttributeName: this.skey.attrName, KeyType: this.skey.keyType })
      attrDefs.push({ AttributeName: this.skey.attrName, AttributeType: this.skey.attrType })
    }
    const res: AWS.DynamoDB.Types.CreateTableOutput = await getClient('DynamoDB').createTable({
      TableName : this.name,
      KeySchema: keySchema,
      AttributeDefinitions: attrDefs,
      BillingMode: 'PAY_PER_REQUEST',
    }).promise()
    if (!res.TableDescription || !res.TableDescription.TableArn) {
      throw new Error(`Error creating DynamoDB table: ${this.name}`)
    }
    this.setCRN(res.TableDescription.TableArn)
  }

  public async remove(): Promise<void> {
    console.warn(`Removing DynamoDB table: ${this.name}. All data will be lost`)
    await getClient('DynamoDB').deleteTable({ TableName: this.name }).promise()
  }

  public async update(): Promise<void> {
    console.info('Updating DynamoDB table:', this.name)
    await this.remove()
    await this.create()
  }
}

Resource.registerResourceClass(AWSDynamoDbTableResource)

export class DynamoDbKey {
  public static BINARY = 'B'
  public static NUMBER = 'N'
  public static STRING = 'S'

  public static HASH = 'HASH'
  public static RANGE = 'RANGE'

  public static isEqual(a?: DynamoDbKey, b?: DynamoDbKey) {
    if (a === undefined && b === undefined) {
      return true
    }
    if (a === undefined || b === undefined) {
      return false
    }
    return true &&
      a.attrName === b.attrName &&
      a.attrType === b.attrType &&
      a.keyType === b.keyType
  }

  constructor(
    public readonly attrName: string,
    public readonly attrType: string = DynamoDbKey.STRING,
    public readonly keyType: string = DynamoDbKey.HASH,
  ) {
    if (typeof attrName !== 'string' || !/^[a-zA-Z_][\w\-]*$/.test(attrName)) {
      throw new Error(`Invalid attribute name: ${attrName}`)
    }
    if (![DynamoDbKey.STRING, DynamoDbKey.NUMBER].includes(attrType)) {
      throw new Error(`Invalid attribute type: ${attrType}`)
    }
    if (![DynamoDbKey.HASH, DynamoDbKey.RANGE].includes(keyType)) {
      throw new Error(`Invalid key type: ${keyType}`)
    }
  }
}
