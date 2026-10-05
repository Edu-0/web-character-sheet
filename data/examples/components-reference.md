# Referência gerada de componentes e parâmetros

Gerada por `npm run build:reference`; confira com `npm run check:reference`. Não edite este arquivo à mão. Descritores são consumidos pela validação de formas/chaves; regras semânticas permanecem nos validadores indicados. Extras seguros são preservados como metadados inertes, sem ampliar operações permitidas.

São 29 componentes e 7 tipos internos. As condições dependentes de sistema/layout/personagem são verificadas por [schemas](../../js/validation/schemas.js), [referências](../../js/validation/references.js) e [referências de rolagem](../../js/validation/roll-references.js). Valores default listados abaixo vêm de constantes consumidas pelo runtime; ausência de default significa que ele não foi extraído para este contrato, não uma promessa de valor vazio.

Fingerprint do código público consultado: `e1ddab3e0f0cea9832c50981f048762939ed63c376558589cdd76d845891118d`. [Artefato de contrato e hashes](components-reference.json). O check recusa referência desatualizada após mudanças nestas fontes. Não é um JSON Schema completo.

## Propriedades comuns

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `default` | any | não |  |
| `disabledWhen` | object | não | field/equals; bloqueia controles, sem apagar dados |
| `extensions` | any | não |  |
| `field` | path | não |  |
| `help` | string | não |  |
| `label` | string | não |  |
| `print` | object | não | perfil compact; validação em schemas.js |
| `type` | string | sim |  |
| `variant` | string | não |  |

## actionGroup

Comandos confirmados com histórico específico

