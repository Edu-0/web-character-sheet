# Rolagens de entradas configuradas por JSON

Para criar, editar e ensaiar esses pacotes pela interface, consulte o [editor JSON com prévia](editor-json.md).

Uma lista de técnicas, poderes, armas ou outras ações pode oferecer um painel de rolagem sem código específico para o sistema. A configuração das regras fica em `system.entryRolls`; o layout escolhe uma configuração:

```json
{
  "type": "list",
  "field": "techniques",
  "label": "Técnicas",
  "entryAction": "roll",
  "rollPreset": "skillCheck",
  "itemSchema": { "name": "text", "impact": "text" }
}
```

No sistema, por exemplo:

```json
{
  "entryRolls": {
    "skillCheck": {
      "buttonLabel": "Usar técnica",
      "submitLabel": "Testar",
      "check": {
        "label": "Teste",
        "expression": { "value": "2d6" },
        "modifier": { "field": "expertise" }
      },
      "effect": { "expression": { "itemField": "impact" } }
    }
  }
}
```

O personagem precisa fornecer os campos usados, como `expertise` e `techniques`. Importe o [pacote completo de exemplo](generic-entry-rolls.package.json) pela biblioteca de Sistemas para experimentar testes com `2d6`, efeito separado, escala de potência e custo de energia. É um exemplo fictício de contrato, sem regras de um livro.

## Configuração do painel

| Opção | Comportamento |
| --- | --- |
| `buttonLabel`, `title`, `submitLabel` | Texto do botão de abertura, título e ação principal. |
| `help`, `noRollMessage` | Orientação e mensagem da ação sem dados. |
| `check` | Primeira rolagem opcional. Ausente, o painel oferece somente efeito ou ação sem dados. |
| `check.expression`, `check.modifier` | Fontes dos dados iniciais e do modificador automático. |
| `check.enabled` | Teste marcado inicialmente; padrão `true`. O jogador pode desmarcar. |
| `check.label`, `toggleLabel`, `expressionLabel`, `modifierLabel` | Textos da primeira rolagem e seus controles. |
| `effect.expression` | Fonte dos dados iniciais de dano/efeito. Vazio permite ação sem rolagem. |
| `effect.label`, `resultLabel`, `buttonLabel` | Textos do campo, resultado e botão separado de efeito. |
| `scale` | Seleção de intensidade e aumento linear dos dados/modificador por passo. |
| `resource` | Consumo opcional de um recurso existente, somente na ação principal. |
| `info` | Até dez informações `{ "label": "…", "source": { … } }` para consulta. |

A ação principal rola o teste quando marcado; caso contrário, rola o efeito ou registra a ação sem dados. O botão de efeito é separado: não consome recurso. Salvar configuração também não rola nem consome. Recursos começam desmarcados; dados, limites e disponibilidade são conferidos antes do gasto.

Para controlar o consumo junto dos recursos gerais, configure `resource.consumeField` com o caminho de um booleano do personagem. O painel lê esse campo ao executar a ação e deixa de oferecer a marcação por entrada. Um componente `boolean` pode editar essa preferência; `slotTracker` também aceita `consumeField` e `consumeLabel` para exibi-la junto dos contadores. Sem `consumeField`, o painel conserva a marcação local. O campo ausente equivale a desligado; a preferência definida acompanha JSON e backup.

`slotTracker.display: "remaining"` mostra `max - used` disponíveis e faz os botões −/+ diminuir/aumentar a disponibilidade. O padrão `"used"` continua mostrando usos. Os dados salvos mantêm `used` e `max` nos dois modos. D&D usa espaços disponíveis e a preferência compartilhada **Consumir espaço ao lançar magia** nos cards gerais; cada magia escolhe o nível do espaço, sem um contador próprio.

## Fontes de valores

Escolha **uma origem** em cada fonte:

| Origem | Exemplo | Uso |
| --- | --- | --- |
| `value` | `{ "value": "2d6 + 1" }` | Constante textual ou numérica. |
| `itemField` | `{ "itemField": "impact" }` | Campo da entrada da lista. |
| `field` | `{ "field": "resources.energy" }` | Campo do personagem. |
| `formula` | `{ "formula": "checkBonus", "variables": { "skill": { "field": "expertise" } } }` | Fórmula nomeada em `system.formulas`, com fontes para variáveis. |
| `resolver` | `{ "resolver": "dnd.spellAttackBonus" }` | Extensão registrada em JavaScript, quando uma regra precisa de código. |

