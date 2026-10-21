# Leitura e edição de entradas

Listas configuradas para edição em janela mostram o conteúdo como texto e oferecem um **lápis** junto ao nome. A janela reúne os campos da entrada e oferece **Salvar** e **Cancelar**. Escape cancela. Alterar campos nessa janela não modifica a ficha antes de salvar; incluir uma entrada também começa por um rascunho, sem cadastrar um item vazio ao abrir.

Em formulários longos, os campos rolam dentro da janela e Salvar/Cancelar permanecem visíveis. Opções exclusivas de recuperação usam círculos com Ajuste manual explícito; controles independentes usam checkboxes quadrados.

Controles rápidos podem continuar na ficha: por exemplo, **Preparada** em magias, usos atuais em habilidades e dado atual em técnicas. Rolagens, lançamento de magias, movimentação e remoção conservam seus comandos. Inventários e tabelas continuam com edição direta.

O modo é uma propriedade do componente `list` no **layout**, separada dos dados do personagem e das regras do sistema. Componentes sem a propriedade continuam com edição direta. Nos formulários do editor, essas opções estão no grupo **Apresentação**: **Modo de edição das entradas** e **Campos rápidos na ficha**.

```json
{
  "type": "list",
  "label": "Habilidades",
  "field": "abilities",
  "editMode": "dialog",
  "quickFields": ["uses"],
  "itemSchema": {
    "name": { "type": "text", "label": "Nome" },
    "uses": { "type": "number", "label": "Usos atuais" },
    "description": { "type": "textarea", "label": "Descrição" }
  }
}
```

É um fragmento de layout; o pacote precisa fornecer a coleção `abilities` no template. `editMode` aceita `inline` (padrão) ou `dialog`. `quickFields` é opcional, exige `dialog` e contém nomes distintos existentes em `itemSchema`; uma lista vazia deixa todos os campos no lápis. Esta configuração não se aplica a `table`, `stateList`, `dataField` ou outros tipos. Coleções tipadas de `dataField` mantêm sua edição atual.

`editMode` escolhe a apresentação da edição. `editableWhen`, quando configurado, continua determinando **se** a edição é permitida. A condição é conferida novamente ao salvar. A identidade da entrada e propriedades adicionais são preservadas. Se um campo alterado no rascunho também mudou na ficha, o salvamento é recusado e a janela mantém o rascunho para consulta; cancele e reabra para usar a versão atual. Mudanças em outros campos não são sobrescritas. Entrada removida também impede salvar.

Salvar usa o fluxo existente de edição do personagem e oferece desfazer/refazer. Não cobra evolução automaticamente nem inventa custos. Busca global continua encontrando o conteúdo e abre sua apresentação de leitura. Impressão/PDF usa os dados salvos, mesmo com entradas recolhidas; rascunhos da janela ficam fora do documento e do backup do personagem.

O modo também funciona no ensaio isolado do editor. Alterações da amostra não editam o pacote nem o personagem ativo. Fechar o ensaio ou trocar a ficha descarta a janela de edição daquela renderização.

Reconstruir a mesma ficha durante a edição conserva a janela, seu texto e o foco. Salvar usa a lista atual e mantém as verificações de condição, remoção e conflito; mudanças em outros campos continuam preservadas. A transferência exige o mesmo personagem, sistema e definição do componente, incluindo suas condições de edição. Entradas sem ID só podem ser reencontradas quando seu objeto original continua na lista. Se a lista ou sua definição sair do layout, o texto permanece disponível para consulta ou cópia, mas Salvar não aplica alterações ali. Cancelar continua descartando somente o rascunho. Essa continuidade é temporária: recarregar a página, sair da ficha ou encerrar o ensaio não salva o rascunho da janela.

Os layouts embutidos usam o lápis em ataques, magias, habilidades e listas relacionadas; controles rápidos são definidos explicitamente em cada layout. Cópias locais de pacotes já editadas pelo usuário não são reescritas automaticamente pela atualização dos arquivos embutidos.
