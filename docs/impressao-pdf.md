# Impressão e PDF

Implementado e verificado em 1º–2 de outubro de 2026, conforme as etapas 0–6 do [plano de refinamento](plano-refinamento-design-pdf.md).

## Uso

Use **Imprimir / PDF** (em **Mais** nas telas de até 900 px), ou o comando de impressão do navegador, inclusive Ctrl/Cmd+P. Escolha A4, escala 100% e salvar como PDF. Desative os cabeçalhos/rodapés automáticos do navegador para não acrescentar data e URL. Fundos podem ficar desligados. O aplicativo não baixa um PDF automaticamente.

A impressão contém o personagem aberto, mesmo quando a tela atual é Configurações ou uma biblioteca. Abas, filtros de inventário, busca e cartões recolhidos não limitam o documento. As apresentações D&D estática, modular e comparação produzem a mesma ficha de leitura, uma única vez. Sem personagem aberto, aparece apenas essa informação.

Os valores são os atuais em memória, inclusive antes do debounce de salvamento. Preparar, cancelar ou repetir a impressão não salva alterações, não muda a navegação, não rola dados e não cobra custos. Exportar JSON continua sendo o backup completo e reimportável; PDF é uma apresentação para leitura.

## Contrato de conteúdo

- `js/printing.js` prepara um documento isolado em `beforeprint` e o remove em `afterprint`. O comando de teclado nativo não é interceptado.
- `js/engine/print-sheet.js` percorre o layout e expande seus componentes sobre uma cópia do personagem. Não clona a tela nem consulta o índice da busca. Não registra subscriptions, callbacks de mudança ou IDs auxiliares.
- Seleções usam rótulos; recursos usam atual/máximo; booleanos são Sim/Não; vazios são `—`; compostos mantêm `d12 + d6` como uma fonte. Perícias implícitas são incluídas sem cadastrá-las.
- Descrições e notas são blocos fluidos, com quebras de linha. Retrato, coleções, estados, orçamento, evolução, última ação registrada, último uso de técnica e concentrações persistidas são preservados. Resultados transitórios de rolagem que não pertencem ao personagem não são um registro persistido.
- D&D fornece `print(context)` em seus componentes, reutilizando os mesmos cálculos da tela. Outros componentes determinísticos usam sua renderização auxiliar desconectada, sobre a cópia dos dados; o resultado é convertido em leitura e clonado sem listeners. Formulários de uso/evolução/rolagem não entram no documento.
- `value-format.js` compartilha formatação com a busca. O índice, a ordenação e o limite de resultados da busca não participam da impressão.
- Uma coleção vinculada ao mesmo campo em várias abas é impressa uma vez, com a união dos campos de seus esquemas. No autoral, isso reúne Equipamentos e Inventário sem perder Descrição.
- Tabelas de até seis colunas e células curtas mantêm cabeçalho repetido. Coleções largas ou células extensas viram registros. Registros curtos ficam juntos; registros longos podem continuar por várias páginas.

Componentes novos podem implementar `print(context)` no registro de campos, retornando um nó de leitura ou `null` para um componente exclusivamente operacional. O método deve ser determinístico e não executar ações nem alterar estado global. Campos de dados básicos têm formato genérico; um componente com mecânica nova precisa definir sua saída legível.

## Papel e identidade visual

Após o pedido de dar mais identidade ao PDF, `css/print.css` adapta o design da ficha para A4 retrato, com margens de 12 mm, texto de 10 pt, rótulos de 7,5–8 pt e títulos de 11,5–23 pt. Reutiliza as fontes do projeto e a variante do layout: títulos serifados na referência D&D e tipografia sem serifa na variante editorial. Valores recebem cartões suaves; capítulos têm faixas numeradas; tabelas mantêm cabeçalhos repetidos e linhas alternadas.

`js/printing.js` resolve a versão **clara da paleta escolhida** em um elemento temporário, sem mudar o tema da tela ou salvar preferências. Papel continua branco e a tinta escura, mesmo com a página em modo escuro. Assim a família de cores é herdada com contraste apropriado para leitura no papel. O retrato aparece uma vez no cabeçalho; os ornamentos ativos ocupam uma faixa reservada, seguindo peças, posições e intensidade. Desligar a decoração continua removendo essa área. Dados vetoriais funcionais usam o acento da paleta e continuam acompanhados de texto; d30 usa o fallback textual.

Cartões curtos ficam juntos, enquanto descrições, listas e seções extensas podem continuar em outra página. Os contornos dos agrupamentos são recompostos nas páginas de continuação. Não há altura fixa de texto nem redução automática da fonte para forçar uma quantidade de páginas. `print-color-adjust: exact` solicita a conservação dos tons suaves no Chromium; outros navegadores podem respeitar de modo diferente a opção de imprimir fundos. Bordas, títulos e texto continuam identificáveis sem essas superfícies.

No Edge verificado, caixas de margem CSS mostram identificação resumida do personagem/sistema e página/total. Navegadores sem suporte a essas caixas conservam a identificação no cabeçalho inicial, mas podem não numerar as páginas. Preferências do diálogo, impressoras físicas e outros navegadores podem alterar a paginação.

## Verificação e reprodução

Testes de conteúdo/estado: `tests/e2e/print-export.spec.js`. Contratos de teclado/layout: `tests/e2e/refinement.spec.js`. Os testes anteriores de retrato, comparação, arte e cabeçalho foram adaptados aos novos elementos, preservando as verificações de sincronização e conteúdo.

```sh
npm run test:e2e
node tests/capture-design.mjs after
```

A captura usa a porta 4175 e um perfil isolado do Playwright; não acessa a biblioteca pessoal. Para reduzir disputa de recursos, execute depois da suíte. `tests/design-fixtures.mjs` fornece nomes fictícios, retrato sintético, 42 itens, 65 parágrafos, recurso atual/máximo, composto, estado e histórico. O teste importado acrescenta d30, tabela de 70 linhas e uma célula com várias páginas.

`tests/render-design-pdfs.py` renderiza cada página em PNG a 125%, cria contatos com todas as páginas e extrai texto/bounds em JSON. Nesta execução foi usado PyMuPDF 1.28.2 e Pillow 12.3.0 instalados somente em `tmp/pdf-tools`, sem modificar o MiKTeX pessoal. São ferramentas opcionais de revisão, não dependências da aplicação nem da suíte Playwright. `tmp/` e `output/` são artefatos locais ignorados pelo Git.

Com essas bibliotecas disponíveis no Python, reúna os quatro PDFs da captura e os dois importados do teste em `output/pdf` e execute:

```sh
python tests/render-design-pdfs.py output/pdf
python tests/verify-design-pdfs.py
```

O segundo script confere conteúdo integral das amostras, limites de texto, cabeçalhos repetidos e igualdade visual entre claro/escuro com fundos desligados/ligados. Não substitui a inspeção visual das páginas renderizadas.

Veja o [relatório desta execução](refinamento-design-pdf-resultados.md) para medições, PDFs, evidências e limites. Testes existentes ou capturas antigas não substituem uma nova execução após mudanças.

A [segunda revisão do PDF](design-pdf.md) registra o visual herdado da ficha e as verificações feitas após esse pedido. A primeira revisão permanece como resultado histórico.
