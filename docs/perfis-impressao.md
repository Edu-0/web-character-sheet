# Perfis de impressão

Implementado em 2 de outubro de 2026, após o checkpoint `2249f83` (`Refina interface e PDF com identidade visual da ficha`). O estado anterior foi commitado antes desta implementação, sem publicar o repositório.

## Uso e limites

**Imprimir / PDF** abre a escolha **Completo** ou **Compacto**. Confirmar grava somente a preferência `printProfile` junto às demais configurações e abre a impressão do navegador. Cancelar ou Escape não grava a escolha; o foco volta ao botão de impressão ou a **Mais**, no celular. Ctrl/Cmd+P usa o último formato confirmado; o padrão é Completo. Valores desconhecidos da preferência são tratados como `full`.

Completo conserva o conteúdo do contrato existente de [impressão](impressao-pdf.md). Compacto é uma versão de consulta, identificada no cabeçalho e no rodapé, com menor espaçamento e resumos declarados no layout. Ambos preservam o design para papel, a paleta, o retrato e a decoração ativa. Não existe limite de páginas nem redução automática de fonte para forçar uma página. Os dados do personagem e a exportação JSON permanecem integrais.

## Contrato genérico do layout

`print.compact` é opcional em seções, containers e componentes. Não depende do ID do sistema, de nomes de abas ou de campos específicos como moedas ou magias. Sem metadados, conserva o conteúdo e reduz apenas espaçamentos. O perfil Completo ignora todos esses metadados. Não há alteração de `schemaVersion`.

| Local | Opção | Comportamento no Compacto |
| --- | --- | --- |
| Seção, container ou componente | `include: false` | Omite esse agrupamento ou componente |
| Seção ou container | `presentation: "inline"` | Agrupa os campos em uma linha que pode quebrar conforme o espaço |
| Seção ou container | `presentation: "cards"` | Conserva os cartões habituais |
| Coleção com `itemSchema` | `fields: ["title", "tier"]` | Projeta os campos existentes, na ordem declarada |
| Coleção com `itemSchema` | `presentation: "table"` | Prefere tabela quando o conteúdo cabe com segurança |
| Coleção com `itemSchema` | `presentation: "records"` | Prefere registros fluidos |

Exemplo de coleção em um sistema diferente:

```json
{
  "type": "list",
  "field": "cargo",
  "label": "Módulos",
  "itemSchema": {
    "title": { "type": "text", "label": "Módulo" },
    "tier": { "type": "text", "label": "Classe" },
    "detail": { "type": "textarea", "label": "Detalhes" }
  },
  "print": {
    "compact": { "fields": ["title", "tier"], "presentation": "table" }
  }
}
```

Para reduzir o grupo de valores, acrescente `"print": { "compact": { "presentation": "inline" } }` à seção ou ao container. Para omitir um diário somente na versão de consulta, acrescente `"print": { "compact": { "include": false } }` ao componente. O gerador não decide sozinho quais informações são dispensáveis.

Tabelas de até seis colunas e células curtas mantêm cabeçalho repetido. Mesmo com `presentation: "table"`, conteúdo largo ou longo vira registros que podem continuar por várias páginas. Textos desconhecidos não são truncados. `fields` seleciona conteúdo, sem editar os registros originais.

Coleções repetidas em várias abas são deduplicadas pelo campo e usam a união dos esquemas **já projetados para o perfil**. Configure todas as ocorrências quando quiser omitir uma coluna; uma ocorrência sem projeção conserva suas colunas na união. A primeira ocorrência incluída determina a apresentação. Seção/container omitido não participa dessa união.

O validador rejeita opções/perfis desconhecidos, `include` não booleano, projeção vazia, duplicada ou que referencia campos ausentes e apresentação incompatível com o nível. A projeção exige `itemSchema`. Componentes customizados recebem `printProfile` e `printPresentation` em `print(context)`; mecânicas novas continuam exigindo uma saída legível específica do componente. Sistemas que reutilizam os componentes compatíveis podem configurar o resumo somente no JSON do layout.

