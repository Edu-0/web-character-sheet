# Verificação do projeto

Execute apenas uma suíte Playwright por vez; todas usam a porta 4173 e contextos isolados, sem acessar a biblioteca pessoal. Pare o servidor manual antes. O setup gera o worker offline uma vez por execução, inicia o servidor e o fecha ao terminar.

| Comando | Quando usar | Cobertura |
| --- | --- | --- |
| `npm run test:unit` | Ao editar regra ou contrato | Regras determinísticas, extremos, limites de segurança e validação de todos os pacotes; sem navegador |
| `npm run test:quick` | Durante implementação | Node e seleção `@smoke`: shell, sistemas antigos/novos, persistência/JSON, sincronização D&D, desfazer, componente importado, importação perigosa e rollback de quota |
| `npm run test:full` | Antes de concluir mudança integrada | Node, todos os Playwright, links de documentação e cache offline atualizado |
| `npx playwright test tests/e2e/additional-systems.spec.js --grep fate-accelerated --workers=1` | Validar uma etapa | Fluxo do sistema e temas/responsividade; substitua o ID pelo desejado |

`test:e2e` continua disponível para toda a cobertura de navegador. Os testes rápidos são um subconjunto da mesma suíte, sem arquivos duplicados. Visual, PDF, PWA, casos extensos e regressões específicas continuam na completa. Falhas não são ocultadas com retries ou testes pulados.

A revisão moveu limites de JSON/caminhos e o avaliador de fórmulas do `page.evaluate` para Node; a importação real com mensagem de fórmula inválida continua em Playwright. A verificação do D&D modular inicial foi incorporada ao fluxo de exportação/importação, preservando seus asserts e evitando outra abertura idêntica. Os novos sistemas compartilham um percurso parametrizado; regras-limite são exercitadas sem repetir jornadas de interface para cada combinação de dados.

Capturas e traces ficam em `test-results/`, ignorados pelo Git. Aprovação automatizada não substitui revisão visual; registre quais capturas foram realmente inspecionadas. PDFs de regressão gerados por testes não significam que houve revisão manual de todas as páginas.

## Botões de teste e resultados

O [exemplo completo de botões](check-buttons.package.json) é fictício. Layout v2 pode configurar `roll: {check: "action", sourceId: "base"}` em number/counter/die/computed e list. A fonte precisa ter ID explícito em system.checks e corresponder ao campo/cálculo ou à coleção numérica. Não se deduz um teste de qualquer número. IDs ausentes conservam a leitura legada por índice no painel; botões de entrada sem ID ficam indisponíveis, sem inventar identidade nem alterar os dados.

Fonte de fórmula pode declarar overrideKey (sufixo de computed) e variables com field/system/traitMaxField/value. O validador exige um cálculo compatível em algum layout. O valor e suas dependências são resolvidos pelo mesmo computedValue. Botão e checkRoll relêem fontes no clique e reutilizam prepareCheck; nomes não servem de referência.

Histórico permanece transitório, limitado a 20 resultados. snapshot/resolution com versão interna 1 preservam fonte, opções, efeitos e resultado estruturado (incluindo desafios/critical/grupos quando existentes), sem recalcular após expiração/edição. Não entra em JSON/backup por padrão. Campos antigos da bandeja continuam disponíveis.

entryRolls prepara expressão, resultado e disponibilidade antes de debitar recurso e salvar opções. Falha no dado não debita nem publica resultado. A edição confirmada de custo/opções gera uma notificação; autosave mantém seu tratamento de falhas e orientação para exportar. Rolar efeito separado continua sem cobrar a ação novamente. Modificador manual de entryRolls substitui a fonte automática, enquanto o de checkRoll é adicional.

Não há botão novo em table/stateList/texto livre, nem automação de Benes/queima de ímpeto/invocação Fate. Técnicas/Pool autorais continuam no mecanismo existente.

## Fonte aleatória

`rollOne` em `js/engine/dice-resolver.js` usa `crypto.getRandomValues()` e amostragem por rejeição: intervalos inteiros iguais para cada face, descartando a sobra de 32 bits. Falta/erro da API impede gerar resultado, sem fallback para Math.random. A função aceita de 1 a 2³² faces; os consumidores mantêm seus limites próprios (expressões: 2 a 100 mil). Não há alteração de schemas, regras, custos ou dados salvos.

Node testa fronteiras dos intervalos, rejeição, faces inválidas, erro/ausência da fonte e uso real de crypto. Playwright confere engine/bandeja com Math.random bloqueado, rolagem sem rede e falhas sem débito. Casos determinísticos simulam getRandomValues; algoritmos puros continuam aceitando dados injetados. Esses testes provam conversão/integração, não certificam estatisticamente o gerador nem autenticidade de resultados compartilhados.
