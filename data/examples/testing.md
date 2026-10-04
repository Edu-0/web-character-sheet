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
