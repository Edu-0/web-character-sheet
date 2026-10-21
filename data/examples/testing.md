# Verificação do projeto

Os contratos de [ações tipadas](action-flows.md) têm testes Node de admissão, custos, conflitos, presença, transcripts, limites e marcos. A suíte `editor-action-flows.spec.js` cria as regras pela interface desde um pacote vazio e verifica prévia/cancelamento, os dois perfis, histórico causal, recarga, quota/retry sem novo RNG, exportação/reimportação, arquivo e habilitação v3 explícita. A inspeção do documento é somente uma asserção; as regras desses percursos não são injetadas pelo JSON.

Execute apenas uma suíte de navegador por vez na porta 4173, usando contextos isolados, sem acessar a biblioteca pessoal. Pare o servidor manual antes. O setup gera o worker offline uma vez por execução, inicia o servidor e o fecha ao terminar. Os testes desktop usam o protocolo interno e perfis fictícios próprios; o smoke do portátil usa uma porta de depuração local temporária.

| Comando | Quando usar | Cobertura |
| --- | --- | --- |
| `npm run test:unit` | Ao editar regra ou contrato | Regras determinísticas, extremos, limites de segurança e validação de todos os pacotes; sem navegador |
| `npm run test:quick` | Durante implementação | Node e seleção `@smoke`: shell, sistemas antigos/novos, persistência/JSON, sincronização D&D, desfazer, componente importado, importação perigosa e rollback de quota |
| `npm run test:full` | Antes de concluir mudança integrada | Node, todos os Playwright, links de documentação e cache offline atualizado |
| `npm run test:desktop` | Após `build:desktop` em Windows | Pacote real: offline, renderer isolado, D&D estática/modular/comparação, prévia do editor, guias, temas e persistência após reabrir, em perfil fictício |
| `npx playwright test tests/e2e/additional-systems.spec.js --grep fate-accelerated --workers=1` | Validar uma etapa | Fluxo do sistema e temas/responsividade; substitua o ID pelo desejado |

`test:e2e` continua disponível para toda a cobertura de navegador. Os testes rápidos são um subconjunto da mesma suíte, sem arquivos duplicados. Visual, PDF, PWA, casos extensos e regressões específicas continuam na completa. Falhas não são ocultadas com retries ou testes pulados.

A revisão moveu limites de JSON/caminhos e o avaliador de fórmulas do `page.evaluate` para Node; a importação real com mensagem de fórmula inválida continua em Playwright. A verificação do D&D modular inicial foi incorporada ao fluxo de exportação/importação, preservando seus asserts e evitando outra abertura idêntica. Os novos sistemas compartilham um percurso parametrizado; regras-limite são exercitadas sem repetir jornadas de interface para cada combinação de dados.

Capturas e traces ficam em `test-results/`, ignorados pelo Git. Aprovação automatizada não substitui revisão visual; registre quais capturas foram realmente inspecionadas. PDFs de regressão gerados por testes não significam que houve revisão manual de todas as páginas.

## Botões de teste e resultados

O [exemplo completo de botões](check-buttons.package.json) é fictício. Layout v2 pode configurar `roll: {check: "action", sourceId: "base"}` em number/counter/die/computed e list. A fonte precisa ter ID explícito em system.checks e corresponder ao campo/cálculo ou à coleção numérica. Não se deduz um teste de qualquer número. IDs ausentes conservam a leitura legada por índice no painel; botões de entrada sem ID ficam indisponíveis, sem inventar identidade nem alterar os dados.

Fonte de fórmula pode declarar overrideKey (sufixo de computed) e variables com field/system/traitMaxField/value. O validador exige um cálculo compatível em algum layout. O valor e suas dependências são resolvidos pelo mesmo computedValue. Botão e checkRoll relêem fontes no clique e reutilizam prepareCheck; nomes não servem de referência.

O histórico de rolagens legado permanece transitório, limitado a 20 resultados. Seus snapshots/resolutions com versão interna 1 preservam fonte, opções, efeitos e resultado estruturado (incluindo desafios/critical/grupos quando existentes), sem recalcular após expiração/edição; esse histórico não entra em JSON/backup por padrão. Os registros persistidos de [ações v3](action-flows.md) têm contrato próprio e acompanham o personagem exportado. Campos antigos da bandeja continuam disponíveis.

