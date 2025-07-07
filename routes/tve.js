const CHANNEL_JSON = "https://www.tdtchannels.com/lists/tv.json"

const fsPromises = require("fs/promises");

exports.GetChannelsFromWeb = async function () {
  return fetch(CHANNEL_JSON).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()
  }).then((data) => {
    if (data?.countries === undefined) throw Error("Invalid response!")
    let channels = []
    data.countries[0].ambits.filter((x) => ["Generalistas", "Informativos", "Deportivos", "Infantiles"].includes(x.name)).forEach((x) => channels = channels.concat(x.channels.filter((x) => {
      return (x.options.some((opt) => (opt.format !== "youtube" && opt.format !== "stream")) || x.options.length < 1) && !x.extra_info.includes("NOEM") && x.name !== "El Toro TV"
    })))
    data.countries[1].ambits.filter((x) => ["Int. Europa"].includes(x.name)).forEach((x) => channels = channels.concat(x.channels.filter((x) => x.name.includes("TVE"))))
    channels = channels.map((x) => {
      return {
        id: `tve:${x.name}`, //x.epg_id ???
        type: "tv",
        name: x.name,
        logo: x.logo,
        country: "Spain",
        website: x.web,
        poster: x.logo,
        posterShape: "square"
      }
    })
    return channels
  })
}

exports.GetChannels = async function () {
  return fsPromises.readFile('./channels.json').then((data) => JSON.parse(data)).catch((err) => {
    console.error('\x1b[31mFailed reading channels cache:\x1b[39m ' + err)
    return this.GetChannelsFromWeb() //If the file doesn't exist, get the titles from the web
  })
}

exports.GetChannel = async function (channelID) {
  return this.GetChannels().then((result) => {
    return result.filter((x) => x.id === channelID)[0]
  })
}

exports.UpdateChannelsFile = function () {
  return this.GetChannelsFromWeb().then((channels) => {
    console.log(`\x1b[36mGot ${channels.length} channels\x1b[39m, saving to channels.json`)
    return fsPromises.writeFile('./channels.json', JSON.stringify(channels))
  }).then(() => console.log('\x1b[32mChannels "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" channels:\x1b[39m ' + err)
  })
}

exports.GetChannelStreams = function (channelName) {
  return fetch(CHANNEL_JSON).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()
  }).then((data) => {
    if (data?.countries === undefined) throw Error("Invalid response!")
    let channels = [], streams = []
    data.countries[0].ambits.filter((x) => ["Generalistas", "Informativos", "Deportivos", "Infantiles"].includes(x.name)).forEach((x) => channels = channels.concat(x.channels.filter((x) => {
      return (x.options.some((opt) => (opt.format !== "youtube" && opt.format !== "stream")) || x.options.length < 1) && x.name !== "El Toro TV"
    })))
    data.countries[1].ambits.filter((x) => ["Int. Europa"].includes(x.name)).forEach((x) => channels = channels.concat(x.channels.filter((x) => x.name.includes("TVE"))))
    if (channelName) channels = channels.filter((x) => x.name === channelName)
    channels.forEach((x) => {
      for (const option of x.options) {
        if (option.format === "m3u8")
          streams.push({
            url: option.url,
            name: x.name,
            description: option.url,
            ...((option.geo2 !== null || x.extra_info.includes("GEO")) ? { behaviorHints: { countryWhitelist: "esp" } } : {}) //If the channel is geo-blocked, add a hint to the client
          })
      }
      streams.push({ externalUrl: x.web, name: `${x.name} web (external)`, description: x.web })
    })
    return streams
  })
}