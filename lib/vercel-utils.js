const vercelBlob = require("@vercel/blob");
require('dotenv').config()

exports.GetVercelBlob = async function (fileName, type = 'json') {
  return vercelBlob.get(fileName, { access: 'public' }).then(res => {
    if (res?.blob?.url) return res.blob.url
    else throw Error('Invalid URL')
  })
  // .catch(async (err) => {
  //   console.error('\x1b[31mFailed reading Vercel Blob with direct URL:\x1b[39m', err, 'Using expensive list() method instead')
  //   const list = await vercelBlob.list({ limit: 3 })
  //   if (list.blobs.length < 1) throw Error("No files found in Vercel Blob")
  //   const blobObj = list.blobs.find((blob) => blob.pathname.includes(fileName))
  //   if (!blobObj) throw Error(`Files found, but no ${fileName} found`)
  //   return blobObj.url
  // })
  .then(blobUrl => {
    return fetch(blobUrl).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return (type === 'json') ? resp.json() : resp.text()
    })
  })
}

exports.PutVercelBlob = function (fileName, contents, type = 'json') {
  return vercelBlob.put(fileName, contents, {
    access: 'public',
    allowOverwrite: true, //Allow overwriting the file
    cacheControlMaxAge: 86400000, //1 day
    contentType: (type === 'json') ? "application/json" : type
  })
}