## Configuração dos sistemas incluídos

| Grupo | Resumo |
| --- | --- |
| D&D: magias | Nome e nível, em tabela |
| D&D: moedas | Cinco valores na mesma linha, com cartões menores |
| D&D: habilidades | Nome, origem e usos atual/máximo |
| D&D: inventário | Nome, quantidade, peso e equipado |
| D&D: personalidade | Conserva os campos curtos; omite história e notas extensas |
| Autoral: técnicas | Nome, dado máximo/atual, custo e concentração |
| Autoral: equipamentos/inventário | Nome, dado, quantidade, peso e carregado, uma única vez |
| Autoral: descrições/notas | Omite descrição longa de identidade e notas de campanha |

Recursos atuais/máximos, dados compostos, progressão, estados e registros de custo pago/concentração permanecem. Impressão não executa ações, rolagens nem evolução. Não há novo código específico de D&D no seletor ou no processamento dos perfis.

## Verificação atual

A regressão completa atual (`npm run test:e2e -- --workers=2`) passou: **101 testes em 4,7 minutos**. `git diff --check` também passou. Estes resultados são desta implementação, posteriores ao checkpoint.

Os testes novos estão em `tests/e2e/print-profiles.spec.js`: cancelamento e confirmação, foco, celular, persistência após recarga, comando nativo, preservação dos dados, igualdade entre as três apresentações D&D, coleções deduplicadas e importação de um layout genérico com rejeição de campo inválido.

As amostras usam 42 itens, 65 parágrafos, nome longo, recurso atual/máximo e dado composto. PDFs reais gerados pelo Edge 154.0.4258.48 em A4 foram extraídos e renderizados em PNG, com inspeção de todos os contatos e páginas representativas em tamanho maior:

| Amostra | Completo | Compacto |
| --- | --- | --- |
| D&D preenchido | [11 páginas](../output/pdf/profiles/dnd2024-full.pdf) | [5 páginas](../output/pdf/profiles/dnd2024-compact.pdf) |
| Autoral preenchido | [16 páginas](../output/pdf/profiles/sistema-rpg-full.pdf) | [7 páginas](../output/pdf/profiles/sistema-rpg-compact.pdf) |
| Registro espacial importado | [3 páginas](../output/pdf/profiles/imported-full.pdf) | [3 páginas](../output/pdf/profiles/imported-compact.pdf) |

As 45 páginas passaram na conferência de A4, limites de texto, ausência de páginas vazias e conteúdo esperado de cada perfil. Os 42 itens estão presentes uma vez em ambos os formatos. Os 65 parágrafos estão integrais no Completo; no importado também permanecem no Compacto porque o diário não declara resumo. A quantidade de páginas do importado demonstra que o perfil não promete reduzir todo layout.

A escolha de formato foi capturada e inspecionada em 360 e 1280 px, nos temas claro/escuro, sem overflow, caixa fora da tela ou erros de JavaScript. Evidências locais: `output/design/print-profiles/`, `output/pdf/profiles/verification.json` e contatos/PNGs nas pastas de cada PDF. `output/` é ignorado pelo Git. Os resultados anteriores em [design-pdf.md](design-pdf.md) são históricos e usam outras amostras/configurações.

Reprodução, sem suítes concorrentes na porta 4173:

```sh
npm run test:e2e -- --workers=2
node tests/capture-print-profiles.mjs
python tests/verify-print-profiles.py
python tests/render-design-pdfs.py output/pdf/profiles
```

Os scripts Python usam PyMuPDF e Pillow opcionais, instalados localmente em `tmp/pdf-tools`; não fazem parte da aplicação. Capturas usam perfil isolado e a porta 4175, sem acessar a biblioteca pessoal. Cabeçalhos nativos do navegador devem ficar desligados. Impressoras físicas, opções de escala/fundos e navegadores diferentes podem alterar paginação; não foram verificados nesta execução.
