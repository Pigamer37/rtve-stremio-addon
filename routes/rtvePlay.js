const cheerio = require("cheerio");

const RTVEPLAY_BASE = "https://www.rtve.es/play"

exports.GetMeta = async function (id, type = "video") {
  id = id.replace(/^rtvep:/, '') //remove prefix if present
  type = Stremio2Type(type) //convert stremio type to RTVE Play type
  return GetItemInfo(id, type) //try API
    //.catch(e => GetMetaFromHTML(id, type)) //try HTML scrapping if failed
}

async function GetMetaFromHTML(id, type = "video") {
  try { //handle both htmlUrl and htmlShortUrl respectively (ShortURL should be way better)
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
    director: staffBox.find("dt").filter(function (_, el) {
      return el.text().trim() === "Dirigido por"
    }).first().next().text().split(","),
    cast: staffBox.find("dt").filter(function (_, el) {
      return el.text().trim() === "Reparto"
    }).first().next().text().split(","),
    genres: staffBox.find("dt").filter(function (_, el) {
      return el.text().trim() === "Géneros"
    }).first().next().text().split(","),
    releaseInfo: staffBox.find("dt").filter(function (_, el) {
      return el.text().trim() === "Año de producción"
    }).first().next().text(),
    language: $("div.techs > dl > dd").first().text(),
  }
}

async function GetItemInfo(id, type = "video") {
  try {
    const json = await fetch(`https://www.rtve.es/api/${type}s/${id}`).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.json()
    })

    const item = json.page?.items?.[0]
    if (!item) throw Error(`No item found for RTVE Play ID: ${id}`)

    return await ParseJSONInfo(item)
  } catch (err) {
    console.error('\x1b[31mFailed on RTVE Play item info fetch because:\x1b[39m ' + err)
    throw err
  }
}

function ParseJSONInfo(item, simple=false) {
  const name = item.title || item.name || item.shortTitle
  let proms = []
  if (simple===false && item.seasons !== undefined && Array.isArray(item.seasons) && item.seasons.length > 0) {
    //videos = []; 
    for (season of item.seasons) {
      proms.push(GetSeasonInfo(item.id, season.id, season.orden, season.numEpisodes))
      // for (let ep = 1; ep <= season.numEpisodes; ep++) {
      //   let d = new Date(Date.now())
      //   videos.push({
      //     id: `rtvep:${item.id}:${season.orden}:${ep}`,
      //     title: name + " Ep. " + ep,
      //     released: new Date(d.setDate(d.getDate() - (season.numEpisodes - Number(ep)))),
      //     season: Number(season.orden),
      //     episode: Number(ep),
      //   })
      // }
    }
  } else proms.push(Promise.reject())

  return Promise.allSettled(proms).then((results) => {
    const episodes = results.filter((prom) => (prom.value)).map((source) => source.value)
    let videos = [].concat(...episodes)
    if (videos.length < 1) videos = undefined

    runtime = Math.round(item.duration / 60000)

    let links = []

    links.push({ category: "Abrir en", name: "RTVE Play", url: item.htmlUrl || item.htmlShortUrl || `https://www.rtve.es/${Type2ShortType(item.contentType || item.assetType)}/${item.id}` })
    if (item.idImdb) links.push({ category: "Abrir en", name: "IMDB", url: `https://www.imdb.com/title/${item.idImdb}` })
    if (item.idWiki) links.push({ category: "Abrir en", name: "Wikipedia", url: item.idWiki })

    const genres = item.generos?.map(it => it.generoInf)
    //const cast = item.castingIds?.map(it => it.name) || item.casting?.split(" | ")
    //for (g of genres) {links.push({category: "Genres", name: g, url: })}
    let director = undefined
    if (item.directorIds && item.directorIds !== null) {
      director = []
      for (d of item.directorIds) {
        links.push({ category: "Directores", name: d.name, url: d.htmlUrl || `stremio:///search?search=${d.name}` })
        director.push(d.name)
      }
    } else if (item.director && item.director !== null) {
      director = []
      for (d of item.director?.split(" | ")) {
        links.push({ category: "Directores", name: d, url: `stremio:///search?search=${d}` })
        director.push(d)
      }
    }

    let cast = undefined
    if (item.castingIds && item.castingIds !== null) {
      cast = []
      for (d of item.castingIds) {
        links.push({ category: "Reparto", name: d.name, url: d.htmlUrl || `stremio:///search?search=${d.name}` })
        cast.push(d.name)
      }
    } else if (item.casting && item.casting !== null) {
      cast = []
      for (d of item.casting?.split(" | ")) {
        links.push({ category: "Reparto", name: d, url: `stremio:///search?search=${d}` })
        cast.push(d)
      }
    }

    return {
      id: `rtvep:${item.id}`,
      imdb_id: item.idImdb,
      type: (item.contentType) ? Type2Stremio(item.contentType) : Type2Stremio(item.assetType),
      name,
      genres,
      director,
      cast,
      links,
      poster: item.imgPoster || item.imgPoster2 || item.previews?.vertical || item.previews?.vertical2 || `https://img.rtve.es/v/${item.id}/vertical?h=303`,
      //posterShape: ,
      background: item.imgBackground || item.imgBackground2 || item.thumbnail || item.previews?.horizontal || item.previews?.horizontal2 || item.imageSEO,
      logo: item.logo || item.logo2,
      description: item.shortDescription || item.description,
      videos,
      releaseInfo: new Date(item.productionDate).getFullYear(),
      runtime: (!Number.isNaN(runtime)) ? `${runtime}m` : undefined, //convert ms to minutes
      language: item.language,
      country: item.country,
      website: (item.webOficial) ? `https://www.rtve.es${item.webOficial}` : undefined || item.htmlUrl || item.htmlShortUrl,
    }
  })
}
//WIP
function GetSeasonInfo(id, seasID, seasNumber, epNum) {
  //https://www.rtve.es/play/videos/modulos/capitulos/1000646/1001463/
  try { //batches of 20 episodes
    const pageMax = Math.ceil(epNum / 20) //get number of pages needed to get all eps
    let searchURL = new URL(`${RTVEPLAY_BASE}/videos/modulos/capitulos/${id}/${seasID}/`)

    let promises = []
    for (let pNum = 1; pNum <= pageMax; pNum++) {
      searchURL.searchParams.set("page", pNum)
      promises.push(ParseSeasonPage(searchURL, (pNum - 1) * 20 + 1))
    }

    return Promise.allSettled(promises).then((results) => {
      const episodes = results.filter((prom) => (prom.value)).map((source) => source.value)
      let epArr = [].concat(...episodes) //TODO: concat array of episodes in each promise
      for (ep of epArr) {
        ep.season = Number(seasNumber)
      }
      return epArr
    })
  } catch (err) {
    console.error('\x1b[31mFailed on RTVE Play HTML metadata extraction because:\x1b[39m ' + err)
    throw err
  }
}
//WIP
async function ParseSeasonPage(url, epStart = 1) {
  const html = await fetch(url).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.text()
  })

  const $ = cheerio.load(html);
  let episodes = []

  $("#listCapitulos > li").each((i, el) => {
    let setup = undefined
    try {
      setup = JSON.parse(el.data("setup"))
    } catch (_) { }
    const epID = setup?.id || setup?.idAsset || $(el).find("div.cellBox").data("idasset")
    const dateVec = $(el).find("div.txtBox > span.pubBox > span.datemi").text().split("/")
    episodes.push({
      id: `rtvep:${epID}`,
      title: $(el).find("div.txtBox > strong > span.maintitle").text().normalize(),
      thumbnail: setup?.imagen || $(el).find("span > img.i_prvw").attr("src"),
      overview: $(el).find("div.txtBox > p").text(),
      released: new Date(dateVec[2],dateVec[1],dateVec[0]),
      episode: Number(i + epStart), //number in order
    })
  })
  return episodes
}

