// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

// Create API endpoints.
//
seff

  .GET('/ping',
    function pingGetHandler() {
      return 'pong'
    }
  )

  .POST('/ping',
    function pingPostHandler() {
      return 'POST response'
    }
  )
