require('dotenv').config()

//process.env.EPG_FILE_URL

const fs = require('fs');
const zlib = require('zlib');
const { XMLParser } = require('fast-xml-parser');

function DecompFile(filePath) {
  const compressedData = fs.readFileSync(filePath);
  const decompressedData = zlib.gunzipSync(compressedData);
  // Convert the decompressed data to a string
  return decompressedData.toString('utf-8');
}

function FormatEPGDate(fechaEpg) {
    if (!fechaEpg) return ''
    const y = fechaEpg.substring(0, 4)
    const m = fechaEpg.substring(4, 6)
    const d = fechaEpg.substring(6, 8)
    const h = fechaEpg.substring(8, 10)
    const min = fechaEpg.substring(10, 12)
    const s = fechaEpg.substring(12, 14)
    const tz = fechaEpg.slice(-5)
    const formattedTZ = (tz.substring(1)==="0000") ? "Z" : `${tz.substring(0, 3)}:${tz.slice(-2)}`;
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}${formattedTZ}`)//`${y}-${m}-${d}T${h}:${min}:${s}${formattedTZ}`
}

function XMLToJSON(xmlString) {
  try {
    const jsonObj = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "" // Mantiene los nombres de atributos limpios (ej: start, stop, id)
    }).parse(xmlString);

    return jsonObj.tv;
  } catch (err) {
      console.error("Error al parsear el XMLTV:", err);
  }
}

function ProgrammeToObj(programme, channelMap) {
  const channelID = channelMap[programme.channel] || 'Canal Desconocido';
  const startTime = FormatEPGDate(programme.start)
  const endTime = FormatEPGDate(programme.stop)
  // const title = typeof programme.title === 'object' ? programme.title.#text : programme.title;
  // const description = typeof programme.desc === 'object' ? programme.desc.#text : programme.desc;

  return {
    id: `${channelID}:epg:${startTime.toISOString()}`,
    title: programme.title,
    overview: programme.desc,
    // thumbnail: 'https://example.com/evening-news.jpg',
    released: startTime,
    startTime,
    endTime,
    runtime: `${Math.floor((endTime - startTime) / (1000 * 60))} min`,
    releaseInfo: startTime.getFullYear(),
    // genres: ['News'],
    // cast: ['Jane Doe'],
    // directors: ['John Doe'],
    ratings: [{ value: 'PG', system: 'TVPG' }]
  }
}
