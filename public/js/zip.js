// Création d'une archive .zip dans le navigateur (fichiers stockés sans compression :
// photos, vidéos et vocaux sont déjà compressés). Aucune limite de taille côté serveur.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (data) => {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// Date au format DOS du zip (sans elle, les fichiers s'affichent datés de 1979/1980).
const dosTime = (d) => (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
const dosDate = (d) => ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

// files : [{ name, data: Uint8Array, date? }] → Blob (date : celle de la photo/vidéo, sinon maintenant)
export function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const { name, data, date } of files) {
    const n = enc.encode(name), crc = crc32(data);
    const when = date && !Number.isNaN(new Date(date).getTime()) ? new Date(date) : new Date();
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(10, dosTime(when), true); local.setUint16(12, dosDate(when), true);
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
    local.setUint16(26, n.length, true);
    parts.push(local, n, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    cd.setUint16(12, dosTime(when), true); cd.setUint16(14, dosDate(when), true);
    cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
    cd.setUint16(28, n.length, true); cd.setUint32(42, offset, true);
    central.push(cd, n);
    offset += 30 + n.length + data.length;
  }
  const size = central.reduce((s, p) => s + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
