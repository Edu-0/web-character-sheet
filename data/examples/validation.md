# Validação e preservação de documentos

Sistema, layout, personagem e pacote são documentos distintos. `schemaVersion` identifica seu formato; a versão do aplicativo e o namespace do armazenamento não são versões desses documentos.

`prepareDocument` em `js/validation/documents.js` verifica limites, versão, contratos e referências sem alterar a entrada. Retorna `ready`, `needsMigration`, `unsupported` ou `invalid`, com diagnósticos de severidade, código, caminho e JSON Pointer. A referência por ponteiro respeita chaves literais com ponto. O limite de 200 diagnósticos produz um erro explícito de truncamento.

Referências de catálogo ausentes são diferentes de catálogos vazios. Os layouts são conferidos em conjunto: colisões entre cálculos com a mesma chave de ajuste são recusadas; referências de item removidas permanecem nos dados e podem ter aviso. Os contratos assistidos têm validação própria. Isso não valida integralmente a construção ou todas as regras de um livro.

A importação oferece prévia e confirmação quando converte os aliases conhecidos de rolagens para os nomes atuais. A transformação trabalha em cópia, preserva campos extras e guarda o original na recuperação na mesma transação da gravação. Valores contraditórios entre nomes antigos/novos exigem correção. Abrir uma ficha não reescreve seu pacote. Os migradores são funções do aplicativo; um pacote não fornece código executável.

A normalização percorre somente locais do contrato: definições de entryRolls, componentes de lista com ação de rolagem e opções das entradas consumidas pelos layouts do pacote. Não procura aliases recursivamente em metadados. Sem o pacote do personagem, suas coleções permanecem intactas; ter uma propriedade chamada rollOptions não demonstra que ela seja uma configuração de rolagem. Preparação inválida ou versão não suportada impede a importação antes de qualquer gravação. Aliases contraditórios também são recusados sem solicitar normalização.

Propriedades não expostas pela interface permanecem no documento. Objetos de regras com opções desconhecidas podem ser recusados para impedir interpretação incorreta; o original continua no arquivo importado ou na recuperação dos dados locais. `extensions` é o espaço de metadados opacos nos contratos estritos de rolagem/recuperação. Não movemos automaticamente dados antigos para esse espaço.

Um pacote local indisponível não oculta os demais. Documentos locais de versões futuras ficam protegidos contra sobrescrita e visíveis para exportação do original. Antes de substituir um sistema importado, validamos todos os personagens vinculados, incluindo o personagem ativo recebido pelo aplicativo. A substituição incompatível é recusada e a cópia anterior fica recuperável quando a substituição confirmada é gravada.

O characterTemplate é validado contra os mesmos consumidores do personagem, incluindo definições/revisões, duplicidade e grupos de efeitos. O ID do personagem pode estar ausente no template e é atribuído ao criar a ficha. Valores padrão declarados, como configFrom = pointBudget, são resolvidos pelo mesmo descritor usado na referência e no runtime.

As cópias e o journal exigem espaço adicional. Falha de gravação mantém dados em memória; o journal permite rollback, mas não fornece isolamento entre abas. Feche outras sessões de edição antes de substituir um pacote. Backup, exportação individual e recuperação continuam sendo os caminhos para conservar seus dados. Não há migração inversa automática.

Os testes Node verificam contratos e transformações; Playwright verifica importação, confirmação, substituição, quota e exportação. A documentação de [backup/histórico](history.md) e [offline](offline.md) descreve ciclos independentes.
