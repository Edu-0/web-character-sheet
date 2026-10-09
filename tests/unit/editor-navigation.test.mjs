import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {parseSource} from '../../js/editor/source-map.js';
import {previewSources,sourceAtOffset,textareaOffset,sourceOffset} from '../../js/editor/source-navigation.js';

test('origem usa índices reais, não IDs/rótulos/campos, e seleciona bloco inteiro',()=>{
  const pkg=minimalPackage('navigation');pkg.layouts.unshift({...structuredClone(pkg.layouts[0]),id:'other'});
  const component=pkg.layouts[1].tabs[0].sections[0].containers[0].components[0];
  component.label='Duplicado / ~';pkg.layouts[1].tabs[0].sections[0].containers[0].components[1].label=component.label;
  pkg.extra={'/layouts/1/tabs/0':false};
  const text=JSON.stringify(pkg,null,2),{locations}=parseSource(text),sources=previewSources(pkg,'default');
  const pointer='/layouts/1/tabs/0/sections/0/containers/0/components/0';
  const offset=locations.get(pointer+'/label').start+2;
  assert.equal(sourceAtOffset(locations,sources,offset),pointer);
  assert.deepEqual(JSON.parse(text.slice(locations.get(pointer).start,locations.get(pointer).end)),component);
  assert.equal(sourceAtOffset(locations,sources,locations.get('/extra').start),undefined);
  assert.equal(sourceAtOffset(locations,sources,locations.get('/layouts/0').start),undefined);
});

test('abas, seções, containers e margens mantêm sua definição externa própria',()=>{
  const pkg=minimalPackage('navigation'),{locations}=parseSource(JSON.stringify(pkg)),sources=previewSources(pkg,'default');
  for(const [property,expected]of [
    ['/layouts/0/id','/layouts/0'],['/layouts/0/tabs/0/label','/layouts/0/tabs/0'],
    ['/layouts/0/tabs/0/sections/0/title','/layouts/0/tabs/0/sections/0'],
    ['/layouts/0/tabs/0/sections/0/containers/0/layout/type','/layouts/0/tabs/0/sections/0/containers/0'],
  ])assert.equal(sourceAtOffset(locations,sources,locations.get(property).start),expected);
  assert.equal(sourceAtOffset(locations,sources,locations.get('/system/formulas/total').start),undefined);
});

test('repeat mapeia a definição original uma vez, inclusive zero entradas e cabeçalho oculto',()=>{
  const pkg=minimalPackage('navigation');pkg.layouts[0].showHeader=false;
  pkg.layouts[0].tabs[0].sections[0].containers[0].repeat={source:'catalog'};pkg.system.catalog=[];
  const sources=previewSources(pkg,'default');
  assert.equal([...sources.keys()].filter(pointer=>pointer.includes('/components/')).length,4);
  assert.ok(!sources.has('/system/name'));assert.ok(!sources.has('/system/characterTemplate'));
  assert.equal(previewSources(pkg,'absent').size,0);
});

test('offsets de textarea traduzem CRLF sem alterar Unicode, CR isolado ou escapes JSON',()=>{
  const raw='\r\n{\r\n"emoji":"🎲\\r\\n",\r"value":false\n}';
  const display=raw.replaceAll('\r\n','\n').replaceAll('\r','\n');
  for(let offset=0;offset<=display.length;offset++)assert.equal(textareaOffset(raw,sourceOffset(raw,offset)),offset);
  const start=raw.indexOf('false'),end=start+5;
  assert.equal(display.slice(textareaOffset(raw,start),textareaOffset(raw,end)),'false');
  assert.equal(raw,'\r\n{\r\n"emoji":"🎲\\r\\n",\r"value":false\n}');
});
