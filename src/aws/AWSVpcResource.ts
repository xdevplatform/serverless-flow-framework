// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import AWS from 'aws-sdk'
import { getClient } from './aws'
import { Resource } from '../resource/Resource'

const CIDR_HEADER = '172.30'

export class AWSVpcResource extends Resource {

  constructor(name: string, crn?: string, private subnetIds?: string[]) {
    super(name, crn)
  }

  public getSubnetIds(): string[] {
    if (!this.subnetIds) {
      throw new Error(`VPC has no subnets: ${this.name}`)
    }
    return this.subnetIds
  }

  // Persistance ///////////////////////////////////////////

  public isEqual(other: AWSVpcResource): boolean {
    return true
  }

  public toConstructorArguments(): any[] {
    return [this.subnetIds]
  }

  // Lifecycle /////////////////////////////////////////////

  public async create(): Promise<void> {
    console.info('Creating VPC:', this.name)
    const ec2 = getClient('EC2')

    const vpc: AWS.EC2.Vpc =
      (await ec2.createVpc({ CidrBlock: `${CIDR_HEADER}.0.0/16` }).promise())
      .Vpc
    if (!vpc) {
      throw new Error(`Error creating VPC: ${this.name}`)
    }

    const subnets = []
    try {
      const availabilityZones =
        (await ec2.describeAvailabilityZones({}).promise())
        .AvailabilityZones
      for (let i = 0; i < availabilityZones.length; i++) {
        const subnet =
          (await ec2.createSubnet({
            VpcId: vpc.VpcId,
            CidrBlock: `${CIDR_HEADER}.${i}.0/24`,
            AvailabilityZone: availabilityZones[i].ZoneName,
          }).promise())
          .Subnet
        if (!subnet) {
          throw new Error(`Error creating subnet ${availabilityZones[i]} for VPC: ${this.name}`)
        }
        subnets.push(subnet)
      }
    } catch (e) {
      console.info(`Error creating VPC ${this.name}: cleaning up`)
      for (const subnet of subnets) {
        try {
          await ec2.deleteSubnet({ SubnetId: subnet.SubnetId }).promise()
        } catch (e) {
          console.error(
            `Error deleting subnet ${subnet.SubnetId} for VPC ${this.name}: ${e.message}`
          )
        }
      }
      try {
        await ec2.deleteVpc({ VpcId: vpc.VpcId }).promise()
      } catch (e) {
        console.error(`Error deleting VPC ${vpc.VpcId} (${this.name}): ${e.message}`)
      }
      throw e
    }

    this.subnetIds = subnets.map((sn: AWS.EC2.Subnet) => sn.SubnetId!)
    this.setCRN(vpc.VpcId!)
  }

  public async remove(): Promise<void> {
    console.info('Removing VPC:', this.name)
    const ec2 = getClient('EC2')
    if (!this.subnetIds) {
      throw new Error(`No subnets for VPC: ${this.name}`)
    }
    for (const subnetId of this.subnetIds) {
      await ec2.deleteSubnet({ SubnetId: subnetId }).promise()
    }
    await ec2.deleteVpc({ VpcId: this.crn }).promise()
  }

  public async update(): Promise<void> {
    console.info(`Updating VPC: ${this.name} (nothing to do)`)
  }
}

Resource.registerResourceClass(AWSVpcResource)
