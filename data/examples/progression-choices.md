# Criação, evolução e concessões tipadas

Em **Compor → Criação, evolução e concessões**, escolha dois dados numéricos para os orçamentos de criação e evolução. Acrescente opções, suas origens permitidas, requisitos, custo e benefícios. Use escolhas subordinadas quando a aquisição exigir, por exemplo, exatamente um entre dois talentos. Os custos e valores concedidos usam o mesmo construtor de operações das regras.

O pacote começa sem essa configuração. A receita confirma a inclusão dos controles nos layouts e de v3 nos novos personagens; não converte personagens existentes ao abrir. Habilitar registros v3 em personagem antigo preserva uma cópia com confirmação. O perfil autoral antigo de `pointBudget` continua funcionando separadamente.

## Origens e preços

**Criação** usa o orçamento inicial. **Evolução paga** usa o orçamento evolutivo, depois da criação concluída. **Concessão narrativa** registra custo zero e preserva o orçamento, inclusive se o dado opcional estiver ausente. Requisitos continuam sendo verificados. Editar um nível, traço ou contador diretamente não compra uma opção nem lança despesa.

Os preços devem ser declarados. A operação **Custo cumulativo pelos passos** recebe patamar inicial/final, escala de um traço e catálogo com três campos numéricos: origem, destino e preço. Reutiliza o cálculo cumulativo existente. Uma tabela com 0→4=4, 4→6=1 e 6→8=2 produz custo 3 desde d4 ou 7 desde zero. Preço zero é válido; transição ausente, duplicada, negativa ou patamar fora da escala bloqueia. Não há tabela de RPG ou preço universal embutido na receita.

Cada aquisição guarda o preço usado e o snapshot da opção. Alterar a tabela não recalcula lançamentos anteriores. Concluir criação guarda gastos, sobra, aquisições e valores iniciais por identidade; sobra não vira evolução. Reabrir exige política explícita e ausência de histórico evolutivo, conservando o snapshot anterior.

## Requisitos e escolhas

Uma opção pode exigir predicado compartilhado e aquisições anteriores. O compilador recusa pré-requisitos inexistentes e ciclos. Origem, limite de aquisições, requisitos e cardinalidade são relidos ao preparar a prévia. Seleção duplicada ou duas alternativas quando o máximo é um são recusadas antes de pagamento.

A opção de avanço pode conceder nível 2 e exigir a aquisição de nível 1, experiência suficiente e exatamente um talento. A concessão de nível 2 pode substituir a concessão do nível anterior porque declara essa dependência. Fontes independentes com substituições incompatíveis geram conflito. Não há resolução implícita pela ordem de inclusão.

## Benefícios e origem

Concessões permitem definir valor escalar/traço, somar contribuição numérica ou inserir entrada de coleção com campos declarados. Alvos são dados globais, incluindo filhos de registros globais; entradas de coleções usam inserção com identidade própria. Cada concessão guarda origem, identidade e snapshot para retirada limitada.

Para conceder uma ação, vincule o benefício ao dado de permissão ou contador de usos da ação. A associação à ação registra a proveniência; a receita não cria custo ou autorização ocultos. Por exemplo, uma alternativa concede +1 no contador de Talento A, e a ação A declara custo de um nesse contador. A alternativa B usa seu próprio contador. A aquisição concede somente o benefício escolhido.

Revogação tem prévia e política explícita de devolução ou ausência de devolução. Uma aquisição dependente precisa ser revogada antes da origem. Outra fonte idêntica de substituição permanece; retirar a última restaura a base anterior. Retirar avanço restaura a concessão anterior. Contribuições usadas/editadas e entradas alteradas/removidas bloqueiam a revogação, preservando a alteração da mesa. Entradas manuais e de outra origem não são apagadas. Isso não implementa respec arbitrário ou multiclasses.

## Confirmação, histórico e arquivos

A prévia reúne custo, seleção e benefícios num candidato. Confirmar usa os mesmos patches, validação, gravação, journal e histórico do app; cancelar não escreve. Falha de quota conserva orçamento e benefício, e repetir a confirmação não duplica a compra. Mudança do personagem ou pacote enquanto a prévia está aberta exige preparar novamente.

Desfazer/refazer cobre a aquisição inteira. Edição posterior conflitante impede apagar o que a mesa alterou. Recarregar conserva o personagem e seus registros; o histórico de desfazer da sessão é reiniciado conforme o [contrato comum](history.md). Pacote e personagem exportados preservam escolhas, preços, snapshots e proveniência; importação valida formatos sem realizar compras.

O editor usa a mesma sessão e os rascunhos existentes. Número inválido em custo ou cardinalidade continua como texto pendente, bloqueia aplicação/exportação, pode ser recuperado e exige correção ou descarte explícito. Árvores de expressão mostram operações e fontes reais, sem scripts. [Consultas](rule-queries.md), [ações](action-flows.md) e [dados estruturados](structured-data.md) detalham os contratos relacionados.

## Contrato e limites

`system.progressionChoices` tem versão 1, revisão, identidades dos dois orçamentos, política de reabertura/revogação e opções. Cada opção tem identidade/rótulo, origens, pré-requisitos, predicado opcional, limite, custos por origem, concessões e escolhas subordinadas. O componente `progressionChoices` aponta para essa configuração. `character.progressionLedger` é opcional e reservado: fase, aquisições, snapshot inicial e snapshots anteriores.

Até 100 opções; 20 escolhas, alternativas e concessões por ramo; 500 definições de concessão no pacote; 100 concessões por aquisição; 100 registros e 256 KiB de ledger; 20 snapshots de reabertura. Não há expurgo automático. Budgets do interpretador e limites gerais dos documentos também se aplicam. Limite atingido produz diagnóstico, preservando dados.

`tests/unit/progression-choices.test.mjs` cobre fases, preços, pré-requisitos, cardinalidade, snapshots, proveniência, conflitos, entradas e importação. `tests/e2e/editor-progression-choices.spec.js` configura carreira e talentos desde vazio pela UI, executa aquisição paga/narrativa, ação concedida, cancelar, revogar, desfazer/refazer, recarga, pacote exportado/reimportado, quota/retry, rascunho inválido e custo cumulativo. A prévia também é exercitada por teclado nas doze aparências e três larguras.

Sem alegação de compreensão de iniciantes, dispositivos físicos, leitores de tela reais ou automação integral de um livro. Novas concessões narrativas continuam sendo decisões da mesa.