entryRolls prepara expressão, resultado e disponibilidade antes de debitar recurso e salvar opções. Falha no dado não debita nem publica resultado. A edição confirmada de custo/opções gera uma notificação; autosave mantém seu tratamento de falhas e orientação para exportar. Rolar efeito separado continua sem cobrar a ação novamente. Modificador manual de entryRolls substitui a fonte automática, enquanto o de checkRoll é adicional.

Não há botão novo em table/stateList/texto livre, nem automação de Benes/queima de ímpeto/invocação Fate. Técnicas/Pool autorais continuam no mecanismo existente.

## Fonte aleatória

`rollOne` em `js/engine/dice-resolver.js` usa `crypto.getRandomValues()` e amostragem por rejeição: intervalos inteiros iguais para cada face, descartando a sobra de 32 bits. Falta/erro da API impede gerar resultado, sem fallback para Math.random. A função aceita de 1 a 2³² faces; os consumidores mantêm seus limites próprios (expressões: 2 a 100 mil). Não há alteração de schemas, regras, custos ou dados salvos.

Node testa fronteiras dos intervalos, rejeição, faces inválidas, erro/ausência da fonte e uso real de crypto. Playwright confere engine/bandeja com Math.random bloqueado, rolagem sem rede e falhas sem débito. Casos determinísticos simulam getRandomValues; algoritmos puros continuam aceitando dados injetados. Esses testes provam conversão/integração, não certificam estatisticamente o gerador nem autenticidade de resultados compartilhados.

## Autoria visual

`tests/unit/editor-visual*.test.mjs` e `editor-rule-authoring.test.mjs` conferem planos, preservação e contratos das receitas contra a engine. Os percursos `editor-canvas.spec.js`, `editor-visual.spec.js`, `editor-rule-authoring.spec.js`, `editor-visual-access.spec.mjs` e `editor-visual-performance.spec.mjs` cobrem autoria, movimento, famílias de regras, pending/recuperação, pacote, modos, temas e uso offline. Os testes leem o pacote apenas para assertions; as jornadas de autoria usam seletores e construtores, sem abrir JSON ou digitar expressão/caminho/chave técnica. Fixtures de pacotes complexos não contam como criação integral pela UI.

Acesso inclui teclado/toque emulado, seis paletas nos dois temas, 360/768/1280 e zoom de 200%. Desempenho mede 4 MiB, profundidade 32, limite de nós e repeat com 10000 instâncias; tempos são da máquina de teste. Capturas devem ser revistas após alterações de composição. Não equivalem a ensaio físico, certificação de leitor de tela ou resultado humano com iniciantes. A avaliação formativa com participantes permanece pendente; scripts e fluxos automatizados continuam independentemente.

Registro histórico do marco P1 em 10/10/2026: **128/128 Node** e **375/380 Playwright** na regressão completa (Edge, dois workers, 25,1 min), durante a qual houve interrupção de energia informada pelo usuário. Cinco casos falharam em abertura, montagem, foco ou encerramento do navegador; todos passaram três vezes em reteste sequencial **15/15** (um worker, 1,1 min), sem mudar runtime, timeouts ou retries. Isso não equivale a 380/380 numa única execução. Checks de referência, inventário, documentação, prévia gerada e offline aprovados. Nenhuma falha funcional restante nos casos retestados.

## Último fechamento funcional registrado — 15/10/2026

A autoria geral foi encerrada com **373/373 Node** e **486 casos Playwright únicos**: 296 aprovados antes de uma pausa solicitada e 190/190 na retomada, sob os mesmos 404 hashes de fonte/testes. São duas execuções, sem footer de uma integral ininterrupta de 486 casos. Os resultados de 10/10 acima são históricos. Consulte [evidências, cobertura e limitações](authoring-validation.md); essa aprovação não substitui avaliação com participantes ou aparelhos físicos.

Durante alterações, selecione testes dos contratos e percursos afetados; nos marcos integrados e no encerramento execute a regressão pertinente. Para uma execução sequencial com um worker, use `npm run test:unit`, depois `npx playwright test --workers=1`, `npm run check:docs` e `npm run check:offline`. Jornadas extensas podem demorar vários minutos. Uma alteração apenas documental exige os checks de documentação e derivados, sem atribuir nova data aos testes funcionais históricos.
