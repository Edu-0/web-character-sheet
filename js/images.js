export const IMAGE_LIMITS = Object.freeze({ bytes: 10 * 1024 ** 2, pixels: 25000000, side: 1024, output: 300 * 1024 });

export function safeImageSource(source) {
  if (typeof source !== 'string') return '';
  if (/^data:image\/(?:png|jpeg|webp|gif|svg\+xml)(?:;charset=utf-8)?(?:;base64)?,/i.test(source)) return source;
  try { const url = new URL(source, location.href); return url.origin === location.origin && ['http:', 'https:', 'blob:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}

export async function compressPortrait(file) {
  if (file.size > IMAGE_LIMITS.bytes) throw new Error('Retrato: arquivo excede 10 MiB.');
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) throw new Error('Retrato: escolha PNG, JPEG ou WebP.');
  // Compatibilidade com os vetores locais já suportados: nunca persistir markup do upload.
  if (file.type === 'image/svg+xml') {
    if (file.size > 1024 ** 2) throw new Error('Retrato SVG excede 1 MiB. Use uma imagem raster.');
    const source = await file.text();
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (/<!DOCTYPE|<!ENTITY/i.test(source) || doc.documentElement.localName !== 'svg' || doc.querySelectorAll('*').length > 10000 || doc.querySelector('parsererror, script, foreignObject, image, use, style, animate, set') || [...doc.querySelectorAll('*')].some(node => [...node.attributes].some(a => /^on/i.test(a.name) || /href/i.test(a.name) || /url\s*\(/i.test(a.value)))) throw new Error('Retrato SVG contém conteúdo não permitido. Use uma imagem raster.');
    const root = doc.documentElement;
    const width = parseFloat(root.getAttribute('width')); const height = parseFloat(root.getAttribute('height'));
    if (width * height > IMAGE_LIMITS.pixels) throw new Error('Retrato excede 25 megapixels.');
  }
  // Cabeçalhos permitem recusar dimensões antes da decodificação raster.
  if (file.type !== 'image/svg+xml') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    let width, height;
    if (file.type === 'image/png' && bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {width = view.getUint32(16); height = view.getUint32(20);}
    else if (file.type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) {
      let offset = 2;
      while (offset + 8 < bytes.length) {
        if (bytes[offset++] !== 0xff) break;
        while (bytes[offset] === 0xff) offset++;
        const marker = bytes[offset++];
        if (marker === 0xda || marker === 0xd9) break;
        const length = view.getUint16(offset);
        if (length < 2 || offset + length > bytes.length) break;
        if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;}
        offset += length;
      }
    } else if (file.type === 'image/webp' && bytes.length >= 30 && new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP') {
      const kind = new TextDecoder().decode(bytes.slice(12,16));
      if (kind === 'VP8X') {width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16); height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);}
      else if (kind === 'VP8L' && bytes[20] === 0x2f) {const bits = view.getUint32(21,true); width = 1 + (bits & 0x3fff); height = 1 + ((bits >>> 14) & 0x3fff);}
      else if (kind === 'VP8 ') {width = view.getUint16(26,true) & 0x3fff; height = view.getUint16(28,true) & 0x3fff;}
    }
    if (!width || !height) throw new Error('Retrato: conteúdo não corresponde a PNG, JPEG ou WebP válido.');
    if (width * height > IMAGE_LIMITS.pixels) throw new Error('Retrato excede 25 megapixels.');
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    try { await image.decode(); } catch { throw new Error('Não foi possível decodificar o retrato.'); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > IMAGE_LIMITS.pixels) throw new Error('Retrato excede 25 megapixels ou tem dimensões inválidas.');
    const factor = Math.min(1, IMAGE_LIMITS.side / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * factor)); canvas.height = Math.max(1, Math.round(image.naturalHeight * factor));
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.72, 0.55, 0.35]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (blob && blob.size <= IMAGE_LIMITS.output) return await new Promise((resolve,reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Não foi possível ler a imagem processada.')); reader.readAsDataURL(blob);
      });
    }
    throw new Error('Retrato processado excede 300 KiB. Escolha uma imagem mais simples.');
  } finally { URL.revokeObjectURL(url); image.src = ''; }
}
