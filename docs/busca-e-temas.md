# Busca na ficha e aparência

Implementado em 1º de outubro de 2026. A busca percorre a ficha do personagem atual, em todas as abas do layout ativo. Não é uma busca entre personagens, um catálogo de livros ou uma consulta externa.

## Uso

O campo **Buscar na ficha** fica acima da ficha. `Ctrl+K` ou `⌘+K` abre a ficha atual e foca a busca. Digite um nome de campo, perícia, item, técnica ou trecho de anotação. O resultado mostra rótulo, valor atual e localização. Selecioná-lo abre a aba, revela o cartão recolhido quando necessário, move o foco e destaca o destino.

Maiúsculas e acentos não distinguem resultados. Correspondências exatas têm prioridade, seguidas de prefixos, trechos de rótulo, conteúdo e localização. A correção aproximada se aplica aos nomes: aceita uma edição em palavras com quatro a sete caracteres e duas em palavras com oito ou mais, incluindo letras adjacentes trocadas. Palavras de até três caracteres exigem correspondência literal. Termos separados por espaços precisam corresponder ao mesmo resultado. Anotações são pesquisadas por trechos literais normalizados; não há interpretação semântica.

`Enter` no campo abre o primeiro resultado. Seta para baixo move o foco para os resultados; as setas, Home e End navegam entre eles. Escape recolhe os resultados; **Limpar busca** limpa o texto. São apresentados os primeiros 60 resultados, com aviso para refinar a busca quando houver mais. A consulta é limitada a 120 caracteres e não é persistida. Trocar de personagem limpa a consulta.

## Dados e componentes

`js/engine/search.js` constrói os resultados a partir do layout, sistema e personagem. `js/engine/layout-components.js` compartilha com o renderizador a expansão de componentes repetidos e opções vindas do sistema. Listas e tabelas indexam os valores definidos em `itemSchema`, incluindo conteúdo de cartões recolhidos. Campos de seleção mostram os rótulos das opções, recursos mostram atual/máximo e dados compostos preservam sua composição. Retratos não indexam URLs nem dados de imagem.

O registro de tipos em `js/engine/fields.js` aceita dois métodos opcionais:

```js
registerFieldType('meuTipo', {
  render(container, context) { /* implementação visual */ },
  search(context) {
    return [{ label: 'Valor exibido', value: 'd8', keywords: ['apelido'] }];
  },
  revealSearchResult(wrapper, entry) {
    // Revele o elemento se estiver recolhido e devolva o destino do foco.
    return wrapper;
  },
});
```

`search` recebe as propriedades do componente e os objetos `character` e `system`; deve ser somente leitura e não executar ações, rolagens ou alterações. Cada registro tem `label` e `value`; pode ter `keywords` (lista de strings), `category`, `itemIndex` e `itemField`. O mecanismo acrescenta identidade, localização e destino do componente. Sem esse método, usa o campo e o esquema declarados no layout. Componentes sem campo ou provedor expõem seu rótulo, com valor `—`. `searchable: false` no componente o exclui do índice.

Componentes com regras específicas fornecem seus próprios resultados: perícias D&D retornam o bônus de teste atual, campos calculados usam o mesmo avaliador da ficha, carga e orçamento usam suas funções de cálculo. Fórmulas em `mode: "roll"` mostram **Rolagem sob demanda**, sem gerar um resultado na pesquisa. A busca não representa resultados transitórios de uma Pool ou de uma rolagem que não tenham sido armazenados no personagem.

O catálogo de perícias autorais inclui o dado base implícito definido pelo sistema, mesmo quando a ficha compacta esconde a perícia. Pesquisar ou revelar uma perícia em d4 abre o catálogo de edição, sem cadastrá-la no personagem ou cobrar pontos. A busca não inventa valores fora dos dados e das regras implementadas.

D&D usa um único índice para a apresentação estática, a modular e a comparação. `js/systems/dnd2024-search.js` adapta os destinos para a ficha estática; o modo de comparação navega pela modular e mantém a aba da estática sincronizada. Não duplica resultados por haver duas apresentações visuais.

## Aparência

Em **Configurações**, a paleta (Clássico, Editorial, Floresta, Rubi, Preto e branco ou Pétalas) e o modo de leitura (Claro ou Escuro) são escolhas independentes. Rubi usa vermelho/vinho; Preto e branco usa tons de cinza inclusive nos estados da interface, que continuam identificados por texto; Pétalas usa rosa, malva e lilás. O botão do cabeçalho alterna somente o modo. Ambas as preferências são gravadas em `ficha-rpg:settings`, preservando as outras configurações. Preferências antigas com apenas `theme` mantêm esse modo e usam Clássico. Chaves desconhecidas voltam a Clássico/Escuro.

`js/theme.js` aplica `data-palette` e `data-theme` no elemento raiz. Os tokens ficam em `css/variables.css`; a paleta escolhida vale para o shell e para as duas fichas. A variante de layout `editorial` define tipografia e hierarquia, sem substituir cores. Adicionar uma paleta requer registrar a opção em `js/data.js`, definir seus tokens nos dois modos e acrescentar a amostra em `css/appearance-search.css`. As cores de sucesso, perigo e informação mantêm seus papéis semânticos.

## Verificação

Os testes atuais de busca e temas ficam em `tests/e2e/search-themes.spec.js`. Cobrem as três apresentações D&D, cálculos atualizados, perícias implícitas sem alteração de dados, cartões recolhidos, teclado, conteúdo sem acentos, troca de personagem, sistema importado, persistência e as doze combinações de cores. Também conferem contraste dos tokens de texto/rótulos e largura nas fichas e configurações em telas menores. Capturas ficam em `test-results/`, sem serem versionadas.

Em **Configurações**, **Apresentação dos dados** alterna entre texto (padrão) e ícone vetorial com texto. **Ornamentos da ficha** oferece nove artes, combinações prontas, três posições e intensidade, com ativação independente. Ambas as escolhas persistem separadamente das cores. Consulte [Vetores e ornamentos na interface](vetores-interface.md) para os locais cobertos, o contrato e as limitações; os testes específicos ficam em `tests/e2e/artwork.spec.js`.

Execute `npx playwright test tests/e2e/search-themes.spec.js` para essa cobertura ou `npm run test:e2e` para a regressão completa. O resultado de uma execução precisa ser relatado separadamente: a existência dos testes não garante que uma alteração posterior passe.
