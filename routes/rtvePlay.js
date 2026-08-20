const cheerio = require("cheerio");

const RTVEPLAY_BASE = "https://www.rtve.es/play"

exports.GetMeta = async function (id, type="video") {
  id = id.replace(/^rtvep:/, '') //remove prefix if present
  type = Stremio2Type(type) //convert stremio type to RTVE Play type
  return GetItemInfo(id, type) //try API
  .catch(e => GetMetaFromHTML(id, type)) //try HTML scrapping if failed
}

async function GetMetaFromHTML(id, type="video") {
  try { //handle both htmlUrl and htmlShortUrl respectively (ShortURL shouldd be way better)
    const searchURL = (id.includes("/")) ? new URL(`${RTVEPLAY_BASE}/${type}s/${id}`) : new URL(`https://www.rtve.es/${Type2ShortType(type)}/${id}`);

    console.log(`\x1b[36mLooking for metadata in RTVE Play: ${searchURL}`)

    const html = await fetch(searchURL).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.text()
    })

    return ExtractMetaFromHTML(html, id)
  } catch (err) {
    console.error('\x1b[31mFailed on RTVE Play HTML metadata extraction because:\x1b[39m ' + err)
    throw err
  }
}

function ExtractMetaFromHTML(html, id) {
  const $ = cheerio.load(html);
  const staffBox = $("div.staffBox")

  return {
    id: `rtvep:${id}`,
    type: "movie",
    name: $("div.resumBox > strong").text() || $("h1").text() || $("title").text(),
    description: $("div.intro > p").text(),
    poster: $("img.i_post").attr("src"),
    background: $("img.i_back").attr("src"),
    runtime: $("div.resumBox span.duration").text(),
    director: staffBox.find("dt").filter(function(_,el){
      return el.text().trim() === "Dirigido por"
    }).first().next().text().split(","),
    cast: staffBox.find("dt").filter(function(_,el){
      return el.text().trim() === "Reparto"
    }).first().next().text().split(","),
    genres: staffBox.find("dt").filter(function(_,el){
      return el.text().trim() === "Géneros"
    }).first().next().text().split(","),
    releaseInfo: staffBox.find("dt").filter(function(_,el){
      return el.text().trim() === "Año de producción"
    }).first().next().text(),
    language: $("div.techs > dl > dd").first().text(),
  }
}

async function GetItemInfo(id, type="video") {
  try {
    const json = await fetch(`https://www.rtve.es/api/${type}s/${id}`).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.json()
    })

    const item = json.page?.items?.[0]
    if (!item) throw Error(`No item found for RTVE Play ID: ${id}`)

    const name = item.title || item.name || item.shortTitle


    let videos = undefined
    if (item.seasons !== undefined && item.seasons.length > 0) {
      videos = []
      for (season in item.seasons) {
        for (let ep = 1; ep <= season.numEpisodes; ep++) {
          let d = new Date(Date.now())
          videos.push({
            id: `rtvep:${id}:${season.orden}:${ep}`,
            title: name + " Ep. " + ep,
            released: new Date(d.setDate(d.getDate() - (season.numEpisodes - Number(ep)))),
            season: Number(season.orden),
            episode: Number(ep),
          })
        }
      }
    }

    return {
      id: `rtvep:${item.id}`,
      imdb_id: item.idImdb,
      type: (item.contentType) ? Type2Stremio(item.contentType) : Type2Stremio(item.assetType),
      name,
      genres: item.generos?.map(it => it.generoInf),
      poster: item.imgPoster || item.imgPoster2 || item.previews?.vertical || item.previews?.vertical2,
      //posterShape: ,
      background: item.imgBackground || item.imgBackground2 || item.thumbnail || item.previews?.horizontal || item.previews?.horizontal2 || item.imageSEO,
      logo: item.logo || item.logo2,
      description: item.shortDescription || item.description,
      videos,
      releaseInfo: item.productionDate,
      runtime: Math.round(item.duration / 60000), //convert ms to minutes
      director: item.directorIds?.map(it => it.name) || item.director?.split(" | "),
      cast: item.castingIds?.map(it => it.name) || item.casting?.split(" | "),
      language: item.language,
      country: item.country,
      website: `https://www.rtve.es${item.webOficial}` || item.htmlUrl || item.htmlShortUrl,
    }
  } catch (err) {
    console.error('\x1b[31mFailed on RTVE Play item info fetch because:\x1b[39m ' + err)
    throw err
  }
}
//WIP
function GetSeasonInfo(id, seasID, epNum) {
  //https://www.rtve.es/play/videos/modulos/capitulos/1000646/1001463/
  try { //batches of 20 episodes
    const pageMax = Math.ceil(epNum / 20) //get number of pages needed to get all eps
    let searchURL = new URL(`${RTVEPLAY_BASE}/videos/modulos/capitulos/${id}/${seasID}/`)

    let promises = []
    for (let pNum = 1; pNum <= pageMax; pNum++) {
      searchURL.searchParams.set("page", pNum)
      promises.push(ParseSeasonPage(searchURL))
    }

    return Promise.allSettled(promises).then((results) => {
      const episodes = results.filter((prom) => (prom.value)).map((source) => source.value)
      return episodes //TODO: concat array of episodes in each promise
    })
  } catch (err) {
    console.error('\x1b[31mFailed on RTVE Play HTML metadata extraction because:\x1b[39m ' + err)
    throw err
  }
}
//WIP
async function ParseSeasonPage(url) {
  const html = await fetch(url).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.text()
  })

  const $ = cheerio.load(html);
  let episodes = []
  //process page, episodes.push() with each ep data
  return episodes
}

