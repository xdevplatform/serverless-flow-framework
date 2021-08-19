# Serverless Flow Framework

**The serverless data flow framework**

# Introduction

The Serverless Flow Framework (SeFF) offers a simple way to process real time data
by stringing together functions to generate, transform and store objects.
As the name suggests, the framework leverages modern serverless runtimes,
queues and databases to eliminate the complexity traditionally involved with
processing data at scale.

# Basic concepts

*TBD*

# Getting started

## Prerequisites

1. You will need to have [Node.js](https://nodejs.org/) installed.

## Installation

SeFF is freely available under the Apache 2.0 license.

1. Clone the repository from GitHub:

> [github.com/twitterdev/serverless-flow-framework](https://github.com/twitterdev/serverless-flow-framework)

1. Change into the project directory and build like so:

```
$ cd serverless-flow-framework
$ npm install
$ npm run build
```

In order to deploy code to your AWS account, you will need to set up your
credentials and region in the [AWS credentials file](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
or in your environment variables. To set up your environment, add the
following code to your `~/.zshrc` or `~/.bashrc` file (choose the right
version for your shell):

```
export AWS_ACCESS_KEY_ID='xxxxxxxxxxxxxxxxxxxx'
export AWS_SECRET_ACCESS_KEY='xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
export AWS_REGION='us-east-1'
```

Substitute the `x`s for your access key ID and secret access key downloaded
from the AWS console (Keep the `'` charactrers). Substitute the region for
the one you want to use.

## Hello, world!

The [examples](/examples) folder includes a number of sample projects that
demonstrate the basic capabilities of the framework.

As per tradition, we will start with "Hello, world!". The
[hello.js](/examples/hello.js) project deploys a single serverless function
that prints the famous greeting to the log.

Run this command to deploy the project:

```
$ ./seff deploy examples/hello.js
```

The project defines a single flow named `hello`. It is configured for
manual invocation and can be run using the following command:

```
$ ./seff run examples/hello.js hello
```

By now you should have a serverless function by the name
`seff-hello-hello-helloWorld`. Check out the logs for this function to
view the greeting.

Finally, remove the cloud resources you deployed with the command:

```
$ ./seff destroy examples/hello.js
```

## Your first data flow

Our first real data flow will be the [addition.js](/examples/addition.js)
project. This project generates two random numbers, adds them together and
prints the sum to the log.

Use the following command to deploy the project:

```
$ ./seff deploy examples/addition.js
```

The project defines a single flow named `add`. It is configured for manual
invocation and can be run using the following command:

```
$ ./seff run examples/addition.js add
```

This will trigger an execution chain starting with the first function that
generates two random numbers, followed by the second function that adds them
together and ends with the third function which prints the sum to the log. Of
course, in a real world example we wouldn't use separate functions for such
granular computations.

The printed numbers can be viewed in log for the serverless function
`seff-addition-add-printNumber`. If you are using AWS, check your
[CloudWatch logs](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html)
under the stream for the Lambda function with this name.

At this point you may want to look at the file `addition.state.json` which
holds the state of your project. **DO NOT DELETE THIS FILE**, as the
framework will lose track of the resources it deployed to the cloud
will not be able to update or destroy your project.

The state file and (almost) all resources deployed to the cloud can be
removed by running

```
$ ./seff destroy examples/addition.js
```

The only resources not removed by this command are cloud logs, the
execution role created for serverless functions and object store buckets
(objects in these bucket are, however, removed).

## Using library functions

The [random.js](/examples/random.js) project shows a data flow that uses a
library function to generate random numbers. Library functions are very useful
to shorten your code and speed up the building of new projects.

> **WHILE IN ALPHA** library functions are not publically available yet. You
> will need to set up an S3 bucket for library functions and configure the
> environment variable `SEFF_FUNCTION_LIBRARY_BASEURL` to point to the
> bucket using a URL in the form `s3://<bucket>`. Run the following commands
> to deploy the library functions to your bucket:
>
> ```
> $ ./seff upload -j library/aws/dynamodbWrite
> $ ./seff upload -j library/aws/rdsInsert
> $ ./seff upload -j library/aws/s3Put
> $ ./seff upload -c -j library/ibm/watsonNluAnalyze
> $ ./seff upload -c -j library/std/countInvocations
> $ ./seff upload -c -j library/std/generateRandomNumber
> $ ./seff upload -c -j library/std/printEvent
> $ ./seff upload -c -j library/twitter/pollTweetsWithQuery
> ```

Deploy the project using

```
$ ./seff deploy examples/random.js
```

and run using

```
$ ./seff run examples/random.js random
```

This should print out a single number between 0 and 100 to the log. Do not
destroy the project just yet.

## Updating your code

Make a simple change to [random.js](/examples/random.js). For example, change
the multiplier in the second fucntion `multiplyNumber` to a different number.

Deploy again using the same command used for the initial deployment:

```
$ ./seff deploy examples/random.js
```

You will notice that only the changes were redeployed. SeFF tracks the
state of your project in the cloud (see `random.state.json`). This
allows the framework to detect changes you make to your code and only deploy
the differences to the cloud.

*This makes deployments lightning fast and enables using the cloud with all
its services and scale as your development environment.*

We wrap up by deleting our state and cloud resources:

```
$ ./seff destroy examples/random.js
```

## Persisting data

SeFF makes it easy to persist data. The
[dynamodb.js](/examples/dynamodb.js) project generates random message
objects, runs a simple transformation to add a timestamp to each message
and stores the objects in a database table.

Since databases vary in their features and APIs, this example, as well as
the library functions used to define tables and persist data, are specific
to one database. This example is designed for
[AWS DynamoDB](https://aws.amazon.com/dynamodb/).

This project showcases three important aspects of the framework:

* **Resources** like a DynamoDB table, which are created automatically when
the project is deployed and deleted (along with the data!) when the project
is destroyed.

* **Arrays** in function input and output streams are automatically unpacked
so that function code can focus on the transformation logic instead of dealing
with data management. In order to pass an actual array to a function, pass it
as an attribute value in an object.

* **Resource functions** are library functions referenced by resources
to provide easier access to related functions. In this project we use
`messages.write` to reference the `dynamodbWrite` library fucntion and
write data to our specific table.

You can run this project using the same `deploy`, `run` and `destroy`
commands we used above. Make sure to deploy the `dynamodbWrite` library
function to S3 before attempting to deploy this project, as shown above.

## More examples

* **[numbers.js](/examples/numbers.js)** features a library functions that
persists state between invocations.

* **[rds.js](/examples/rds.js)** load data records into a SQL table.

* **[s3.js](/examples/s3.js)** loads data into objects in an AWS S3 bucket.

* **[state.js](/examples/state.js)** demonstrates how functions can persist
state between invocations.

* **[twitter2dynamodb.js](/examples/twitter2dynamodb.js)** loads Tweets into
a dynamoDB table.

# Contact us

## Issues?

*TBD*

## Security Issues?

Please report sensitive security issues via Twitter's bug-bounty program (https://hackerone.com/twitter) rather than GitHub.
