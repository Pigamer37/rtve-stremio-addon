require('dotenv').config()

const channelIDMap = new Map([
  ["La 1", "LA1.es"],
  ["La 2", "La2.es"],
  ["Antena 3", "Antena3.es"], //not on base
  ["Divinity", "Divinity.es"], //nob
  ["Neox", "Neox.es"], //nob
  ["Cuatro", "Cuatro.es"],
  ["Telecinco", "Telecinco.es"],
  ["La Sexta", "LaSexta.es"], //nob
  ["FDF", "FDF.es"],
  ["Energy", "Energy.es"],
  ["Divinity", "Divinity.es"],
  ["Be Mad", "BeMad.es"],
  ["TRECE", "TRECE.es"],
  ["VEO7", "Veo7.es"],
  ["Squirrel", "Squirrel.es"],
  ["Ten", "Ten.es"],
  ["DKISS", "DKISS.es"],
  ["DMAX", "DMAX.es"], //nob
  ["BOM Cine", "BOMCine.es"],
  ["24h", "24Horas.es"],
  ["Euronews", "Euronews.es"],
  ["3CatInfo", "3CatInfo.es"],
  ["El País", "ElPais.es"],
  ["El Confidencial", "ElConfidencial.es"],
  ["Negocios TV", "NegociosTV.es"],
  ["Teledeporte", "Teledeporte.es"],
  ["GOL", "GOL.es"],
  ["Esport3", "Esport3.es"],
  ["IB3 Esports", "IB3.es"],
  ["Real Madrid TV", "RealMadridTV.es"],
  ["Top Barça", "TopBarca.es"],
  ["Betis TV", "BetisTV.es"],
  ["Boing", "Boing.es"],
  ["Clan", "Clan.es"],
  ["SX3", "SX3.es"],
  ["Disney Channel", "DisneyChannel.es"],
  ["Nick Jr.", "NickJunior.es"],
  ["Pocoyó", "Pocoyo.es"],
  ["Star TVE Europa", "STARChannel.es"],
  ["TVE Int. Europa", "TVEInternacional.es"]
]);

//const fs = require('fs');
const vercelUtils = require("../lib/vercel-utils");
const zlib = require('zlib');
const { parseXmltv } = require('@iptv/xmltv');

function UpdateEPGFile() {
  return fetch(process.env.EPG_FILE_URL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.arrayBuffer()
  }).then((epg) => {
    const filePathp = process.env.EPG_FILE_URL.split('/')
    const filePath = filePathp[filePathp.length - 1]
    console.log(`\x1b[36mGot EPG file\x1b[39m, saving to ${filePath}`)
    //fs.writeFileSync(`./${filePath}`, epg) //local
    return vercelUtils.PutVercelBlob(filePath, Buffer.from(epg), 'application/x-gzip').then(() => epg)
  }).then((epg) => {
    console.log('\x1b[32mEPG "cached" successfully!\x1b[39m')
    return epg
  }).catch((err) => {
    console.error('\x1b[31mFailed "caching" EPG:\x1b[39m ' + err)
    throw err
  })
}

exports.UpdateEPGFile = UpdateEPGFile

async function GetCompressedFile(filePath) {
  //return Promise.resolve(fs.readFileSync(filePath)) //local
  return vercelUtils.GetVercelBlob(filePath, 'application/x-gzip').catch(err => {
    console.error('\x1b[31mFailed reading EPG cache:\x1b[39m ' + err)
    return UpdateEPGFile()
  }).then(raw => Buffer.from(raw))
}

function DecompFile(filePath) {
  return GetCompressedFile(filePath).then(compressedData => {
    if (!compressedData?.length || compressedData.length < 2) throw Error('Invalid file');
    const isGzip = compressedData[0] === 0x1f && compressedData[1] === 0x8b;
    const decompressedData = isGzip ? zlib.gunzipSync(compressedData) : compressedData;
    console.log(isGzip ? "Successfully decompressed" : "Already decompressed");
    // Convert the decompressed data to a string
    return decompressedData.toString('utf-8');
  })
}

function FilterProgrammesByDate(programmes, date) {
  const startOfDay = new Date(date).setHours(0, 0, 0, 0);
  const endOfDay = new Date(date).setHours(23, 59, 59, 999);

  return programmes.filter(programme => {
    return programme.stop >= startOfDay && programme.start < endOfDay;
  });
}

function FilterProgrammesByChannel(programmes, channelID) {
  return programmes.filter(programme => (programme.channel === channelID || programme.channel === channelIDMap.get(channelID)))
}

function ProgrammeToObj(programme, channelID) {
  let runtime
  if (programme.length?.units === 'minutes') runtime = `${programme.length['_value']} min`
  else if (programme.length?.units === 'seconds') runtime = `${Math.floor(programme.length['_value'] / 60)} min`
  else if (programme.stop) runtime = `${Math.floor((programme.stop - programme.start) / (1000 * 60))} min`

  return {
    id: `tve:${channelID}:epg:${programme.start.toISOString()}`,
    title: programme.title?.[0]['_value'] + (programme.subTitle?.length > 1 ? `: ${programme.subTitle.map(sub => sub['_value']).join(', ')}` : ''),
    overview: programme.desc?.[0]['_value'],
    thumbnail: programme.icon?.[0]?.src || programme.image?.filter(img => (img.orient === 'L' || img.type === 'backdrop'))?.[0]?.['_value'],
    released: programme.start, //maybe check the 'new' property?
    startTime: programme.start,
    endTime: programme.stop,
    runtime,
    releaseInfo: programme.previouslyShown?.start?.getFullYear().toString() || programme.start.getFullYear().toString(),
    genres: programme.category?.map(cat => cat['_value']),
    cast: programme.credits?.actor?.map(act => act['_value']),
    directors: programme.credits?.director?.map(dir => dir['_value']),
    ratings: programme.rating?.map(rat => ({ value: rat.value, system: rat.system, icon: rat.icon[0].src }))
  }
}

exports.GetEPGs = async function (date, channelIDs = undefined) {
  if (channelIDs === undefined || !Array.isArray(channelIDs)) channelIDs = Array.from(channelIDMap.keys())
  let programList = []
  try {
    const filePath = process.env.EPG_FILE_URL.split('/')
    const decomp = await DecompFile(filePath[filePath.length - 1])
    const json = parseXmltv(decomp);
    const todayProgrammes = FilterProgrammesByDate(json.programmes, date);
    for (chID of channelIDs) {
      const channelProgs = FilterProgrammesByChannel(todayProgrammes, chID).map(prog => ProgrammeToObj(prog, chID)) //get channel's programmes and convert them
      programList.push(...channelProgs) //destructure to add only non empty array items
    }
  } catch (err) {
    console.error("Error al parsear el XMLTV:", err);
  } finally {
    return programList
  }
}