exports.Search = async function (query) {
  try {
    let searchURLProgs = new URL(`https://api.rtve.es/api/search/programs`); searchURLProgs.searchParams.set('search', encodeURIComponent(query))
    let searchURLCont = new URL(`https://api.rtve.es/api/search/contents`); searchURLCont.searchParams.set('search', encodeURIComponent(query))

    console.log(`\x1b[36mSearching RTVE Play: ${searchURLProgs.searchParams.toString()}`)

    const progsJSON = fetch(searchURLProgs).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.json()
    })
    // const contentsJSON = fetch(searchURLCont).then((resp) => {
    //   if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    //   if (resp === undefined) throw Error(`Undefined response!`)
    //   return resp.json()
    // })

    return Promise.allSettled([progsJSON/*, contentsJSON*/]).then((results) => {
      const resul = results.filter((prom) => (prom.value)).map((source) => source.value)
      if (results[0].status === 'rejected') console.error('Program query failed:', results[0].reason)
      let ress = []
      for (ob of resul) {
        const validRes = ob?.page?.items?.filter(i => i.assetType !== "audio")
        for (item of validRes) {
          ress.push(ParseJSONInfo(item, true))
        }
      }
      return Promise.allSettled(ress).then((results) => {
        const sRes = results.filter((prom) => (prom.value)).map((source) => source.value)
        return [].concat(...sRes)
      })
    }).catch(e => console.log("FML", e))
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
  try {
    const dataSetupStr = $(elem).data("setup")
    const dataSetup = JSON.parse(dataSetupStr)
    const type = Type2Stremio(dataSetup.tipo)

    const img = $(elem).find("img"); const link = $(elem).find("a")

    id1 = dataSetup.id || dataSetup.idAsset || link.attr("href").replace(RTVEPLAY_BASE + '/videos/', '') //try ID, otherwise full URI

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

function GetStreamURLFromID(id) {
  const pathPart1 = id.slice(-2)
  const pathPart2 = id.slice(-4, -2)
  return `https://rtvedrmstaging.rtve.es/${pathPart1}/${pathPart2}/${id}/${id}_drm.mpd?idasset=${id}`
  //https://rtvedrmstaging.rtve.es/63/83/16398363/16398363_drm.mpd?idasset=16398363
}

function GetIDFromURL(url) {
  const match = url.match(/\/(\d+)\/?$/)
  return match ? match[1] : null
}

function GetStreamURLFromURL(url) {
  const id = GetIDFromURL(url)
  if (!id) throw Error(`Invalid RTVE Play URL: ${url}`)
  return GetStreamURLFromID(id)
}

exports.GetStreams = async function (id, type = "movie") {
  let streams = []
  let stream = GetStreamURLFromID(id)
  streams.push({
    url: stream,
    name: "RTVE Play",
    description: stream,
    behaviorHints: {
      bingeGroup: "rtveplay"
    }
  })
  streams.push({
    externalUrl: `https://www.rtve.es/v/${id}`,
    name: "RTVE Play (external)",
    description: `Open in RTVE Play (https://www.rtve.es/v/${id})`,
    behaviorHints: {
      bingeGroup: "rtveplay|ext"
    }
  })
  return streams
}
