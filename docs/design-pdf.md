# PDF com a identidade da ficha

Este relatório registra a revisão anterior ao checkpoint `2249f83`. A implementação posterior de Completo/Compacto e suas verificações atuais estão em [perfis de impressão](perfis-impressao.md).

Segunda revisão, em 2 de outubro de 2026, após o pedido do usuário para que o PDF deixasse a aparência de documento administrativo e herdasse o design da página. Substitui a decisão inicial de impressão monocromática sem ornamentos. O conteúdo continua independente da navegação, dos filtros e da apresentação D&D.

## Composição

- Fontes já usadas pelo projeto, respeitando a variante do layout. D&D conserva títulos serifados; o layout autoral editorial usa títulos sem serifa.
- Paleta escolhida em sua versão clara para papel: tinta escura, fundo branco, superfícies suaves e acentos coerentes. Resolver esses tokens não altera a página nem as preferências.
- Cabeçalho com identidade, nome completo, retrato existente e ornamentos ativos em espaço reservado. Nenhuma arte é colocada atrás dos valores; as três posições e a intensidade continuam sendo respeitadas.
- Capítulos numerados, títulos coloridos, cartões de valores e bordas suaves de agrupamento. Perícias usam quatro colunas compactas; inventários extensos têm registros compactos de três colunas.
- Textos longos fluem entre páginas, sem altura fixa ou fonte diminuída automaticamente. Agrupamentos recompõem seus contornos em páginas de continuação. Tabelas estreitas mantêm cabeçalhos repetidos e linhas alternadas.

O papel permanece A4, com margens de 12 mm e corpo de 10 pt. Cartões e títulos precisam de mais espaço que a versão anterior. A paginação acompanha o conteúdo; não há promessa de caber a ficha inteira em uma página. As amostras preenchidas abaixo contêm 65 parágrafos e 42 itens, além dos demais dados da ficha.

## PDFs atuais

| Amostra fictícia | Versão anterior | Design atual |
| --- | ---: | ---: |
| [D&D vazio](../output/pdf/dnd2024-empty.pdf) | 3 páginas | 4 páginas |
| [D&D preenchido](../output/pdf/dnd2024-filled.pdf) | 9 páginas | 11 páginas |
| [Autoral vazio](../output/pdf/sistema-rpg-empty.pdf) | 4 páginas | 6 páginas |
| [Autoral preenchido](../output/pdf/sistema-rpg-filled.pdf) | 13 páginas | 16 páginas |
| [Importado escuro com fundos](../output/pdf/imported-dark.pdf) | 8 páginas | 8 páginas |
| [Importado claro sem fundos](../output/pdf/imported-light.pdf) | 8 páginas | 8 páginas |

A versão anterior está preservada em `output/pdf/plain-reference`. Os novos exemplos D&D usam Clássico; os autorais usam Floresta. Os preenchidos ativam uma composição de três ornamentos para demonstrar esse comportamento. Personagens vazios continuam sem decoração quando ela está desligada. A captura usa um perfil fictício isolado, sem acessar os dados pessoais.

## Verificações desta revisão

`npx playwright test tests/e2e/print-export.spec.js tests/e2e/artwork.spec.js --workers=2`: **11 testes aprovados em 42,1 segundos**, após a última correção de cor. Cobrem as seis paletas em claro/escuro, ausência de sobreposição no cabeçalho, retrato único, decoração, estado e preferências preservados, equivalência dos três modos D&D, impressão fora da ficha, debounce, dados compostos e fallback d30.

A regressão completa anterior a essa última correção teve 96 aprovações e uma falha de cor no teste de impressão/arte. A causa foi a prioridade de um seletor CSS sobre o acento do cabeçalho; o seletor foi corrigido e toda a cobertura de impressão/arte passou novamente. Não se apresenta essa execução anterior como uma suíte completa sem falhas após a correção.

Os **seis PDFs finais, totalizando 53 páginas**, foram renderizados e inspecionados visualmente, incluindo tabelas, transições, registros e finais de texto. `tests/verify-design-pdfs.py` confirmou A4, texto dentro das margens, ausência de páginas vazias, 65 parágrafos em ordem, 42 itens, 70 linhas do sistema importado, cabeçalhos repetidos e marcadores finais. Os dois PDFs importados produziram pixels idênticos em tema claro/escuro e fundos desligados/ligados no Edge 154.0.4258.48. Os limites de diálogo nativo, impressão física e outros navegadores continuam os descritos no [contrato de impressão](impressao-pdf.md).

## Reprodução

Execute os testes antes da captura, sem outra suíte na porta 4173:

```sh
npx playwright test tests/e2e/print-export.spec.js tests/e2e/artwork.spec.js --workers=2
node tests/capture-design.mjs styled
```

Os quatro PDFs da captura ficam em `output/design/styled`; os dois importados são gerados pelo teste em `output/pdf`. Reúna os quatro primeiros nessa pasta e renderize/verifique com os scripts documentados em [impressão/PDF](impressao-pdf.md). Os artefatos são locais e ignorados pelo Git.
