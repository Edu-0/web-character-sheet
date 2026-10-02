# Recuperações assistidas

`recoveryGroup` apresenta ações de recuperação com prévia, confirmação e desfazer. O sistema define as regras e os caminhos; a engine não identifica classes, magias ou habilidades por nome. Importe o [pacote fictício de exemplo](recovery-actions.package.json) para experimentar uma pausa que recupera energia.

```json
{
  "type": "recoveryGroup",
  "actionsFrom": "recoveryActions",
  "historyField": "scene.lastRecovery"
}
```

No sistema:

```json
{
  "recoveryActions": [{
    "id": "pause",
    "label": "Pausa",
    "help": "Confira se a recuperação foi concluída conforme a mesa.",
    "operations": [{
      "type": "restoreValue",
      "field": "energy",
      "maxField": "energyMax",
      "label": "Energia"
    }]
  }]
}
```

O personagem fornece `energy` e `energyMax`. Valores atuais/máximos e contadores devem ser inteiros não negativos até 1000000. `historyField` guarda somente a última recuperação e deve ser independente dos recursos editados. A configuração aceita até 30 ações e 30 operações por ação.

| Operação | Configuração |
| --- | --- |
| `restoreValue` | `field` recebe o valor de `maxField`, ambos no personagem. `requireCurrentMin` opcional exige um valor atual mínimo. |
| `set` | Define `field` com `value` simples (texto, booleano ou número). |
| `restoreCollection` | `field` aponta para uma lista; cada `valueField` recebe `maxField` da própria entrada. |
| `setCollection` | `field` aponta para uma lista; define `valueField` de cada entrada com `value` inteiro não negativo. |

Operações de lista aceitam `filterField` e `filterValues` para recuperar somente entradas explicitamente marcadas. Sem filtro, todas as entradas participam. `label` identifica a alteração na prévia. Não há inferência de recuperação pelo nome ou descrição de uma entrada.

## Recuperação por dados

A ação pode acrescentar `healing`:

```json
{
  "field": "health.current",
  "maxField": "health.max",
  "totalField": "recoveryDice.total",
  "usedField": "recoveryDice.used",
  "dieField": "recoveryDice.die",
  "modifier": { "field": "recoveryBonus" },
  "minimum": 1,
  "requireCurrentMin": 1,
  "label": "Vida"
}
```

`modifier` aceita as [fontes das rolagens de entradas](README.md): constante, campo, fórmula ou resolvedor registrado. Sem modificador, usa zero. `dieField` fornece um único dado textual, como `d8`; não aceita grupos ou modificadores na expressão. O painel gasta um dado por vez, permitindo decidir após cada resultado. A recuperação por dado tem o mínimo configurado (padrão zero); o total é limitado ao máximo do recurso.

O jogador pode informar a recuperação por dado, já com o modificador, em vez de rolar. Isso também permite registrar resultados da mesa quando a ficha usa dados de tipos diferentes: o contador é compartilhado, mas a ficha não representa automaticamente vários conjuntos de Dados de Vida de multiclasse.

As escolhas e rolagens ficam na prévia. Cancelar não grava cura, gastos nem recarga; aplicar confirma a transação inteira. Mudanças nos recursos tocados enquanto o painel está aberto bloqueiam a aplicação. `confirmLabel` e `unavailableMessage` personalizam confirmação e erro de requisito. A última aplicação pode ser desfeita enquanto seus recursos ainda têm os valores registrados; edições posteriores impedem desfazer. Não há relógio automático ou verificação de condições narrativas.

## Presets D&D

Os comandos ficam junto de PV e Dados de Vida nas apresentações estática e modular. Descanso curto oferece dados um por vez com Constituição e recupera habilidades marcadas para descanso curto ou longo. Descanso longo recupera PV, todos os Dados de Vida, espaços e habilidades marcadas; encerra PV temporários. Habilidades sem marcação continuam com ajuste manual.

Esses presets seguem as regras de 2024 consultadas no [glossário oficial](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary), com [espaços de magia](https://www.dndbeyond.com/sources/dnd/br-2024/spells) e [PV temporários](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game). A mesa confirma duração, sono, interrupções e intervalos. Exaustão e restauração de valores originais de PV máximo/atributos exigem ajuste manual, pois a ficha não representa esses valores originais ou os níveis da condição. Exceções de classe, como Magia de Pacto e recuperação parcial, não são deduzidas automaticamente.


## Marcação por entrada e campos opcionais

Uma habilidade ou item pode armazenar a escolha em um campo textual, sem códigos do sistema na engine. Para exibir caixas de marcação, configure um campo `select` do `itemSchema` com `presentation: "checkboxes"`:

```json
"recoverOn": {
  "type": "select",
  "presentation": "checkboxes",
  "label": "Recuperar usos em",
  "options": [
    { "value": "", "label": "Ajuste manual" },
    { "value": "shortRest", "label": "Descanso curto ou longo" },
    { "value": "longRest", "label": "Somente descanso longo" }
  ]
}
```

As caixas representam uma única escolha opcional: marcar outra substitui a anterior, e desmarcar devolve o ajuste manual. O contrato exige 2–10 opções explícitas, valores textuais distintos e uma opção vazia. Os nomes `shortRest`/`longRest` são escolhas dos presets; outro sistema pode usar outros valores e rótulos. O valor salvo continua simples, compatível com `filterField`/`filterValues` de `restoreCollection`.

Em `list` ou `table`, `itemDetails` recolhe campos secundários sem criar mais colunas:

```json
"itemDetails": {
  "label": "Usos e recuperação",
  "fields": ["usesCurrent", "usesMax", "recoverOn"]
}
```

Todos os campos devem existir em `itemSchema`. A busca revela a área recolhida; a impressão completa conserva os campos e a compacta respeita sua seleção habitual. No RPG autoral, Equipamentos e Inventário compartilham esses dados. Abra **Usos e recuperação** somente nos itens ou artefatos que têm cargas, informe atuais/máximos e marque o descanso autorizado pela mesa. Nenhuma marcação é inferida do nome ou tipo do item; entradas existentes sem marcação permanecem manuais.

`actionGroup` também aceita `restoreCollection`/`setCollection` com os mesmos caminhos e filtros de `recoveryGroup`, permitindo combinar recarga de itens com outras operações do sistema e desfazer a transação inteira. Um recurso marcado inválido bloqueia toda a ação, sem alterações parciais. Recuperação parcial, recarga diária ou dependente de condições especiais continua manual quando não foi declarada por um preset.
