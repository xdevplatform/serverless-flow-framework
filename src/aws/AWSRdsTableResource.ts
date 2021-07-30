// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getClient } from './aws'
import { Resource } from '../resource/Resource'
import { AWSRdsDatabaseResource } from './AWSRdsDatabaseResource'

const SQL_TYPES: Record<string, { counters: number, family: string }> = {
  BIGINT: { counters: 0, family: 'numeric' },
  INT8: { counters: 0, family: 'numeric' },
  BIGSERIAL: { counters: 0, family: 'numeric' },
  SERIAL8: { counters: 0, family: 'numeric' },
  BIT: { counters: 1, family: 'numeric' },
  'BIT VARYING': { counters: 1, family: 'numeric' },
  VARBIT: { counters: 0, family: 'numeric' },
  BOOLEAN: { counters: 0, family: 'textual' },
  BOOL: { counters: 0, family: 'textual' },
  BOX: { counters: 0, family: 'textual' },
  BYTEA: { counters: 0, family: 'textual' },
  'CHARACTER VARYING': { counters: 1, family: 'textual' },
  VARCHAR: { counters: 1, family: 'textual' },
  CHARACTER: { counters: 1, family: 'textual' },
  CHAR: { counters: 1, family: 'textual' },
  CIDR: { counters: 0, family: 'textual' },
  CIRCLE: { counters: 0, family: 'textual' },
  DATE: { counters: 0, family: 'textual' },
  'DOUBLE PRECISION': { counters: 0, family: 'numeric' },
  FLOAT8: { counters: 0, family: 'numeric' },
  INET: { counters: 0, family: 'textual' },
  INTEGER: { counters: 0, family: 'numeric' },
  INT: { counters: 0, family: 'numeric' },
  INT4: { counters: 0, family: 'numeric' },
  INTERVAL: { counters: 1, family: 'numeric' },
  LINE: { counters: 0, family: 'textual' },
  LSEG: { counters: 0, family: 'textual' },
  MACADDR: { counters: 0, family: 'textual' },
  MONEY: { counters: 0, family: 'textual' },
  NUMERIC: { counters: 2, family: 'numeric' },
  DECIMAL: { counters: 2, family: 'numeric' },
  PATH: { counters: 0, family: 'textual' },
  POINT: { counters: 0, family: 'textual' },
  POLYGON: { counters: 0, family: 'textual' },
  REAL: { counters: 0, family: 'numeric' },
  FLOAT4: { counters: 0, family: 'numeric' },
  SMALLINT: { counters: 0, family: 'numeric' },
  INT2: { counters: 0, family: 'numeric' },
  SERIAL: { counters: 0, family: 'textual' },
  SERIAL4: { counters: 0, family: 'textual' },
  TEXT: { counters: 0, family: 'textual' },
  TIME: { counters: 1, family: 'textual' }, // WITH/OUT TIME ZONE
  TIMETZ: { counters: 0, family: 'textual' },
  TIMESTAMP: { counters: 1, family: 'textual' }, // WITH/OUT TIME ZONE
  TIMESTAMPTZ: { counters: 0, family: 'textual' },
  TSQUERY: { counters: 0, family: 'textual' },
  TSVECTOR: { counters: 0, family: 'textual' },
  TXID_SNAPSHOT: { counters: 0, family: 'textual' },
  UUID: { counters: 0, family: 'textual' },
  XML: { counters: 0, family: 'textual' },
}

export class SQLColumn {
  public readonly family: string
  public readonly required: boolean

  constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly n1?: number,
    public readonly n2?: number,
    public readonly constraint?: string,
  ) {
    if (!/^\w+$/.test(name)) {
      throw new Error(`Invalid SQL column name: ${name}`)
    }
    if (!(type in SQL_TYPES)) {
      throw new Error(`Invalid SQL column type: ${type}`)
    }
    if (SQL_TYPES[type].counters !== (n1 === undefined ? 0 : n2 === undefined ? 1 : 2)) {
      throw new Error(`Invalid counters for SQL type: ${type}`)
    }
    this.family = SQL_TYPES[type].family
    this.required = constraint &&
      (constraint.includes('PRIMARY KEY') || constraint.includes('NOT NULL')) ? true : false
  }

  public toString(): string {
    return `${this.name} ${this.type}${
      this.n1 ? `(${this.n1}${this.n2 ? `,${this.n2}` : ''})` : ''}${
      this.constraint ? ` ${this.constraint}` : ''}`
  }

  public static fromString(str: string): SQLColumn {
    const match = str.match(
      /^(\w+)\s+([a-z]*\d?)(\(\s*(\d+)(\s*,\s*(\d+))?\s*\))?\s*(\w+(\s*\w+)*)?$/i
    )
    if (!match) {
      throw new Error(`Invalid SQL column: ${str}`)
    }
    return new SQLColumn(
      match[1],
      match[2].toUpperCase(),
      match[4] ? parseInt(match[4]) : undefined,
      match[6] ? parseInt(match[6]) : undefined,
      match[7] && match[7].toUpperCase(),
    )
  }
}

export class AWSRdsTableResource extends Resource {
  private _database?: AWSRdsDatabaseResource
  public readonly columns: SQLColumn[]

  constructor(name: string, crn: string | undefined, columnData: any) {
    super(name, crn)
    this.columns = this.parseColumns(columnData)
  }

  private get database(): AWSRdsDatabaseResource {
    if (!this._database) {
      this._database = this.dependencies['database'] as AWSRdsDatabaseResource
      if (!this._database) {
        throw new Error(`Missing database dependency for RDS table: ${this.name}`)
      }
    }
    return this._database
  }

  // Persistance ///////////////////////////////////////////

  public isEqual(other: AWSRdsTableResource): boolean {
    return this.columns === other.columns
  }

  public toConstructorArguments(): any[] {
    return [this.columns]
  }

  // Lifecycle /////////////////////////////////////////////

  public async create(): Promise<void> {
    console.info('Creating RDS table:', this.name)
    await this.sql(`CREATE TABLE ${this.name} (${this.columns})`)
    this.setCRN(this.name)
  }

  public async remove(): Promise<void> {
    console.info('Removing RDS table:', this.name)
    await this.sql(`DROP TABLE ${this.name}`)
  }

  public async update(): Promise<void> {
    console.info(`Updating RDS databletabase: ${this.name}`)
    throw new Error('Not implemented')
  }

  private async sql(query: string): Promise<void> {
    await getClient('RDSDataService').executeStatement({
      database: this.database.name,
      resourceArn: this.database.getClusterARN(),
      secretArn: this.database.getSecretARN(),
      sql: query + ';',
    }).promise()
  }

  // Column parser /////////////////////////////////////////

  private parseColumns(data: any): SQLColumn[] {
    let str: string
    if (typeof data === 'string') {
      str = data
    } else if (typeof data === 'object' && data !== null && typeof data.columns === 'string') {
      str = data.columns
    } else if (Array.isArray(data)) {
      return data
    } else {
      throw new Error(`Invalid columns for SQL table ${this.name}: ${data}`)
    }

    const columns = str.split(/,?\s*\n/g).map(s => s.trim()).filter(s => 0 < s.length)
    if (columns.length === 0) {
      throw new Error(`No columns for SQL table ${this.name}: ${data}`)
    }

    return columns.map(SQLColumn.fromString)
  }
}

Resource.registerResourceClass(AWSRdsTableResource)
