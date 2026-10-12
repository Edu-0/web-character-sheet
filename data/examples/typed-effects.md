# Efeitos tipados e projeções

Em **Compor → Efeitos tipados e projeções**, crie uma definição, escolha um dado ou cálculo e acrescente operações pelo construtor visual. O pacote não recebe efeitos ao abrir. A receita usa a mesma sessão, validação, confirmação, histórico e rascunho do editor. Texto numérico inválido permanece pendente, é recuperável e bloqueia aplicação/exportação até correção ou descarte.

O perfil novo exige sistema e personagem v3. Habilitar um personagem antigo pede confirmação e preserva uma cópia; abrir/importar não o converte. Definições ficam em `system.effectDefinitions`, instâncias em `character.activeEffects`, junto dos efeitos antigos. O perfil legado continua descrito em [Efeitos numéricos](effects.md).

## Base e valor efetivo

A base permanece armazenada e editável. O valor efetivo é uma projeção somente de leitura, mostrada junto do campo e nos cálculos compatíveis. Fontes de operações oferecem **Base armazenada** ou **Efetivo com projeções de efeitos**. Leitura de dado usa base por padrão; fonte de cálculo usa automático por padrão. Escolher efetivo é explícito. Cálculos contínuos não gastam usos, não rolam dados e não escrevem na ficha.

Alvos atuais: dados globais de número, inteiro, texto, booleano, enum ou traço, incluindo campos de registros globais; cálculos globais com resultado número, texto ou booleano. Campos sob coleções e cálculos por entrada não são alvos deste perfil. Substituição respeita o tipo, opções, escala e restrições do alvo. Traço composto conserva seus dados; multiplicar um traço como número é recusado. As operações `trait` e `traitDice` constroem um traço pela escala declarada e extraem seus tamanhos explicitamente para consultas numéricas.

## Ordem e conflitos

A ordem numérica é base → substituição vencedora → multiplicadores → somas → limites → ajuste manual/fixo do cálculo. Por exemplo, substituir por 10, multiplicar por 2 e somar 3 produz 23; limite máximo 20 produz 20. Ajuste +1 do cálculo produz 21; fixo 4 prevalece. Dados-base não recebem o ajuste de cálculo.

Substituição de maior prioridade vence; duas da mesma prioridade com valores diferentes geram conflito visível. A prévia bloqueia confirmação se o resultado proposto continuar inválido. Ordem de ativação não desempata valores diferentes. Substituições suprimidas não consultam suas fontes. Para traços: substituir e depois deslocar na escala, selecionando todos, maior, menor ou uma posição; borda limitada ou recusada deve ser declarada.

Empilhamento: uma instância; acumular até N; maior magnitude; menor magnitude; ou grupo exclusivo. Maior/menor exige uma operação numérica de magnitude explícita; grupo pode reunir definições compatíveis. Grupo exclusivo exige encerramento anterior, sem apagar outra instância automaticamente. Resumos indicam projeções aplicadas e suprimidas. `allowWhen` autoriza ativação; `when` controla aplicação da projeção. Ciclos entre efeito, cálculo e condição são recusados, incluindo ramos não tomados.

## Usos, eventos e transação

Escolha duração manual, N usos ou N confirmações de um evento nomeado. Uso pode significar resolução comprometida, mesmo em falha, ou sucesso final explicitamente declarado pela ação. Somente instâncias consultadas/aplicadas à execução participam do consumo. Preparar, cancelar e atualizar a tela não gastam usos. O resultado usa a projeção anterior ao consumo.

Custo, resultado, registro e consumo/expiração entram no candidato da mesma transação existente. Falha de gravação conserva recursos e instâncias; repetir a confirmação reaproveita as faces guardadas. Desfazer restaura os usos e recursos; refazer não rola novamente. O registro de ação inclui as instâncias usadas e mudanças de contador. Encerrar/remover exige comando próprio; remover instância ativa é recusado.

**Eventos de efeitos** abre a prévia causal existente. Um efeito de duas confirmações de `round` expira só depois das duas confirmações, junto da cadeia do evento. Não há relógio, fim de rodada inferido, consumo por abrir/importar/recarregar ou evento disparado por desfazer/refazer.

Custos continuam lendo saldos-base. Um autor pode usar efetivo explicitamente na expressão de quantidade, mantendo o orçamento e as guardas comuns. Recuperação que precisa de máximo efetivo pode usar um cálculo tipado que declare essa leitura; efeitos não tornam toda fonte legada efetiva automaticamente. [Ações](action-flows.md) e [eventos](rule-events.md) descrevem os perfis de confirmação.

## Contrato e limites

Definição: `profile: "typed"`, `version: 1`, identidade/rótulo/revisão/prioridade, `stacking`, duração e operações. Cada operação tem identidade, tipo e alvo `{kind: "data", dataId}` ou `{kind: "rule", ruleId}`. Tipos: `replace`, `multiply`, `add`, `clamp`, `shiftTrait`. Valores vêm do mesmo AST limitado das regras; não há scripts. Prioridade −10000…10000; revisão 1…1000000; até 100 definições e instâncias, 20 operações por definição, 100 instâncias acumuladas e 1000 usos/eventos. Budgets do interpretador e limites gerais de documento continuam aplicáveis.

Instância guarda perfil, definição/revisão, rótulo, estado e duração com contador restante. Semântica alterada exige aumentar a revisão; uma instância ativa incompatível bloqueia substituição do pacote. Instâncias encerradas de revisão indisponível permanecem com aviso, sem descarte automático. Exportação/reimportação conserva definições, bases, instâncias e contadores.

## Verificação e alcance

`tests/unit/typed-effects.test.mjs` verifica precedência, conflitos, bases, tipos, ciclos, uso participante, empilhamento e intenções de condições. `tests/e2e/editor-typed-effects.spec.js` constrói efeitos e ações desde pacote vazio pela interface: d6→d8 por um uso, custo, cancelamento, desfazer/refazer, recarga, exportação/reimportação, quota/retry, limite numérico, evento confirmado e rascunho inválido. O painel de prévia também é exercitado por teclado nas doze aparências e larguras 360/768/1280.

Não há cobertura declarada de qualquer livro, efeitos por entrada de coleção, scripts, tempo real, decisão narrativa, dispositivos físicos ou leitores de tela reais. Testes de aparência e teclado não comprovam compreensão de iniciantes. A referência [gerada](components-reference.json) aponta para os contratos e hashes atuais.
