# Verificação da autoria geral

Os exemplos de [Aventuras](adventurers.md), [Investigação](investigator.md), [Cartógrafos](cartographers.md) e [Traços](traits.md) são pacotes fictícios para experimentar mecanismos declarativos. As regras desses exemplos são visíveis no documento, e um pacote novo começa vazio. Cada exemplo distingue os controles assistidos das decisões da mesa.

## Reproduzir as verificações técnicas

Execute `npm run test:unit` para contratos e execução sem navegador. Para instrumentação de linhas/ramos/funções, use `node --experimental-test-coverage --test tests/unit/*.test.mjs`. Os módulos de interface que precisam de DOM têm testes de navegador; o percentual Node não mede sua cobertura visual ou semântica.

Use uma única suíte Playwright na porta4173. `npx playwright test --workers=1` percorre a suíte integral; os testes de autoria completa podem levar vários minutos. `npm run check:docs` confere referência, inventário e links; `npm run check:offline` confere os assets públicos e a prévia. Geradores de referência/capacidades/offline precisam ser atualizados quando seus contratos mudam.

As jornadas automatizadas desde vazio ficam em `tests/e2e/editor-general-authoring*.spec.js`. Integração dos exports, operações canceladas, rollback, histórico, consultas e execução offline têm casos próprios. `editor-data-migration.spec.js` cobre migração conjunta, recuperação, aba não salva, edição posterior, quota/journal, revisão cancelável e rascunho. `editor-general-subpath.spec.mjs` verifica execução v3 sem rede em subpasta. Testes automatizados não substituem avaliação humana.

## Desempenho e limites

`node scripts/measure-authoring.mjs` mede o plano puro de migração para100/1000/10000 personagens e compilação/avaliação/cache/invalidação de regras. O resultado fica em `tmp/authoring-measurements.json`, com CPU, memória, sistema operacional, Node, amostras, mediana, p95 e pior caso. O arquivo é local e não faz parte da biblioteca ou dos pacotes. Cinco ou dez amostras são medições exploratórias; não demonstram um SLA nem representam todos os documentos.

`npx playwright test tests/e2e/editor-general-performance.spec.mjs tests/e2e/editor-visual-performance.spec.mjs --workers=1` registra métricas do navegador em `test-results`: validação, índice de vínculos, montagem da vista, paginação, diagrama, consultas e invalidação; também documentos de4MiB/profundidade32/100000 valores e repeat legado de10000. Mede cenários válidos e a recusa dos que ultrapassam tetos. Cache aquecido e primeiro acesso aparecem nas amostras; não compare porcentagens entre máquinas ou populações diferentes sem repetir o mesmo cenário.

O contrato atual admite100 regras por sistema e coleções tipadas de até1000 entradas. O repeat legado tem limites próprios. Dez mil vínculos podem caber em um documento, mas isso não aumenta o teto de regras ou nós: os limites documentais continuam agregados. O grafo apresenta até200 fontes e os vínculos por menus são paginados. A revisão de migração trabalha em fatias de25 personagens com progresso/cancelamento; seu plano é o mesmo consumido pelo instalador. A confirmação continua uma gravação atômica, sem cancelamento no meio da transação.

## O que os resultados significam

Os testes verificam cenários definidos, preservação dos documentos e fronteiras de execução. Não comprovam segurança absoluta, autoria universal, compreensão por iniciantes ou acessibilidade em todos os dispositivos. Medições de latência, capturas, impressão automatizada e toque emulado precisam ser distinguidos de revisão visual e sessões físicas/assistivas reais.

Para uso, consulte [autoria visual](editor-visual.md), [dados tipados](typed-data.md), [migração e restauração](data-migration.md), [operações e cálculos](rule-queries.md).
