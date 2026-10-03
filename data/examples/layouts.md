# Layouts múltiplos e modo mesa

Um pacote de sistema pode incluir vários documentos em `layouts`. O seletor **Layout da ficha** mostra todos eles. Alternar layouts mantém o mesmo personagem, suas entradas e seus recursos; não cria cópias nem lança evolução. A preferência fica salva por sistema neste navegador e acompanha **Exportar tudo**.

Cada layout tem `id` único dentro do pacote, `system` igual ao ID do sistema e suas próprias `tabs`. Os campos dos componentes continuam apontando para o mesmo documento de personagem.

```json
{
  "schemaVersion": 1,
  "id": "mesa",
  "name": "Modo mesa",
  "mode": "table",
  "system": "meu-sistema",
  "tabs": [
    {
      "id": "session",
      "label": "Em jogo",
      "sections": [
        {
          "id": "resources",
          "title": "Recursos",
          "containers": [
            {
              "layout": { "type": "stack" },
              "components": [
                { "type": "resource", "field": "energy", "label": "Energia" },
                { "type": "textarea", "field": "notes", "label": "Notas" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Esse fragmento deve integrar um pacote cujo template forneça `energy: { "current": 3, "max": 3 }` e `notes: ""`. Não é um pacote completo para importar isoladamente.

| Propriedade do layout | Contrato |
| --- | --- |
| `name` | Nome opcional, não vazio. Sem ele, usa o nome do manifesto embutido ou o `id`. |
| `mode` | Opcional: `sheet` (padrão) ou `table` (modo mesa). Não depende do nome ou do ID. |
| `tabs` | Conteúdo declarado para essa apresentação; não há inferência automática de quais campos seriam essenciais. |

O modo mesa usa uma composição mais enxuta, com seções lado a lado quando há largura e uma coluna no celular. Componentes de listas, tabelas, Pool e uso de técnicas ocupam a largura disponível. Mantém os controles de edição, rolagens e assistência definidos no layout.

Os sistemas embutidos incluem **Padrão** e **Modo mesa**: veja [D&D](../systems/dnd2024.table-layout.json) e [RPG autoral](../systems/sistema-rpg.table-layout.json). Seus layouts completos permanecem separados. Regras vêm do sistema e dos componentes, não do modo escolhido.

A busca prioriza o layout atual e inclui campos das outras apresentações, evitando resultados repetidos. Um resultado em outro layout identifica essa apresentação e a abre antes de revelar o campo. Na ficha estática D&D, a busca prioriza a referência completa; resultados de outro layout abrem a modular.

**Imprimir / PDF** continua oferecendo Completo/Compacto. Quando o layout de tela é mesa, imprime o primeiro layout do pacote que não seja mesa; se todos forem mesa, usa o atual. Fora do modo mesa, imprime o layout selecionado. Alternar o layout de tela não altera a preferência de impressão.

No D&D, estática/modular/comparação continuam disponíveis. Escolher um layout enquanto a estática está ativa abre a modular. Na comparação, abas com o mesmo ID acompanham a navegação; abas exclusivas de uma apresentação mantêm a outra no seu último destino compatível. Ambas editam o mesmo personagem.

Se a preferência apontar para um layout removido numa atualização do pacote, abre o primeiro disponível. Pacotes com um só layout continuam funcionando. Essa etapa não inclui criação ou edição de layouts pela interface.
