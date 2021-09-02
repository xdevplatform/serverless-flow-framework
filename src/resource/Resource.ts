// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

// Resource is the local representation of a single resource in
// the cloud. A cloud resource can be a database table, a storage
// bucket, a serverless function, or a logical component within a
// larger construct like an API method or a link in an invocation
// chain between lambda function.
//
// The lifecycle of resources starts with initialization, where
// the resource name, configuration and relationship with parent
// resources and dependecies are set. When the resource is
// createted, it is assign the name of the corresponding Cloud
// Resource Name (CRN) which is issues by the cloud provider. The
// resource can then be updated with new configuration or removed.
// Updates and removals are synced to the corresponding cloud
// resource.
//
// Resource data can be serialized and deserialized so that its
// state and configuration can be persisted and tracked over
// time.
//
export abstract class Resource {
  private _parent?: Resource
  public readonly dependencies: Record<string, Resource> = {}

  constructor(public readonly name: string, private _crn?: string) {
    Resource.validateName(name)
    Resource.validateMaybeCRN(_crn)
  }

  // Get the Cloud Resource Name (CRN) for this resource. Once
  // this resource has been created in the cloud, this value
  // represents the unique name of the cloud resource issued
  // by the cloud provider. For example, in AWS this would be
  // the ARN of the AWS resource corresponding to this resource.
  //
  public get crn(): string | undefined {
    return this._crn
  }

  // Get the parent resource. Parent resource represent resources
  // which encapsulate othre resource. The parent must be created
  // before this resource can be created. When the parent is
  // removed, this resource is automatically removed as well. For
  // example, AWS Lambda Destination resources would have AWS
  // Lambda resources as parents.
  //
  public get parent(): Resource | undefined {
    return this._parent
  }

  // Get resource class name.
  //
  public get className(): string {
    return this.constructor.name
  }

  // Get a unique identifier for this resource. There can be
  // only one resource with any given name per resource class.
  //
  public get uid(): string {
    return `uid:${this.className}:${this.name}`
  }

  // Add a reference to another resource that this resource
  // depends on. For example, an AWS API Gateway method that
  // integrates into a Lambda function is dependent on the
  // resource representing this Lambda function.
  //
  // Dependencies affect the order and actions taken when a
  // resource is removed. In the exampe above, if an API
  // Gateway method resource is removed, the permissions
  // on the Lambda function need to be updated as well.
  //
  public addDependency(tag: string, resource: Resource): void {
    Resource.validateTag(tag)
    if (tag in this.dependencies) {
      throw new Error(`Duplicate dependency for resource ${this.name}: ${tag}`)
    }
    this.dependencies[tag] = resource
  }

  // Set CRN. Called when the corresponding could resource is
  // created or to copy CRN from previous state.
  //
  public setCRN(crn: string) {
    this._crn = Resource.validateCRN(crn)
  }

  // Set a parent resource for this resource. See parent()
  // above for a more detailed exmplanation on parent resources.
  //
  public setParent(resource: Resource): void {
    if (this._parent) {
      throw new Error(`Parent already set for resource: ${this.name}`)
    }
    this._parent = resource
  }

  // Persistance ///////////////////////////////////////////

  // Compare to another resource of the same class.
  //
  public abstract isEqual(other: any): boolean

  // Serialize resource specific variables, so that a resource
  // can be recostructed in the future. The array returned by
  // this method is used as arguments in a future call to the
  // resource class's constructor. They will follow the standard
  // 'name' and 'crn' arguments common to all resource classes.
  //
  public abstract toConstructorArguments(): any[]

  // Create a serialized representation of this resource. This
  // representation can be saved in persistent storage to track
  // the state of cloud resources.
  //
  public serialize(): any {
    return {
      name: this.name,
      crn: this.crn,
      args: this.toConstructorArguments().map(arg => arg instanceof Resource ? arg.uid : arg),
      deps: Object.fromEntries(Object.entries(this.dependencies).map(
        ([tag, resource]) => [tag, resource.uid]
      )),
      parent: this._parent && this._parent.uid,
    }
  }

  // Lifecycle /////////////////////////////////////////////

  // Create a new cloud resource corresponding to this resource.
  // This method is responsible for updating the 'crn' field
  // with the unique Cloud Resource Name returned from the
  // cloud provider.
  //
  public abstract create(): Promise<void>

  // Update the configuration of the corresponding resource based
  // on changes to resources that this resource dependes on.
  //
  public async dependenciesChanged(): Promise<void> {
  }

  // Removal process has been finalized: clear the CRN. This
  // is implemented as separate method because some cloud
  // resources (specifcally those with parent resources) are
  // removed automatically by the cloud provider, and so we
  // never call their "remove" method.
  //
  public hasBeenRemoved(): void {
    this._crn = undefined
  }

  // Remove the cloud resource corresponding to this resource
  // from the cloud.
  //
  public abstract remove(): Promise<void>

