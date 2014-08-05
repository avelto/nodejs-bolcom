/*
Name:             bolcom.js
Description:      Module for node.js to access Bol.com Open API service.
Author:           Franklin van de Meent (https://frankl.in)
Source:           https://github.com/fvdm/nodejs-bolcom
Bugs & feedback:  https://github.com/fvdm/nodejs-bolcom/issues
License:          Unlicense / Public Domain

Service name:     Bol.com
Service docs:     https://developers.bol.com
*/

var https = require('https')
var querystring = require('querystring')
var api_key = null
var api_timeout = 5000

var app = {
  catalog: {},
  utils: {},
  account: {}
}

// Communicate
function talk( cat, method, params, callback ) {
  if( typeof params === 'function' ) {
    var callback = params
    var params = {}
  }
  params = params instanceof Object ? params : {}

  // check api key
  if( typeof api_key === 'string' && api_key.length > 0 ) {
    params.apikey = api_key
  } else {
    doCallback( new Error('missing apikey') )
    return
  }

  // prevent multiple callbacks
  var complete = false
  function doCallback( err, data ) {
    if( !complete ) {
      complete = true
      callback( err, data || null )
    }
  }

  // build request
  params.format = 'json'
  
  var options = {
    host: 'api.bol.com',
    path: '/'+ cat +'/v4/'+ method +'?'+ querystring.stringify(params),
    method: 'GET',
    headers: {
      'User-Agent': 'bolcom.js (https://frankl.in)'
    }
  }

  var request = https.request(options)

  // process response
  request.on( 'response', function(response) {
    var data = ''

    response.on( 'data', function(ch) { data += ch })

    response.on( 'close', function() {
      doCallback(new Error('request dropped'))
    })

    response.on( 'end', function() {
      var error = null
      if( response.statusCode != 200 ) {
        error = new Error('API error')
      }

      try {
        data = JSON.parse( data )
      } catch(e) {
        error = new Error('invalid response')
        error.err = e
      }
      
      if( error ) {
        error.code = response.statusCode
        error.headers = response.headers
        error.api = data instanceof Object ? data : {}
        error.body = data instanceof Object ? null : data
      }

      doCallback( error, data )
    })
  })

  // timeout
  request.on( 'socket', function( socket ) {
    if( api_timeout ) {
      socket.setTimeout( api_timeout )
      socket.on( 'timeout', function() {
        request.abort()
      })
    }
  })

  // error
  request.on( 'error', function( err ) {
    if( err == 'ECONNRESET' ) {
      var error = new Error('request timeout')
    } else {
      var error = new Error('request failed')
    }
    error.err = err
    doCallback( error )
  })
  
  // do it
  request.end()
}

module.exports = function(apikey, timeout) {
  api_key = apikey
  api_timeout = timeout || api_timeout
  return app
}