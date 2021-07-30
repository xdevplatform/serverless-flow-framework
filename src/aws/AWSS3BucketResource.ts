// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import AWS from 'aws-sdk'
import { getClient } from './aws'
import { Resource } from '../resource/Resource'

export class AWSS3BucketResource extends Resource {

  // Persistance ///////////////////////////////////////////

  public isEqual(other: AWSS3BucketResource): boolean {
    return true
  }

  public toConstructorArguments(): any[] {
    return []
  }

  // Lifecycle /////////////////////////////////////////////

  public async create(): Promise<void> {
    console.info('Creating S3 bucket:', this.name)
    const res: AWS.S3.Types.CreateBucketOutput = await getClient('S3').createBucket({
      Bucket: this.name,
      ...(AWS.config.region === 'us-east-1' ? {} : {
        CreateBucketConfiguration: {
          LocationConstraint: AWS.config.region,
        },
      }),
    }).promise()
    this.setCRN(`arn:aws:s3:::${this.name}`)
  }

  public async remove(): Promise<void> {
    console.info('Removing S3 bucket:', this.name)
    console.warn('Deleting all objects but keeping bucket to avoid name reuse issues')

    const keys: { Key: string }[] = []
    let continuationToken
    while (true) {
      const res: AWS.S3.Types.ListObjectsV2Output = await getClient('S3').listObjectsV2({
        Bucket: this.name,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
      }).promise()
      if (res.Contents) {
        keys.push(...res.Contents.map((object: AWS.S3.Object) => ({ Key: object.Key! })))
      }
      continuationToken = res.NextContinuationToken
      if (!continuationToken) {
        break
      }
    }

    while (0 < keys.length) {
      await getClient('S3').deleteObjects({
        Bucket: this.name,
        Delete: { Objects: keys.splice(0, 1000) },
      }).promise()
    }
  }

  public async update(): Promise<void> {
    console.info(`Updating S3 bucket: ${this.name} (nothing to do)`)
  }
}

Resource.registerResourceClass(AWSS3BucketResource)
