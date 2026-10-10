import {el} from './authoring-dom.js';
export const AUTHORING_HELP={
 data:'Dados pertencem ao personagem; catálogos e regras pertencem ao sistema. Escolha fontes existentes ou crie por nome. Uma regra compartilhada afeta todos os componentes vinculados.',
 formula:'Monte operações e escolha fontes. Uma variável liga um nome a um dado, valor ou leitura suportada. Aplicar confirma o cálculo; um erro no exemplo não é convertido em zero.',
 dice:'Uma rolagem é composta por grupos: quantidade de dados e faces, mais um modificador. Efeito vazio e valor zero são escolhas diferentes. Consumo só ocorre quando declarado e habilitado.',
 conditions:'Uma condição de bloqueio compara por igualdade. Requisitos de ação admitem igualdade e mínimo. Filtros de coleção leem cada entrada. Cada consumidor oferece somente suas comparações atuais.',
 checkRoll:'Teste consulta a ficha e produz resultado sem descontar recursos. Escolha o algoritmo que já representa a regra da campanha e registre as decisões manuais. Para desconto, configure consumo ou ação.',
 entryRoll:'Teste e efeito são separados. Escala e consumo usam as fontes declaradas. Use a mesma coleção de usos no contador e no recurso da rolagem para compartilhar o saldo.',
 actions:'Ações executam ao acionar o botão, respeitando requisitos. Recuperação mostra alterações e pede confirmação. Não invente o custo ou a autorização narrativa que o sistema não informa.',
 effectList:'Efeito acrescenta um valor aos alvos suportados, preservando a base. Habilitar versão 2 é explícito. Mudar a semântica exige nova revisão; instâncias antigas não são convertidas silenciosamente.',
 pointBudget:'Criação registra a distribuição inicial. Evolução paga e narrativa têm lançamentos separados. Edição direta durante jogo não cobra pontos. Declare cada custo da campanha, inclusive zero.',
 repertoire:'Repertório acompanha um mínimo garantido e suas distribuições por dado. Não limita outras origens de aprendizado. A técnica referencia a identidade da especialização, não seu nome.',
 techniqueUse:'Usar e rolar paga a energia configurada, inclusive em falha. Concentração e modos dependem dos campos próprios desta família. Resolver resultado usa a mesma dificuldade e oposição do Pool.',
 poolBuilder:'Escolha traços para a Pool. Ápice e Base formam Peso; os restantes oferecem Potência. A dificuldade vem do cálculo compartilhado. A mesa decide a consequência narrativa.',
 stateList:'Estados sobem pela escala de dados. Redução, cura e passagem para estado vinculado seguem o mecanismo atual. As mensagens de Desgaste/Trauma não representam toda condição de todo RPG.',
 inventorySummary:'Carga soma peso vezes quantidade dos itens carregados. Capacidade usa o maior traço/valor base vezes multiplicador. Excesso não aplica penalidade narrativa automaticamente.',
 slotTracker:'O recurso acompanha usos e limite. Mostrar disponível altera a apresentação, preservando o mesmo saldo. Para consumo automático, vincule a rolagem à coleção e à preferência corretas.',
 skillCatalog:'Cada perícia tem um dado base. Categorias são catálogo do sistema; os valores aprendidos ficam no personagem. A escala e permissão de compostos são compartilhadas nos usos compatíveis.',
 traitAllocation:'Um conjunto oferece um dado por traço na mesma ordem. Aplicar substitui esses valores no ensaio. Dados adicionais do mapa permanecem preservados.',
 dnd:'D&D usa seu template, catálogos e cálculos próprios. Comece com uma cópia do pacote em Sistemas. Componentes novos compartilham os dados das apresentações estática, modular e comparação.',
};
export function renderAuthoringHelp(type){
 const details=el('details','','editor-authoring-help');details.append(el('summary','Como configurar e conferir'));
 details.append(el('p','Compor define a ficha e suas regras. Experimentar usa uma amostra isolada. Revise a inclusão, teste o resultado e só então exporte ou aplique pelo fluxo do editor.'));
 const key=type?.startsWith('dnd')?'dnd':['actionGroup','recoveryGroup'].includes(type)?'actions':['list','table'].includes(type)?'entryRoll':type;
 details.append(el('p',AUTHORING_HELP[key]||AUTHORING_HELP.data),el('p','Abrir controles não grava padrões. Texto ainda não aplicado fica no rascunho. Resolver contrato, testar a amostra e aplicar à biblioteca são verificações diferentes.'));
 const link=el('a','Guia de autoria visual');link.href='data/examples/editor-visual.md';link.target='_blank';link.rel='noopener';details.append(link);return details;
}
