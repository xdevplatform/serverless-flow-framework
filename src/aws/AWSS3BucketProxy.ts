// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Env } from '../Environment'
import { library } from '../library'
import { Future } from '../util/Future'
import { Resource } from '../resource/Resource'
import { DependentFunc } from '../project/functions'
import { AWSResourceProxy } from './AWSResourceProxy'
import { ResourceGraph } from '../resource/ResourceGraph'
import { AWSS3BucketResource } from './AWSS3BucketResource'

export class AWSS3BucketProxy extends AWSResourceProxy {

  public createResource(graph: ResourceGraph): Resource {
    return this.setResource(graph.add(new AWSS3BucketResource(this.name)))
  }

  public get put(): DependentFunc {
    return new DependentFunc(
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
