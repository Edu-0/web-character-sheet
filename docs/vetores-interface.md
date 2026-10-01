# Vetores e ornamentos na interface

Implementação inicial autorizada pelo autor em 1º de outubro de 2026, após a avaliação das artes e a escolha por posições predefinidas. As paletas Rubi, Preto e branco e Pétalas também estão disponíveis em claro/escuro. Preferências de arte, paleta e modo são independentes e não alteram sistema, layout, personagem ou regras.

## Uso

Em **Configurações → Apresentação dos dados**, escolha **Texto · d6, d8…** (padrão) ou **Ícone vetorial com texto**. O texto identifica os dados nos dois modos; formas desconhecidas, como d30 de um sistema importado, continuam textuais. Desativar os ornamentos não desativa esses ícones.

Em **Ornamentos da ficha**, ative a faixa decorativa e selecione as artes individualmente. Há nove peças em três famílias: Dados e facetas, Botânico, Geométrico e arcano. As combinações **Aventura**, **Jardim arcano** e **Minimalista** servem como ponto de partida; a composição pode misturar famílias. Aplicar uma combinação pronta ativa os ornamentos.

Cada peça selecionada pode ocupar o topo à esquerda, ao centro ou à direita. Há uma arte por posição, até três simultâneas. Ativar uma peça procura uma posição livre; quando todas estão ocupadas, substitui a arte na posição preferida da nova peça. Escolher manualmente uma posição ocupada substitui a ocupante, com aviso. **Discreta**, **Suave** e **Destacada** controlam a intensidade global. Desativar a faixa preserva a combinação para reativar depois. Uma combinação vazia não ocupa espaço na ficha.

As posições são predefinidas, sem arrastar ou sobrepor campos. A faixa tem espaço próprio acima da ficha e é compartilhada pelas apresentações D&D estática, modular e comparação, e pelos demais sistemas. Ela acompanha a cor de destaque escolhida, reduz sua altura no celular e é omitida na impressão. Os ícones funcionais permanecem conforme a preferência e usam preto na impressão.

## Artes do livro utilizadas

| Local | Aplicação atual |
| --- | --- |
| Bandeja de dados D&D | d4, d6, d8, d10, d12 e d20 junto aos textos dos botões, preservando nomes acessíveis e ações de rolagem. |
| Controles de Traços | Indicadores ao lado do seletor textual; composição como d12 + d6 tem as duas formas no mesmo controle. |
| Seleção de fontes da Pool | Formas junto ao valor de cada Traço, inclusive compostos. |
| Resultados de Pool e uso assistido de Técnicas | Dados de cada fonte, símbolos de Ápice, Base e Potência disponível e símbolo de Peso no resumo. Rótulos e valores permanecem visíveis. |
| Família decorativa Dados e facetas | Composições dos dados autorais em órbita, dupla e constelação. |

Controles nativos, opções de seleção, anotações livres, históricos e resultados da busca continuam textuais. Esta etapa não converte automaticamente todas as ocorrências de `dN` no documento. Os símbolos do livro acompanham apenas os papéis correspondentes dos resultados de Pool; a bandeja D&D utiliza somente as formas dos dados.

Os seis dados e os quatro símbolos selecionados foram extraídos para `assets/artwork/book-vectors.js`; não há carregamento de `docs/references/`. A geometria foi preservada. Os dados originais têm viewBox 200 × 200 e traço fino; a variante funcional usa traço 9 para miniaturas. Os símbolos usam viewBox 24 × 24 e traço 1,6. Todos recebem `currentColor`. Consulte [proveniência e direitos das artes](../assets/artwork/README.md).

## Contrato e extensão

`js/artwork.js` valida e persiste as preferências em `ficha-rpg:settings`, preservando outras chaves:

```json
{
  "diceDisplay": "text",
  "artwork": {
    "enabled": false,
    "intensity": "soft",
    "preset": "custom",
    "selected": [{ "id": "dice-orbit", "position": "right" }]
  }
}
```

`diceDisplay` aceita `text` ou `illustrated`; intensidade aceita `subtle`, `soft` ou `strong`; posição aceita `left`, `center` ou `right`. IDs desconhecidos, posições inválidas e repetições são descartados. A raiz recebe `data-dice-display` e `data-ornaments-enabled`; alterações emitem `artwork:change`. O estado inicial usa texto e ornamentação desligada, com uma composição guardada para prévia.

`js/dice-display.js` constrói rótulos e indicadores sem modificar valores. `assets/artwork/ornaments.js` registra famílias, artes e combinações prontas. Novas artes podem entrar nesse catálogo com ID próprio, família, rótulo, posição preferida e desenho SVG local revisado. Preferências armazenadas nunca fornecem markup nem URLs. SVGs auxiliares recebem `aria-hidden`, não entram no foco e a faixa não intercepta cliques.

O catálogo inicial dá variedade sem atrelar desenhos a um RPG ou paleta. Famílias adicionais de ficção científica, horror, piratas ou outros cenários podem ser acrescentadas em uma etapa futura. Arrastar livremente, uploads de SVG, ornamentos em cada página e controles individuais de escala/cor não estão implementados nem automaticamente autorizados.

## Verificação

`tests/e2e/artwork.spec.js` cobre alternância textual/vetorial, rolagens e nomes acessíveis, persistência, independência da paleta e da decoração, composição e substituição de posições, preferências inválidas, Traços compostos sem multiplicar fontes, resultados preservados e responsividade nas doze combinações de cores. Também verifica impressão e ausência de requisições às referências privadas. Capturas ficam em `test-results/`.

Execute `npx playwright test tests/e2e/artwork.spec.js` para essa cobertura ou `npm run test:e2e` para a regressão completa. O resultado de cada execução deve ser relatado separadamente.
