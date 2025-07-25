const express = require("express")
const stream = express.Router()

require('dotenv').config()//process.env.var

const rtveAPI = require('./rtve.js')

/**
 * Tipical express middleware callback.
 * @callback subRequestMiddleware
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response
 * @param {function} [next] - The next middleware function in the chain, should end the response at some point
 */
/** 
 * Handles requests to /stream that contain extra parameters, we should append them to the request for future middleware, see {@link SearchParamsRegex} to see how these are handled
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response, we don't end it because this function/middleware doesn't handle the full request!
 * @param {subRequestMiddleware} next - REQUIRED: The next middleware function in the chain, should end the response at some point
 */
function HandleLongStreamRequest(req, res, next) {
  console.log(`\x1b[96mEntered HandleLongStreamRequest with\x1b[39m ${req.originalUrl}`)
  res.locals.extraParams = SearchParamsRegex(req.params[0])
  next()
}
/** 
 * Handles requests to /stream whether they contain extra parameters (see {@link HandleLongSubRequest} for details on this) or just the type and videoID.
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response, note we use next() just in case we need to add middleware, but the response is handled by sending an empty stream Object.
 * @param {subRequestMiddleware} [next] - The next middleware function in the chain, can be empty because we already responded with this middleware
 */
function HandleStreamRequest(req, res, next) {
  console.log(`\x1b[96mEntered HandleStreamRequest with\x1b[39m ${req.originalUrl}`)
  const idDetails = req.params.videoId.split(':')
  const videoID = idDetails[0]
  if (videoID === "tve") {
    rtveAPI.GetChannelStreams(idDetails[1]).then((result) => {
      console.log('\x1b[36mGot\x1b[39m', result.length, "streams for", idDetails[1])
      res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200");
      res.json({ streams: result, message: "Got streams!" });
      next()
    }).catch((err) => {
      console.error('\x1b[31mFailed on channel searh because:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.json({ streams: [], message: "Failed getting tve info" });
        next()
      }
    })
  } else if (videoID === "rne") {
    rtveAPI.GetRadioStreams(idDetails[1]).then((result) => {
      console.log('\x1b[36mGot\x1b[39m', result.length, "streams for", idDetails[1])
      res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200");
      res.json({ streams: result, message: "Got streams!" });
      next()
    }).catch((err) => {
      console.error('\x1b[31mFailed on radio searh because:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.json({ streams: [], message: "Failed getting re info" });
        next()
      }
    })
  } else {
    res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200");
    res.json({ streams: [], message: "Wrong idPreffix" });
    next()
  }
}
/** 
 * Parses the extra config parameter we can get when the addon is configured
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response, note we use next() just in case we need to add middleware
 * @param {subRequestMiddleware} [next] - The next middleware function in the chain
 */
function ParseConfig(req, res, next) {
  console.log(`\x1b[96mEntered ParseConfig with\x1b[39m ${req.originalUrl}`)
  res.locals.config = new URLSearchParams(decodeURIComponent(req.params.config))
  console.log('Config parameters:', res.locals.config)
  next()
}
//Configured requests
stream.get("/:config/stream/:type/:videoId/*.json", ParseConfig, HandleLongStreamRequest, HandleStreamRequest)
stream.get("/:config/stream/:type/:videoId.json", ParseConfig, HandleStreamRequest)
//Unconfigured requests
stream.get("/stream/:type/:videoId/*.json", HandleLongStreamRequest, HandleStreamRequest)
stream.get("/stream/:type/:videoId.json", HandleStreamRequest)
/** 
 * Parses the capture group corresponding to URL parameters that stremio might send with its request. Tipical extra info is a dot separated title, the video hash or even file size
 * @param {string} extraParams - The string captured by express in req.params[0] in route {@link stream.get("/:type/:videoId/*.json", HandleLongSubRequest, HandleSubRequest)}
 * @return {Object} Empty if we passed undefined, populated with key/value pairs corresponding to parameters otherwise
 */
function SearchParamsRegex(extraParams) {
  //console.log(`\x1b[33mfull extra params were:\x1b[39m ${extraParams}`)
  if (extraParams !== undefined) {
    const paramMap = new Map()
    const keyVals = extraParams.split('&');
    for (let keyVal of keyVals) {
      const keyValArr = keyVal.split('=')
      const param = keyValArr[0]; const val = keyValArr[1];
      paramMap.set(param, val)
    }
    const paramJSON = Object.fromEntries(paramMap)
    //console.log(paramJSON)
    return paramJSON
  } else return {}
}

module.exports = stream;