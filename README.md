# [RTVE Stremio addon](https://rtve-stremio-addon.vercel.app/manifest.json)
<p align="center"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Logo_RTVE.svg/330px-Logo_RTVE.svg.png" alt="TVE logo"/></p>

Node.js addon to add RTVE (Spanish Television and radio) functionallity to Stremio, not affiliated with TTVE. (I'm new to backend so I'm using it as a learning experience).

## Normal use:
### Install by copying <stremio://rtve-stremio-addon.vercel.app/manifest.json> on your browser or paste <https://rtve-stremio-addon.vercel.app/manifest.json> on the stremio addons search bar
This addon provides metadata and streaming options from Spanish Television channels and Radio stations (RTVE). It offers two catalogs with live TV channels and radio stations respectively. Additionally, when you open one of the channels, the platform will call this addon. When the program can get the data for the item you are requesting, some metadata will be provided and/or streaming options will be offered (the ones marked as external just open the link on your browser).

## Tips are welcome:
If you like the addon and would like to thank me monetarily, you can do so through ko-fi. Thank you!\
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/M4M219PJVI)

## Endpoints:
Here is [a full documentation page](https://rtve-stremio-addon.apidocumentation.com/) and [the OpenAPI reference](OpenAPI.yaml).
Here's the path to call it (parameters are marked by being enclosed in {} and described below):
```
/{resource}/{type}/{ID}.json
```
Parameters
1. `resource`: stream and meta are very self explanatory, and catalog exposes a list of channels.
2. `type`: should not matter, but to make sure, use 'tv'.
3. `ID`: `tve:{channelName}`/`rne:{stationName}`. `channelName/stationName` must be an exact match or it won't work.

## Run locally:
> [!IMPORTANT]
> 0. Previous steps/requirements:
>  - This project runs on Node.js, so install both Node.js and the npm (Node Package Manager)
1. Clone the repo/dowload the code on your machine however you like, and navigate to the project's directory (where `package.json` resides)
2. Run the following command to install all necessary dependencies based on `package.json`:
   ```
   npm install
   ```
3. Run a local instance of the server.
> [!TIP]
> You can run a convenient instance of the project that will restart itself when you make changes to the files (after saving) using `nodemon`, with the preprogrammed devStart command (`nodemon index.js` under the hood) with:
> ```
> npm run devStart
> ```
5. Make requests to the app on localhost:3000 (or the port set in an environment variable if it exists) or by using Stremio, in which case you'll need to install the addon (just provide Stremio the manifest url: "https://localhost:3000/manifest.json", for example)

## Acknowledgements:
> [!NOTE]
> <p align="center"><img src="https://www.tdtchannels.com/logo_200.png" alt="TDTChannels logo"/></p>
> This application/addon uses TDTChannels list but is not endorsed, certified, or otherwise approved by TDTChannels.
>
> <p align="center"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Logo_RTVE.svg/330px-Logo_RTVE.svg.png" alt="TVE logo"/></p>
> This application/addon serves RTVE IPTV sources, but is not endorsed, certified, or otherwise approved by RTVE.

## TO DO:
- [X] Publish to Stremio Addon Catalog (not on Beam Up, because the beamup tool is not working for me)
- [X] Support Metadata requests
   - [X] Get logo
   - [ ] Get background
   - [ ] Get description
- [ ] Make catalog searchable

### Enhancements/new features
- [X] Add radio support
- [ ] Touch up the views (the homepage, mainly)

## Documentation used:
- [Stremio Addon guide](https://stremio.github.io/stremio-addon-guide/basics)
- [Stremio Addon docs](https://github.com/Stremio/stremio-addon-sdk/tree/master/docs)
- Node.js docs
- Express.js docs
- [MDN docs](https://developer.mozilla.org/en-US/docs/Web)
- [JSDoc docs](https://jsdoc.app/)
