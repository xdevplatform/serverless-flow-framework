// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

interface State {
  prev: any
  next?: any
}

type EventHandler = (event: any) => any

type StatefulEventHandler = (event: any, state: any) => Promise<any>

export function stateWrapper(func: StatefulEventHandler): EventHandler {
  if (!process.env.SFF_STATE_TABLE_NAME) {
    throw new Error('Missing environment variable: SFF_STATE_TABLE_NAME')
  }
  if (!process.env.SFF_FULL_NAME) {
    throw new Error('Missing environment variable: SFF_FULL_NAME')
  }

  const AWS = require('aws-sdk')
  const dynamodb = new AWS.DynamoDB()

  function obj2str(obj: any): string {
    const type = typeof obj
    if (type === 'boolean' || type === 'number') {
      return String(obj)
    }
    if (type === 'string') {
      return `"${obj.replace(/\"/g, '\\"')}"`
    }
    if (obj === null) {
      return 'null'
    }
    if (obj === undefined) {
      return 'undefined'
    }
    if (Array.isArray(obj)) {
      return `[${obj.map(e => obj2str(e)).join(',')}]`
    }
    if (type === 'object') {
      return `{${
        Object
          .keys(obj)
          .sort()
          .map(key => `${key}:${obj2str(obj[key])}`)
          .join(',')
      }}`
    }
    throw new Error(`Cannot stringify: ${obj}`)
  }

  function objeq(obj1: any, obj2: any): boolean {
    return obj2str(obj1) === obj2str(obj2)
  }

  function mkitem(state?: any): any {
    return {
      TableName: process.env.SFF_STATE_TABLE_NAME,
      [state ? 'Item' : 'Key']: {
        functionName: { S: process.env.SFF_FULL_NAME },
        ...(state ? { state: { S: JSON.stringify(state.next) } } : {}),
      },
    }
  }

  return async function(event: any): Promise<any> {
    const prev = await dynamodb.getItem(mkitem()).promise()
    const json = prev.Item && prev.Item.state.S
    const state: State = { prev: json && JSON.parse(json) }

    const res = await func(event, state)

    if (state.next !== undefined && !objeq(state.next, json && JSON.parse(json))) {
      await dynamodb.putItem(mkitem(state)).promise()
    }
    if (state.next === undefined && json !== undefined) {
      await dynamodb.deleteItem(mkitem()).promise()
    }

    return res
  }
}
