//npm run devStart
const express = require("express")
const app = express()

//const { addonBuilder, serveHTTP, publishToCentral } = require('stremio-addon-sdk')

function setCORS(_req, res, next) {
  res.header(`Access-Control-Allow-Origin`, `*`);
  res.header(`Access-Control-Allow-Methods`, `GET,PUT,POST,DELETE`);
  res.header(`Access-Control-Allow-Headers`, `Content-Type`);
  next();
}
app.use(setCORS);

app.use(express.static('public'))
app.set('view engine', 'ejs');

const fsPromises = require("fs/promises")
function ReadManifest() {
  return fsPromises.readFile('./package.json', 'utf8').then((data) => {
    const packageJSON = JSON.parse(data);

    let manifest = {
      "id": 'com.' + packageJSON.name.replaceAll('-', '.'),
      "version": packageJSON.version,
      "name": "TVE",
      "logo": "https://graph.facebook.com/tveInternacional/picture?width=256&height=256",
      "description": packageJSON.description,
      "catalogs": [
        {
          id: "tve", type: "TV", name: "Live channels"/*,
          extra: [{ name: "search", isRequired: false }]*/
        }
      ],
      "resources": [
        "stream",
        "meta",
        "catalog"
      ],
      "types": [
        "tv"
      ],
      "idPrefixes": [
        "tve:"
      ],
      "stremioAddonsConfig": {
        "issuer": "https://stremio-addons.net",
        "signature": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..bukFRYB8W_R0x-j_ULi9eA.7II4HGscJIjpv6TJVDBGrLgaGx8K46j9nx6UT3Cb2jTXq_FCcJLFSHLsYKe0LG9NgNgo5tdmzgEhoWdUVU-UJc-fBivKTFbBP5EN7HkgmELkedoqRITFRxjLh_Am7CC8.s800KCeo0aFXP6oHCdyfwA"
      }/*,
      "behaviorHints": { "configurable": true }*/
    }
    return manifest;
  })
}

app.get("/manifest.json", (_req, res) => {
  ReadManifest().then((manif) => {
    //manif.behaviorHints.configurationRequired = true
    res.json(manif);
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})

app.get("/:config/manifest.json", (_req, res) => {
  ReadManifest().then((manif) => {
    //console.log("Params:", decodeURIComponent(req.params[0]))
    res.json(manif);
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})

/*app.get("/configure", (req, res) => {
  ReadManifest().then((manif) => {
    let base_url = req.host;
    res.render('config', {
      logged_in: false,
      base_url: base_url,
      manifest: manif
    })
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})
//WIP
app.get("/:config/configure", (req, res) => {
  ReadManifest().then((manif) => {
    let base_url = req.host;
    res.render('config', {
      logged_in: true,
      config: req.params.config,
      user: req.params.config,
      base_url: base_url,
      manifest: manif
    })
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})*/

const streams = require("./routes/streams");
app.use(streams);

const meta = require("./routes/meta");
app.use(meta);

const catalog = require("./routes/catalog");
app.use(catalog);

app.listen(process.env.PORT || 3000, () => {
  console.log(`\x1b[32mtve-stremio-addon is listening on port ${process.env.PORT || 3000}\x1b[39m`)
  const tveAPI = require('./routes/tve.js')
  tveAPI.UpdateChannelsFile().then(() => {
    setInterval(tveAPI.UpdateChannelsFile.bind(tveAPI), 86400000); //Update every 24h
  })
});
