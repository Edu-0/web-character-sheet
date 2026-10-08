import { LIMITS } from '../validation/limits.js';

export const pointerFor = keys => keys.length ? '/' + keys.map(key => String(key).replaceAll('~', '~0').replaceAll('/', '~1')).join('/') : '';
const decimal = token => {
  const [mantissa, exponent = '0'] = token.toLowerCase().split('e');
  const negative = mantissa.startsWith('-');
  const digits = mantissa.replace('-', '').replace('.', '').replace(/^0+/, '') || '0';
  const coefficient=digits==='0'?'0':digits.replace(/0+$/,'');
  const scale=Number(exponent)-(mantissa.split('.')[1]?.length || 0)+digits.length-coefficient.length;
  return coefficient === '0' ? '0' : `${negative ? '-' : ''}${coefficient}e${scale}`;
};

// Token walk before JSON.parse: duplicate keys and decimal rounding must never
// disappear through parsing. Locations are offsets into the authoritative text.
export function parseSource(text) {
  const locations = new Map(), diagnostics = [];
  const tokenPattern=/(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
  let offset = 0, nodes = 0;
  const fail = message => { const error = new SyntaxError(message); error.offset = offset; throw error; };
  const space = () => { while (/[\t\n\r ]/.test(text[offset] || '\0')) offset++; };
  const string = () => {
    const start = offset++;
    while (offset < text.length) {
      const char = text[offset++];
      if (char === '"') { try { return JSON.parse(text.slice(start, offset)); } catch { fail('String ou escape inválido.'); } }
      if (char === '\\') offset++;
    }
    fail('String não terminada.');
  };
  const value = (keys, depth) => {
    space(); const start = offset, pointer = pointerFor(keys);
    if (++nodes > LIMITS.nodes || depth > LIMITS.depth) fail('Documento excede o limite de valores/profundidade.');
    if (text[offset] === '{') {
      offset++; space(); const seen = new Set();
      if (text[offset] !== '}') while (true) {
        space(); if (text[offset] !== '"') fail('Esperada uma chave entre aspas.');
        const keyStart = offset, key = string(); space();
        if (text[offset++] !== ':') fail('Esperado : após a chave.');
        if (seen.has(key)) diagnostics.push({code:'json.duplicate', severity:'error', pointer:pointerFor([...keys,key]), offset:keyStart, message:`Chave duplicada: ${key}. Corrija o texto antes de converter/exportar.`});
        seen.add(key); value([...keys,key], depth + 1); space();
        if (text[offset] !== ',') break;
        offset++;
      }
      if (text[offset++] !== '}') fail('Esperado }.');
    } else if (text[offset] === '[') {
      offset++; space(); let index = 0;
      if (text[offset] !== ']') while (true) {
        value([...keys,index++], depth + 1); space();
        if (text[offset] !== ',') break;
        offset++;
      }
      if (text[offset++] !== ']') fail('Esperado ].');
    } else if (text[offset] === '"') string();
    else {
      tokenPattern.lastIndex=offset;const token=tokenPattern.exec(text)?.[0];
      if (!token) fail('Esperado um valor JSON.');
      offset += token.length;
      if (/^-?\d/.test(token)) {
        const number = Number(token);
        if (!Number.isFinite(number) || Object.is(number,-0) || decimal(token) !== decimal(String(number))) diagnostics.push({code:'json.number-loss',severity:'error',pointer,offset:start,message:'Número não conserva sua representação decimal ao converter para JavaScript. Corrija ou guarde como texto.'});
      }
    }
    locations.set(pointer, {start, end:offset});
  };
  try { value([],0); space(); if (offset !== text.length) fail('Conteúdo após o fim do JSON.'); return {value:JSON.parse(text), locations, diagnostics}; }
  catch (error) { return {locations, diagnostics:[...diagnostics,{code:'json.syntax',severity:'error',pointer:'',offset:error.offset ?? offset,message:error.message}]}; }
}

export function locateDiagnostic(text, locations, diagnostic) {
  let pointer = diagnostic.pointer || '';
  while (!locations.has(pointer) && pointer) pointer = pointer.slice(0,pointer.lastIndexOf('/'));
  const range = diagnostic.offset != null ? {start:diagnostic.offset,end:diagnostic.offset+1} : locations.get(pointer);
  if (!range) return undefined;
  if(!locations.lineStarts){locations.lineStarts=[0];for(let i=0;i<text.length;i++)if(text[i]==='\n')locations.lineStarts.push(i+1);}
  const starts=locations.lineStarts;let low=0,high=starts.length;
  while(low+1<high){const middle=Math.floor((low+high)/2);if(starts[middle]<=range.start)low=middle;else high=middle;}
  return {...range,line:low+1,column:range.start-starts[low]+1, exact:pointer === diagnostic.pointer};
}