Implementação: [js/engine/assisted-fields.js](../../js/engine/assisted-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `actionsFrom` | path | sim |  |
| `historyField` | path | não | default: "scene.lastAction" |
| `note` | string | não |  |

## boolean

Escolha booleana

Implementação: [js/engine/fields.js](../../js/engine/fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `field` | path | sim |  |

## checkRoll

Teste sem mutação, com decisões manuais

Implementação: [js/engine/check-fields.js](../../js/engine/check-fields.js). Validação semântica: schemas.js / checks.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `configFrom` | path | sim |  |

## computed

Cálculo nomeado; modo roll não recebe override/efeito derivado

Implementação: [js/engine/advanced-fields.js](../../js/engine/advanced-fields.js). Validação semântica: schemas.js / references.js / roll-references.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `actionLabel` | string | não |  |
| `format` | string | não |  |
| `formula` | path | sim |  |
| `mode` | string | não | enum: roll |
| `override` | boolean | não |  |
| `overrideKey` | path | não |  |
| `roll` | object | não | check/sourceId; referências em roll-references.js; opt-in |
| `stepControls` | boolean | não |  |
| `variables` | object | não |  |

## counter

Contador com limites nos botões

Implementação: [js/engine/fields.js](../../js/engine/fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `field` | path | sim |  |
| `max` | number | não |  |
| `min` | number | não | default: 0 |
| `roll` | object | não | check/sourceId; referências em roll-references.js; opt-in |

## die

Traço por escala; degraus existentes independentes de efeitos temporários

Implementação: [js/engine/fields.js](../../js/engine/fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `allowComposite` | boolean | não |  |
| `field` | path | sim |  |
| `override` | boolean | não |  |
| `overrideKey` | path | não |  |
| `roll` | object | não | check/sourceId; referências em roll-references.js; opt-in |
| `stepControls` | boolean | não |  |

## dndAbility

Atributo D&D e seus derivados

Implementação: [js/systems/dnd2024-fields.js](../../js/systems/dnd2024-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `field` | path | sim |  |
| `key` | string | não |  |
| `override` | boolean | não |  |
| `overrideKey` | path | não |  |
| `short` | string | não |  |
| `stepControls` | boolean | não |  |

## dndDerived

Derivado D&D com chave estável

Implementação: [js/systems/dnd2024-fields.js](../../js/systems/dnd2024-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `override` | boolean | não |  |
| `overrideKey` | path | não |  |
| `stat` | string | não |  |
| `stepControls` | boolean | não |  |

## dndSkill

Perícia D&D e proficiência

Implementação: [js/systems/dnd2024-fields.js](../../js/systems/dnd2024-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `ability` | string | não |  |
| `field` | path | sim |  |
| `key` | string | não |  |
| `override` | boolean | não |  |
| `overrideKey` | path | não |  |
| `stepControls` | boolean | não |  |

## effectList

Instâncias/ativação/eventos/remoção de efeitos v2

Implementação: [js/engine/effect-fields.js](../../js/engine/effect-fields.js). Validação semântica: schemas.js / effects.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |

## image

Imagem local segura

Implementação: [js/engine/advanced-fields.js](../../js/engine/advanced-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `alt` | string | não |  |
| `field` | path | sim |  |

## inventorySummary

Peso/capacidade/excesso derivados

Implementação: [js/engine/assisted-fields.js](../../js/engine/assisted-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `carriedField` | path | não |  |
| `field` | path | sim |  |
| `multiplierField` | path | sim |  |
| `override` | boolean | não |  |
| `overrideKey` | path | não |  |
| `overrideKeys` | object | não |  |
| `quantityField` | path | sim |  |
| `stepControls` | boolean | não |  |
| `strengthField` | path | sim |  |
| `weightField` | path | sim |  |

## list

Coleção de registros com identidade

Implementação: [js/engine/advanced-fields.js](../../js/engine/advanced-fields.js). Validação semântica: schemas.js / roll-references.js / entry-rolls.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `addLabel` | string | não |  |
| `creationCost` | object | não |  |
| `defaultOpen` | boolean | não |  |
| `emptyLabel` | string | não |  |
| `entryAction` | string | não | enum: roll, dndSpell, dndAttack |
| `field` | path | sim |  |
| `fixedLength` | integer | não |  |
| `heading` | string | não |  |
| `itemDetails` | object | não |  |
| `itemSchema` | object | não |  |
| `reorderable` | boolean | não |  |
| `roll` | object | não | check/sourceId; referências em roll-references.js; opt-in |
| `rollConfigFrom` | path | não | alias legado de rollPreset |
| `rollPreset` | path | não |  |
| `summaryFields` | array | não |  |
| `textEntryDefaults` | object | não |  |
| `textEntryField` | string | não |  |
| `toolbarTitle` | boolean | não |  |

## number

Número preenchível; min/max legados não limitam este input

Implementação: [js/engine/fields.js](../../js/engine/fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `field` | path | sim |  |
| `max` | number | não | inert nesta posição |
| `min` | number | não | inert nesta posição |
| `roll` | object | não | check/sourceId; referências em roll-references.js; opt-in |

## pointBudget

Criação e evolução paga/narrativa separadas

Implementação: [js/engine/point-fields.js](../../js/engine/point-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `configFrom` | path | não | default: "pointBudget" |

## poolBuilder

Pool autoral e oposição assistida

Implementação: [js/engine/advanced-fields.js](../../js/engine/advanced-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `resolveLabel` | string | não |  |
| `rollLabel` | string | não |  |
| `traitSources` | array | não |  |

## recoveryGroup

Prévia/condições confirmadas de recuperação

Implementação: [js/engine/recovery-fields.js](../../js/engine/recovery-fields.js). Validação semântica: schemas.js / recovery.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `actionsFrom` | path | sim |  |
| `historyField` | path | sim |  |

## repertoire

Repertório configurado

Implementação: [js/engine/assisted-fields.js](../../js/engine/assisted-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `configFrom` | path | sim |  |

## resource

Objeto current/max; edição não cobra evolução

Implementação: [js/engine/fields.js](../../js/engine/fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `field` | path | sim |  |

## select

Uma opção; optionsFrom é expandido pelo layout; presentation/valueType só atuam em itemSchema

Implementação: [js/engine/fields.js](../../js/engine/fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `field` | path | sim |  |
| `options` | array | não |  |
| `optionsFrom` | path | não |  |
| `presentation` | string | não | inert nesta posição |
| `valueType` | string | não | inert nesta posição |

## skillCatalog

Catálogo configurado de perícias

Implementação: [js/engine/advanced-fields.js](../../js/engine/advanced-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `allowComposite` | boolean | não |  |
| `baseDieFrom` | string | não |  |
| `categoriesFrom` | string | não |  |
| `doneLabel` | string | não |  |
| `editLabel` | string | não |  |
| `emptyLabel` | string | não |  |
| `field` | path | sim |  |
| `override` | boolean | não |  |
| `overrideKey` | path | não |  |
| `stepControls` | boolean | não |  |

## slotTracker

Usos/limites compartilhados; display só altera apresentação

Implementação: [js/engine/advanced-fields.js](../../js/engine/advanced-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `consumeField` | path | não |  |
| `consumeLabel` | string | não |  |
| `display` | string | não | default: "used"; enum: used, remaining |
| `field` | path | sim |  |
| `levelLabel` | string | não |  |

## stateList

Estados graduados autorais existentes; não é activeEffects

Implementação: [js/engine/advanced-fields.js](../../js/engine/advanced-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `addLabel` | string | não |  |
| `creationCost` | object | não |  |
| `defaultOpen` | boolean | não |  |
| `effectLabel` | string | não |  |
| `emptyLabel` | string | não |  |
| `field` | path | sim |  |
| `fixedLength` | integer | não |  |
| `gradeField` | string | não |  |
| `heading` | string | não |  |
| `itemDetails` | object | não |  |
| `itemSchema` | object | não |  |
| `overflow` | object | não |  |
| `recovery` | object | não |  |
| `reorderable` | boolean | não |  |
| `summaryFields` | array | não |  |
| `textEntryDefaults` | object | não |  |
| `textEntryField` | string | não |  |
| `toolbarTitle` | boolean | não |  |

## table

Coleção tabular

Implementação: [js/engine/advanced-fields.js](../../js/engine/advanced-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `addLabel` | string | não |  |
| `creationCost` | object | não |  |
| `defaultOpen` | boolean | não |  |
| `emptyLabel` | string | não |  |
| `field` | path | sim |  |
| `fixedLength` | integer | não |  |
| `heading` | string | não |  |
| `itemDetails` | object | não |  |
| `itemSchema` | object | não |  |
| `removeLabel` | string | não |  |
| `reorderable` | boolean | não |  |
| `searchable` | boolean | não |  |
| `searchLabel` | string | não |  |
| `searchPlaceholder` | string | não |  |
| `summaryFields` | array | não |  |
| `textEntryDefaults` | object | não |  |
| `textEntryField` | string | não |  |
| `toolbarTitle` | boolean | não |  |

## tagList

Lista de textos

Implementação: [js/engine/advanced-fields.js](../../js/engine/advanced-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `field` | path | sim |  |
| `placeholder` | string | não |  |

## techniqueUse

Uso assistido autoral; não converte para checkRoll

Implementação: [js/engine/technique-fields.js](../../js/engine/technique-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `configFrom` | path | sim |  |

## text

Texto curto

Implementação: [js/engine/fields.js](../../js/engine/fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `field` | path | sim |  |
| `placeholder` | string | não |  |

## textarea

Texto longo

Implementação: [js/engine/fields.js](../../js/engine/fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `field` | path | sim |  |
| `rows` | integer | não | default: 3 |

## traitAllocation

Distribuição de traços conforme configuração

Implementação: [js/engine/assisted-fields.js](../../js/engine/assisted-fields.js). Validação semântica: schemas.js.

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `field` | path | sim |  |
| `presetsFrom` | path | sim |  |
| `traitsFrom` | path | sim |  |

## Campos internos de itemSchema

Tipos aceitos como string curta ou `{type, …}`. Não herdam os defaults/controles dos campos de nível superior. Referências de coleção e checkboxes têm condições adicionais em schemas/references; nenhuma chave nova executa código.

### text

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `default` | any | não |  |
| `help` | string | não |  |
| `label` | string | não |  |
| `placeholder` | string | não |  |

### textarea

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `default` | any | não |  |
| `help` | string | não |  |
| `label` | string | não |  |
| `placeholder` | string | não |  |
| `rows` | integer | não | default: 3 |

### number

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `default` | any | não |  |
| `help` | string | não |  |
| `label` | string | não |  |
| `placeholder` | string | não |  |

### boolean

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `default` | any | não |  |
| `help` | string | não |  |
| `label` | string | não |  |
| `placeholder` | string | não |  |

### select

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `default` | any | não |  |
| `help` | string | não |  |
| `label` | string | não |  |
| `labelField` | string | não |  |
| `multiple` | boolean | não |  |
| `options` | array | não |  |
| `optionsFrom` | path | não |  |
| `placeholder` | string | não |  |
| `presentation` | string | não | enum: checkboxes |
| `valueField` | string | não |  |
| `valueType` | string | não |  |

### die

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `allowComposite` | boolean | não |  |
| `default` | any | não |  |
| `help` | string | não |  |
| `label` | string | não |  |
| `placeholder` | string | não |  |
| `stepControls` | boolean | não |  |

### reference

| Parâmetro | Tipo | Obrigatório | Default/enum/condição |
| --- | --- | --- | --- |
| `default` | any | não |  |
| `help` | string | não |  |
| `label` | string | não |  |
| `labelField` | string | não |  |
| `multiple` | boolean | não |  |
| `options` | array | não |  |
| `optionsFrom` | path | não |  |
| `placeholder` | string | não |  |
| `presentation` | string | não | enum: checkboxes |
| `valueField` | string | não |  |
| `valueType` | string | não |  |

## Contratos transversais

Versões suportadas: manifest: 1; package: 1/2; system: 1/2; layout: 1/2; character: 1/2; backup: 1/2. Envelope v2 quando o conteúdo exige v2. A migração precisa de revisão/cópia do original; não há downgrade automático.

Algoritmos: fate, percentile, d6Pool, d6Resistance, explodingTrait, explodingDamage, challenge, progress. progress não recebe efeitos de teste. Unidade por algoritmo: fate=total; percentile=bonusDice; d6Pool=dice; d6Resistance=dice; explodingTrait=total; explodingDamage=total; challenge=action.

Efeitos: eventos endRound, endScene; limites {"definitions":100,"instances":100,"operations":20,"value":1000}; definição/revisão no sistema, instância no personagem. [Contrato e limites](effects.md).

Defaults compartilhados: {"historyLimit":20,"textareaRows":3,"counterMin":0,"checkEnabled":true,"scaleStep":1}.

| Contrato | Chaves/enum aceitos |
| --- | --- |
| checks.fields | `algorithm`, `sources`, `note`, `momentumField`, `extensions` |
| checks.sourceFields | `id`, `label`, `field`, `collection`, `valueField`, `formula`, `overrideKey`, `variables`, `extensions` |
| checks.variableFields | `field`, `system`, `traitMaxField`, `value`, `extensions` |
| checks.maxSources | 100 |
| checks.maxVariables | 32 |
| entryRolls.fields | `buttonLabel`, `title`, `submitLabel`, `noRollMessage`, `help`, `check`, `test`, `effect`, `scale`, `resource`, `info` |
| entryRolls.source | `value`, `field`, `itemField`, `formula`, `variables`, `overrideKey`, `resolver`, `fallback` |
| entryRolls.check | `label`, `toggleLabel`, `expressionLabel`, `modifierLabel`, `enabled`, `expression`, `modifier` |
| entryRolls.effect | `label`, `resultLabel`, `buttonLabel`, `expression` |
| entryRolls.scale | `base`, `min`, `max`, `step`, `label`, `incrementLabel`, `increment`, `noScaleHelp` |
| entryRolls.resource | `field`, `mode`, `matchField`, `valueField`, `maxField`, `cost`, `label`, `statusLabel`, `unavailableMessage`, `consumeField` |
| entryRolls.info | `label`, `source` |
| entryRolls.resourceModes | `remaining`, `used` |
| entryRolls.options | `checkEnabled`, `checkExpression`, `testEnabled`, `testExpression`, `modifier`, `effect`, `increment`, `attack`, `attackModifier`, `upcast` |
| recovery.fields | `id`, `label`, `help`, `confirmLabel`, `unavailableMessage`, `healing`, `operations` |
| recovery.healing | `field`, `maxField`, `totalField`, `usedField`, `dieField`, `modifier`, `minimum`, `requireCurrentMin`, `label` |
| recovery.operation | `type`, `field`, `maxField`, `value`, `valueField`, `filterField`, `filterValues`, `requireCurrentMin`, `label` |
| recovery.operations | `restoreValue`, `set`, `restoreCollection`, `setCollection` |
| recovery.maxActions | 30 |

[Rolagens de entradas e suas condições](README.md), [testes/botões](testing.md), [recuperação](recovery.md) e [validação documental](validation.md) explicam o uso. As listas acima são as mesmas importadas pelos validadores; extensions é permitido como metadado inerte nos contratos estritos. Não traduzir uma regra narrativa para automação sem definição verificada.

## Exemplos verificados

- [check-buttons.package.json](check-buttons.package.json)
- [check-rolls.package.json](check-rolls.package.json)
- [generic-entry-rolls.package.json](generic-entry-rolls.package.json)
- [recovery-actions.package.json](recovery-actions.package.json)

O gerador valida cada pacote e personagem-template pelo código real. Testes negativos/de preservação e comparação do registro de renderizadores ficam nas suítes Node/Playwright. Estes exemplos são fictícios; a referência não copia conteúdo de livros.
