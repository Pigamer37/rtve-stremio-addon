const express = require("express")
const metas = express.Router()

require('dotenv').config()//process.env.var

const tveAPI = require('./tve.js')

/**
 * Tipical express middleware callback.
 * @callback subRequestMiddleware
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response
 * @param {function} [next] - The next middleware function in the chain, should end the response at some point
 */
/** 
 * Handles requests to /stream whether they contain extra parameters (see {@link HandleLongSubRequest} for details on this) or just the type and videoID.
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response, note we use next() just in case we need to add middleware, but the response is handled by sending an empty stream Object.
 * @param {subRequestMiddleware} [next] - The next middleware function in the chain, can be empty because we already responded with this middleware
 */
function HandleMetaRequest(req, res, next) {
  console.log(`\x1b[96mEntered HandleMetaRequest with\x1b[39m ${req.originalUrl}`)
  const idDetails = req.params.videoId.split(':')
  const videoID = idDetails[0] //We only want the first part of the videoID, which is the IMDB ID, the rest would be the season and episode
  if (videoID === "tve") {
    tveAPI.GetChannel(req.params.videoId).then((result) => {
      console.log("\x1b[36mGot metadata for\x1b[39m", idDetails[1])
      res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200");
      res.json({ meta: result, message: "Got metadata!" });
      next()
    }).catch((err) => {
      console.error('\x1b[31mFailed on tve id search:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.json({ meta: {}, message: "Failed getting tve channel info" });
        next()
      }
    })
  } else {
    res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200");
    res.json({ meta: {}, message: "Wrong idPreffix" });
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
metas.get("/:config/meta/:type/:videoId.json", ParseConfig, HandleMetaRequest)
//Unconfigured requests
metas.get("/meta/:type/:videoId.json", HandleMetaRequest)

module.exports = metas;