exports.Search = async function (query) {
  try {
    let searchURL = new URL(`${RTVEPLAY_BASE}/buscador/`); searchURL.searchParams.set('query', query)
    searchURL = searchURL.toString().replace(/\+/g, '%20') //spaces turn into + signs, but RTVE Play uses %20

    console.log(`\x1b[36mSearching RTVE Play: ${searchURL}`)

    const html = await fetch(searchURL).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.text()
    })
    const $ = cheerio.load(html);

    let results = []
    $('#topPage ul li.elem_nV').each((_, elem) => {
      const result = FormatSearchResult($, elem)
      if (result) results.push(result)
    })
    return results

  } catch (err) {
    console.error('\x1b[31mFailed on RTVE Play search because:\x1b[39m ' + err)
    throw err
  }
}

function Type2Stremio(type) {
  switch (type) {
    case "video":
      return "movie"
    case "serie":
      return "series"
    case "programa":
      return "series"
    default:
      return "movie"
  }
}

function Stremio2Type(type) {
  switch (type) {
    case "movie":
      return "video"
    case "series":
      return "programa"
    default:
      return "video"
  }
}

function Type2ShortType(type) {
  switch (type) {
    case "video":
      return "v"
    case "serie":
      return "s"
    case "programa":
      return "pr"
    default:
      return "v"
  }
}

function FormatSearchResult($, elem) {
  try{
    const dataSetupStr = $(elem).data("setup")
    const dataSetup = JSON.parse(dataSetupStr)
    const type = Type2Stremio(dataSetup.tipo)
    
    const img = $(elem).find("img"); const link = $(elem).find("a")

    id1 = dataSetup.id || dataSetup.idAsset || link.attr("href").replace(RTVEPLAY_BASE+'/videos/', '') //try ID, otherwise full URI

    return {
      id: `rtvep:${id1}`,
      type,
      name: $(elem).find("span.maintitle").text() || link.attr("title") || img.attr("alt"),
      poster: img.attr("src"),
    }
  } catch (err) {
    console.error('\x1b[31mFailed on RTVE Play search result formatting because:\x1b[39m ' + err)
    return null
  }
}

exports.GetStreamURLFromID = function (id) {
  const pathPart1 = id.slice(-2)
  const pathPart2 = id.slice(-4, -2)
  return `https://rtvedrmstaging.rtve.es/${pathPart1}/${pathPart2}/${id}/${id}_drm.mpd?idasset=${id}`
  //https://rtvedrmstaging.rtve.es/63/83/16398363/16398363_drm.mpd?idasset=16398363
}

function GetIDFromURL(url) {
  const match = url.match(/\/(\d+)\/?$/)
  return match ? match[1] : null
}

exports.GetStreamURLFromURL = function (url) {
  const id = GetIDFromURL(url)
  if (!id) throw Error(`Invalid RTVE Play URL: ${url}`)
  return this.GetStreamURLFromID(id)
}
