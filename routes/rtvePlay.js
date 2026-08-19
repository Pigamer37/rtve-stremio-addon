const cheerio = require("cheerio");

const RTVEPLAY_BASE = "https://www.rtve.es/play"

exports.GetMeta = async function (id) {
  try {
    let searchURL = new URL(`${RTVEPLAY_BASE}/videos/${id}`);

    console.log(`\x1b[36mSearching RTVE Play: ${searchURL}`)

    const html = await fetch(searchURL).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.text()
    })
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

  } catch (err) {
    console.error('\x1b[31mFailed on RTVE Play search because:\x1b[39m ' + err)
    throw err
  }
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

function FormatSearchResult($, elem) {
  try{
    const dataSetupStr = $(elem).data("setup")
    const dataSetup = JSON.parse(dataSetupStr)
    let type = "movie"
    switch (dataSetup.tipo) {
      case "video":
        type = "movie"
        break;
      case "serie":
        type = "series"
        break;
      case "programa":
        type = "series"
        break;
      default:
        type = "movie"
        break;
    }
    const img = $(elem).find("img"); const link = $(elem).find("a")
    return {
      id: `rtvep:${link.attr("href").replace(RTVEPLAY_BASE+'/videos/', '')}`,//${dataSetup.id || dataSetup.idAsset}`,
      type,
      name: $(elem).find("span.maintitle").text() || link.attr("title") || img.attr("alt"),
      poster: img.attr("src"),
    }
  } catch (err) {
    console.error('\x1b[31mFailed on RTVE Play search result formatting because:\x1b[39m ' + err)
    return null
  }
}