`fallback` opcional fornece um número/texto quando a origem retorna vazio, `null` ou ausente. `overrideKey` opcional aplica uma exceção de `character.calculationOverrides` ao valor automático numérico. Modificador manual preenchido no painel substitui o automático. Variáveis de fórmula aceitam as mesmas fontes, com até 32 variáveis e profundidade 4; o interpretador de fórmulas não executa JavaScript.

Fontes de expressão devem produzir texto de dados; fórmulas produzem números e são indicadas para modificadores, valor base e custos. Os resolvedores embutidos de conjuração são `dnd.spellAttackBonus` e `dnd.spellSaveDC`; outros sistemas podem usar campos e fórmulas sem qualquer resolvedor D&D. Um resolvedor novo exige implementação e registro, não apenas seu nome no JSON. Resolvedor indisponível exibe erro e não gasta recursos.

## Escala e custo

```json
{
  "scale": {
    "base": { "itemField": "grade" },
    "min": 0,
    "max": 20,
    "step": 2,
    "label": "Potência",
    "increment": { "value": "1d6" },
    "incrementLabel": "Dados adicionais por passo"
  },
  "resource": {
    "field": "energy",
    "mode": "remaining",
    "cost": { "itemField": "cost" },
    "label": "Consumir energia"
  }
}
```

Com base 2 e escolha 6, são dois passos: `2d6 + 1` e incremento `1d6` resultam em `4d6 + 1`. O incremento também pode incluir modificador. A escala admite inteiros de 0 a 1000, passo positivo, extremos alinhados e até 101 opções. O jogador escolhe da base até o máximo. Base abaixo de `min` desativa a escala e permite exibir `noScaleHelp`; base negativa, ausente, não inteira, desalinhada ou acima do máximo impede a ação. Escolha e marcação de consumo não persistem.

O custo é uma fonte numérica inteira de 0 a 1000000; ausência significa 1. Pode vir da entrada, da ficha ou de fórmula. A seleção de intensidade não é uma variável automática de fórmula de custo. O sistema precisa representar explicitamente o custo desejado nos campos/fontes configurados.

| Recurso | Configuração |
| --- | --- |
| Saldo disponível | `mode: "remaining"`; desconta `cost` de `field`. |
| Contador de usos | `mode: "used"`; soma `cost` em `field`, respeitando o máximo em `maxField`. |
| Recursos por intensidade | `field` aponta para uma lista; `matchField` identifica o valor selecionado da escala e `valueField` indica saldo/usos na entrada. Exige `scale`; `maxField` em `used` também é relativo à entrada. |

Exemplo de lista: `{ "field": "charges", "matchField": "rank", "valueField": "spent", "maxField": "limit", "mode": "used" }`. Deve haver exatamente uma entrada com `rank` igual à seleção. `label`, `statusLabel` e `unavailableMessage` personalizam os textos. Saldos, usos, máximos e custos precisam ser inteiros válidos; nenhum recurso é criado automaticamente.

## Dados salvos e limites

O painel salva `item.rollOptions`, com `checkEnabled`, `checkExpression`, `modifier`, `effect` e `increment`, conforme os controles disponíveis. Configurações acompanham o personagem em JSON e backup. Os nomes antigos `testEnabled`, `testExpression`, `attack`, `attackModifier` e `upcast` continuam sendo lidos e são convertidos ao salvar, preservando seus valores. Não configure um campo de `itemSchema` chamado `rollOptions` para outra finalidade numa lista com esta ação.

Em pacotes anteriores, `rollConfigFrom` é aceito como nome anterior de `rollPreset`, e `test` como nome anterior de `check`. Use os nomes novos ao criar configurações. Não declare um nome novo junto de seu alias anterior: a validação rejeita essa ambiguidade. Importação/exportação de um sistema antigo conserva seu JSON; salvar as opções da entrada converte somente essas opções para os nomes atuais.

Expressões aceitam grupos `NdS` somados, modificadores inteiros positivos/negativos e valor fixo; `d6` significa `1d6`. Limites: 200 caracteres, 100 dados totais, 2 a 100000 lados e modificador absoluto até 1000000, inclusive após aumento. Sem dados subtraídos, multiplicação ou execução de código.

A bandeja e seu histórico de 20 resultados ficam disponíveis para todos os sistemas; `system.diceTray: false` oculta a bandeja. O painel continua mostrando seu resultado. Histórico é temporário, não um registro persistente de usos. Resultados e botões não entram na impressão da ficha.

Este contrato oferece dados e soma, teste/efeito separados, aumento linear e consumo opcional. Contagem de sucessos, seleção de resultados de uma Pool, explosões, dados Fate, críticos e escalas não lineares exigem outros contratos/resolvedores. O painel não aplica dano, decide sucesso ou interpreta descrições de livros.
