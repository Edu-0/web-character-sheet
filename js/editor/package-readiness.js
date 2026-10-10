import {el,button} from './authoring-dom.js';
import {identityImpact} from './references.js';
export function readiness(session,{previewCurrent=false,runtimeError}={}){
 const result=session.validation,pending=Object.keys(session.ui.formPending||{}).length,valid=result.status==='ready';
 return {valid,pending,previewCurrent,canExport:valid&&!pending,canApply:valid&&!pending&&previewCurrent&&!runtimeError,lastValidRevision:session.lastValid?.revision,impact:valid?identityImpact(session.source.base,result.document):null};
}
export function renderReadiness(host,editor){
 const state=readiness(editor.session,{previewCurrent:editor.lastRenderedCurrent,runtimeError:editor.runtimeError});host.replaceChildren(el('h3','Conferir pacote antes de fechar'));
 const list=el('ul');for(const text of [state.valid?'Contrato da revisão atual válido.':'Corrija os diagnósticos da revisão atual.',state.pending?state.pending+' campo(s) pendente(s): aplique ou descarte cada campo.':'Nenhum campo aplicado pela metade nos formulários.',state.previewCurrent?'Ensaio corresponde à revisão e ao layout selecionados.':'Atualize o ensaio para conferir a revisão atual antes de aplicar.',editor.runtimeError?'Erro do ensaio: '+editor.runtimeError:'Amostra de ensaio fica fora da exportação.'])list.append(el('li',text));host.append(list);
 if(state.impact)host.append(el('p','Layouts removidos desde a origem: '+(state.impact.removedLayouts.join(', ')||'nenhum')+'. Aplicação usa o preflight existente, com impacto e confirmação. Original do catálogo e personagens permanecem protegidos pelo fluxo da biblioteca.'));
 host.append(el('p','Salvar rascunho conserva texto e interface, inclusive pendências. Exportar pacote usa a revisão atual; Exportar última versão válida é uma escolha diferente. Para uma receita em preparação entrar no pacote, revise e confirme sua inclusão.','editor-note'));
 const exportButton=button('Exportar revisão conferida',()=>editor.run(()=>editor.exportPackage())),applyButton=button('Aplicar pelo fluxo da biblioteca',()=>editor.run(()=>editor.applyPackage()));exportButton.disabled=!state.canExport;applyButton.disabled=!state.canApply;host.append(exportButton,applyButton,button('Preservar rascunho completo',()=>editor.run(()=>editor.saveDraft())),button('Exportar última válida separadamente',()=>editor.run(()=>editor.exportPackage(true))));
}
