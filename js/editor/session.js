import { validateText, VALIDATOR_VERSION } from './validation.js';
import { EditorHistory } from './history.js';
import { applyOperations } from './operations.js';

export class EditorSession {
  constructor({text,source={kind:'new',base:null},draftId=crypto.randomUUID(),revision=0,lastValid=null,ui={},createdAt=new Date().toISOString(),recoveryOriginalText,lastApplied} = {}) {
    this.text=text; this.source=structuredClone(source); this.draftId=draftId; this.revision=revision; this.ui=ui; this.createdAt=createdAt;
    this.history=new EditorHistory(); this.lastValid=null; this.lastSavedRevision=-1;
    this.recoveryOriginalText=recoveryOriginalText;this.lastApplied=lastApplied;
    if(lastValid){const checked=validateText(lastValid.text);if(checked.status==='ready')this.lastValid={...structuredClone(lastValid),package:structuredClone(checked.document),validatorVersion:VALIDATOR_VERSION};}
    this.validate();
  }
  replaceText(text,options={}) {
    if (options.expectedRevision!=null && options.expectedRevision!==this.revision) throw new Error('Revisão mudou; operação cancelada.');
    if (text===this.text) return;
    this.history.record(this.text,text,options); this.text=text; this.revision++;
  }
  operate(commands,{expectedRevision=this.revision,...options}={}) { this.replaceText(applyOperations(this.text,commands),{expectedRevision,...options}); this.validate(); }
  acceptValidation(result,revision,text) {
    if (revision!==this.revision || text!==this.text) return false;
    this.validation=result;
    if (result.status==='ready') this.lastValid={revision,text,package:structuredClone(result.document),validatorVersion:VALIDATOR_VERSION};
    return true;
  }
  validate() { const result=validateText(this.text); this.acceptValidation(result,this.revision,this.text); return result; }
  normalize(expectedRevision=this.revision) {
    const result=this.validate(); if (result.status!=='needsMigration') throw new Error('Não há normalização disponível.');
    if(expectedRevision!==this.revision)throw new Error('Revisão mudou; operação cancelada.');
    this.recoveryOriginalText=this.text;this.replaceText(JSON.stringify(result.document,null,2),{expectedRevision,label:'Normalizar aliases'}); this.validate();
  }
  replay(direction) { const text=this.history.replay(direction,this.text); if (text!==this.text) {this.text=text;this.revision++;this.validate();} }
  restoreValid() { if (!this.lastValid) throw new Error('Nenhuma versão válida.'); this.replaceText(this.lastValid.text,{label:'Restaurar última válida'}); this.validate(); }
  envelope() { return {kind:'rpg-editor-draft',schemaVersion:1,draftId:this.draftId,createdAt:this.createdAt,updatedAt:new Date().toISOString(),revision:this.revision,source:structuredClone(this.source),text:this.text,lastValid:structuredClone(this.lastValid),lastSavedRevision:this.revision,lastApplied:this.lastApplied || null,ui:structuredClone(this.ui),...(this.recoveryOriginalText?{recoveryOriginalText:this.recoveryOriginalText}:{})}; }
}
