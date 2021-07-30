// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Env } from '../Environment'
import { library } from '../library'
import { Future } from '../util/Future'
import { DepFunc } from '../project/Flow'
import { Resource } from '../resource/Resource'
import { AWSResourceProxy } from './AWSResourceProxy'
import { ResourceGraph } from '../resource/ResourceGraph'
import { AWSS3BucketResource } from './AWSS3BucketResource'

export class AWSS3BucketProxy extends AWSResourceProxy {

  public createResource(graph: ResourceGraph): Resource {
    return this.setResource(graph.add(new AWSS3BucketResource(this.name)))
  }

  public get put(): DepFunc {
    return new DepFunc(
      library.aws.s3Put.derive(
        new Future<Env>(
          () => ({
            S3_BUCKET_NAME: this.name,
          })
        )
      ),
      new Future<Resource>(() => this.resource),
    )
  }
}

AWSResourceProxy.registerResourceClass('S3', AWSS3BucketProxy)
