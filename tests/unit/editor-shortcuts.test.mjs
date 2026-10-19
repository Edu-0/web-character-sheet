import test from 'node:test';
import assert from 'node:assert/strict';
import {editorShortcut} from '../../js/editor/keyboard-shortcuts.js';
test('editor shortcuts preserve text editing, IME, repeats and browser-reserved keys',()=>{
 for(const key of ['Delete','d','z','y','a','F2','p','?'])assert.equal(editorShortcut({key,ctrlKey:['d','z','y'].includes(key)},{editing:true}),null);
 for(const guard of ['defaultPrevented','isComposing','repeat'])assert.equal(editorShortcut({key:'Delete',[guard]:true}),null);
 for(const key of ['l','w','t','n'])assert.equal(editorShortcut({key,ctrlKey:true}),null);
 for(const event of [{key:'Delete',altKey:true},{key:'Delete',shiftKey:true},{key:'F10'},{key:'d',ctrlKey:true,shiftKey:true},{key:'y',ctrlKey:true,shiftKey:true},{key:'z',ctrlKey:true,altKey:true},{key:'?',altKey:true},{key:'s',ctrlKey:true,altKey:true},{}])assert.equal(editorShortcut(event),null);
 assert.equal(editorShortcut({key:'d',ctrlKey:true},{area:'data'}),null);
 assert.equal(editorShortcut({key:'s',metaKey:true},{editing:true}),'save');assert.equal(editorShortcut({key:'s',ctrlKey:true,shiftKey:true}),null);
});
test('structural shortcuts are scoped to Ficha while save and history remain available',()=>{
 for(const area of ['overview','data','rules','test','review','code'])for(const key of ['Delete','F2','a','p','Insert'])assert.equal(editorShortcut({key},{area}),null);
 for(const [event,action]of [[{key:'Delete'},'remove'],[{key:'d',metaKey:true},'duplicate'],[{key:'z',ctrlKey:true},'undo'],[{key:'z',metaKey:true,shiftKey:true},'redo'],[{key:'y',ctrlKey:true},'redo'],[{key:'F2'},'rename'],[{key:'a'},'add'],[{key:'Insert'},'add'],[{key:'p'},'properties'],[{key:'F10',shiftKey:true},'context'],[{key:'ContextMenu'},'context'],[{key:'?'},'shortcuts']])assert.equal(editorShortcut(event),action);
});
