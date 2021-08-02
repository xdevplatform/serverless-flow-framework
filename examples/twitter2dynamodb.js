// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

// Create a new DynamoDB table to store Tweets by id.
//
tweets = sff.aws.DynamoDB({ pkey: 'id' })

// Create a data flow named "go". This flow loads Tweets
// from the Twitter API and stores them in DynamoDB. The
// first invocation grabs the last 100 Tweets. Every
// subsequest invocation grabs the Tweets generated since
// the last invocation.
//
// In order to access the Twitter API you need to
//  1. Set up a developer account at developer.twitter.com
//  2. Create a V2 project and app
//  3. Generate a bearer token for your app
//  4. Store the token in the TWITTER_BEARER environment
//     variable
//
// You can run this flow from the root folder (..) by
// running the command:
//
//   ./sff run examples/twitter2dynamodb.js go
//
go = sff

  // This function tells the Twitter poller function which
  // query to run. It emits the following info:
  //  name - a name for this query (can be used later to
  //         track responses if you're running multiple
  //         queries)
  //  query - Twitter search query, as described in
  //          https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/build-a-query
  //  fields - desired info for each Tweet, as described in
  //           https://developer.twitter.com/en/docs/twitter-api/data-dictionary/object-model/tweet
  //
  .then(
    function twitterQuery() {
      return {
        name: 'serverless',
        query: 'serverless',
        fields: ['id', 'text', 'created_at'],
      }
    }
  )

  // Use a library function to poll the Twitter API for
  // Tweets. The function required an API token which
  // can be obtained as explained above.
  //
  .then(
    sff.lib.twitter.pollTweetsWithQuery,
    { TWITTER_BEARER: sff.env.TWITTER_BEARER }
  )

  // Store in the Tweets table.
  //
  .then(
    tweets.write
  )