  // Update the configuration of the corresponding resource in
  // the cloud to the state of this resource. The previous state,
  // representing the state currently configured in the cloud,
  // is passed in the "from" argument.
  //
  public abstract update(from: Resource): Promise<void>

  // Remove configureation from dependent resources. This method
  // is called before this resource is removed, in case the
  // dependent resource is not removed itself. It allows this
  // resource to delete configuration on the dependent resource.
  //
  // For example, AWS API gateway methods that integrate with
  // Lambda need to enable invocation permissions on target Lambda
  // functions. When a method is removed but the integrated
  // function persists, this method is used to delete those
  // invocation permissions from the Lambda function.
  //
  // Because this is a rare situsation, we provide a default
  // implementation here to avoid having to implement this method
  // in every resource.
  //
  public async removeConfigurationFromDependency(dep: Resource): Promise<void> {
  }

  // Static ////////////////////////////////////////////////

  private static readonly classes: Record<string, any> = {}

  // Deserialize a resource from a given data object created
  // by the method "serialize" above. The class and name of
  // the new resource are determined by the provided UID.
  // The actual classes are resovled against registered classes
  // (see registerResourceClass blow) before resource objects
  // are constructed.
  //
  // During construction, parent and dependent resources are
  // resolved against the specified resource pool.
  //
  public static deserialize(
    uid: string,
    data: any,
    pool: ResourcePool,
  ): Resource {
    if (typeof uid !== 'string') {
      throw new Error(`Invalid resource identifier: ${uid}`)
    }
    const match = uid.match(/^uid:([a-zA-Z_]\w*):([a-zA-Z_][\w\-]*)$/)
    if (!match) {
      throw new Error(`Malformed identifier: ${uid}`)
    }
    const clas: any = Resource.classes[match[1]]
    if (!clas) {
      throw new Error(`Resource class not found: ${match[1]}`)
    }
    if (typeof data !== 'object') {
      throw new Error(`Serialized data is not an object: ${data}`)
    }
    Resource.validateName(data.name)
    if (data.name !== match[2]) {
      throw new Error(`Serialized UID mismatches resource name: ${data.name}`)
    }
    Resource.validateMaybeCRN(data.crn)
    if (!Array.isArray(data.args)) {
      throw new Error(`Invalid serialized arguments: ${data.args}`)
    }
    const args = data.args.map(
      (arg: any) => Resource.isUID(arg) ? pool.getResourceByUID(arg) : arg
    )
    const resource = new clas(data.name, data.crn, ...args)
    if (typeof data.deps !== 'object') {
      console.log(`Invalid serialized dependencies: ${data.deps}`)
    }
    if (data.parent) {
      const uid = Resource.validateUID(data.parent as any)
      resource.setParent(pool.getResourceByUID(uid))
    }
    for (const [tag, _uid] of Object.entries(data.deps)) {
      Resource.validateTag(tag)
      const uid = Resource.validateUID(_uid as any)
      resource.addDependency(tag, pool.getResourceByUID(uid))
    }
    return resource
  }

  // Classes represeting resource need to call this function
  // so that their resources can be created during deserialization.
  //
  public static registerResourceClass(clas: any): void {
    if (typeof clas !== 'function' || typeof clas.deserialize !== 'function') {
      throw new Error(`Invalid resource class: ${clas}`)
    }
    if (Resource.classes[clas.name]) {
      throw new Error(`Duplicate resource class: ${clas}`)
    }
    Resource.classes[clas.name] = clas
  }

  // Validate string formats

  public static validateCRN(crn: string): string {
    if (typeof crn !== 'string' || crn.length === 0 || /\s/.test(crn)) {
      throw new Error(`Invalid cloud resource name: ${crn}`)
    }
    return crn
  }

  public static validateMaybeCRN(crn?: string): string | undefined {
    return crn === undefined ? undefined : Resource.validateCRN(crn)
  }

  public static validateName(name: string): string {
    if (typeof name !== 'string' || !/^[a-zA-Z_][\w\-]*$/.test(name)) {
      throw new Error(`Invalid resource name: ${name}`)
    }
    return name
  }

  public static validateTag(tag: string): string {
    if (typeof tag !== 'string' || !/^[a-zA-Z_][\w\-]*$/.test(tag)) {
      throw new Error(`Invalid resource depedency tag: ${tag}`)
    }
    return tag
  }

  public static isUID(maybeUID: string): boolean {
    return typeof maybeUID === 'string' && /^uid:([a-zA-Z_]\w*):[a-zA-Z_][\w\-]*$/.test(maybeUID)
  }

  public static validateUID(uid: string): string {
    if (!Resource.isUID(uid)) {
      throw new Error(`Invalid resource UID: ${uid}`)
    }
    return uid
  }
}

export abstract class ResourcePool {
  public abstract getResourceByUID(uid: string): Resource
}
