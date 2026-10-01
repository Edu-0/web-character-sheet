# Paridade D&D: ficha estática × ficha modular

A ficha modular é a apresentação padrão do D&D em uma instalação nova. A ficha estática continua separada como referência de comparação. Ambas editam o mesmo `character.json`; não há migração nem cópia de dados ao alternar.

## Verificação realizada

- Playwright captura as sete abas em 360, 768 e 1280 px, nos temas claro e escuro, lado a lado, pelo teste `tests/e2e/dnd-parity.spec.js`.
- O mesmo teste registra capturas das sete abas de um personagem preenchido em 1280 px nos dois temas. As capturas ficam nos artefatos `test-results/` da execução (não versionados).
- Os testes D&D exercitam sincronização bidirecional, cálculos, perícias, rolagens, espaços de magia, reordenação, filtro de inventário, retrato, impressão, exportação/importação e persistência.
- Abas e componentes vêm de `dnd2024.layout.json`; os campos próprios de D&D são registrados em `js/systems/dnd2024-fields.js`, sem ramificações D&D no renderizador de abas.

## Diferenças visuais restantes

| Área | Diferença mantida | Motivo |
| --- | --- | --- |
| Retrato | A ação de escolher imagem aparece abaixo do quadro e o símbolo vazio difere. | A ação fica sempre visível e acessível, inclusive em toque. |
| Atributos e perícias | Os resultados da ficha modular são botões de rolagem, enquanto a estática usa valores sem ação. | A interação adicional usa o mesmo cálculo e a bandeja de dados. |
| Listas de ataques, habilidades e magias | O card editável modular tem controles textuais e espaçamento ligeiramente diferente. | Mantém a edição por teclado e os controles reutilizáveis. |
| Inventário | A tabela modular comprime algumas colunas em comparação lado a lado. | Evita rolagem horizontal da página; em tela estreita vira cartões. |

Nenhuma dessas diferenças muda campos salvos ou regras. A ficha estática não foi removida porque o usuário pediu mantê-la para acompanhar a evolução visual. A fase 8 ainda deve testar dezenas de itens, textos longos sem espaços e o fluxo final completo antes de qualquer retirada definitiva.

Execute `npm run test:e2e` para a regressão completa, ou `npx playwright test tests/e2e/dnd-parity.spec.js` para regenerar as capturas de comparação.
