# Eventos e gatilhos locais

Em **Compor → Eventos e gatilhos locais**, escolha um dado numérico observado ou um evento nomeado, a ação tipada e as origens aceitas. O gatilho começa desabilitado; habilitá-lo e aplicar sua definição são escolhas explícitas. O pacote vazio continua sem automações pré-configuradas.

Um cruzamento ascendente inclusivo ocorre quando o valor anterior está abaixo do limite e o posterior o atinge ou supera: 9 → 10 cruza 10; 10 → 11 não cruza novamente. Há direção descendente e opção estrita de ultrapassar. Ausência e null não contam como zero. Vários limites ficam ordenados pela direção e podem gerar uma execução agregada ou uma por limite.

Escolha a frequência: por evento/limite, por cena confirmada, por personagem ou até cruzar de volta. A cena muda somente pelo controle explícito **Iniciar nova cena nesta confirmação**; o relógio real não a decide. Os marcadores de frequência acompanham o personagem salvo.

As origens têm controles próprios:

- **Resultado confirmado de ação:** inclui a cadeia na prévia de conclusão de uma [ação tipada](action-flows.md). Ativação e checkpoint de dados conservam seu perfil próprio; não geram uma segunda cadeia implícita.
- **Edição explícita pelo painel:** **Eventos e gatilhos → Revisar edição e gatilhos** prepara o novo valor e suas consequências antes de gravar. Edições pelos campos comuns continuam sem disparos automáticos.
- **Evento nomeado confirmado:** seleciona e revisa um evento de jogo. Abrir o painel não o executa.

Uma ação determinística pode entrar na mesma confirmação quando usa o perfil de prévia, não lança dados e tem suas entradas obrigatórias vinculadas ao evento. Fontes nomeadas permitem usar antes/depois, limite individual, lista ou quantidade de limites, cena, direção, origem e identidade do evento. Os vínculos são tipados; entradas temporárias não criam valores no personagem. Uma lista de limites usa uma coleção com um campo numérico. Limite individual exige a opção de execução por limite.

Dados, escolhas e decisões narrativas ficam em **propostas guardadas**. Revisar uma proposta abre a ação com as entradas vinculadas preenchidas, permitindo completar as escolhas e cancelar. A proposta só é removida na conclusão confirmada. Se houver ativação paga, seu vínculo fica no marco salvo: retomar depois de recarregar conserva a origem e não paga novamente. Uma proposta com ativação pendente precisa ser retomada antes de ser dispensada.

A prioridade e o ID estável ordenam os gatilhos. Cada onda avalia o mesmo snapshot; eventos derivados entram na onda seguinte. Escritas sobrepostas na mesma onda são recusadas, com diagnóstico. Para consequências aditivas sobre o mesmo destino, prefira uma execução agregada e vincule a quantidade de limites à expressão da ação. Não há regra implícita de “última escrita vence”. Ciclos possíveis entre ações determinísticas são recusados, incluindo escrita de um registro que contém o dado observado.

**Confirmar cadeia** grava raiz, consequências, custos, marcadores, propostas e registro de antes/depois pelo mesmo writer e journal da biblioteca. Uma falha ou conflito conserva a ficha inteira; a prévia pode ser revisada. Repetir o mesmo evento comprometido não repete suas consequências. Desfazer/refazer reaplica os patches guardados e seus marcadores, sem gerar novos eventos ou consultar RNG. Carregar, importar, recuperar e migrar também não disparam gatilhos.

O painel mostra **Eventos registrados** e permite exportar o personagem completo. **Arquivar identidades de eventos concluídos** conserva uma cópia em recuperação e preserva frequências/propostas. O histórico da sessão pode desfazer esse arquivamento. Não há expurgo automático.

Limites: 100 gatilhos, 100 limites por definição, 16 ondas e 100 disparos por cadeia; orçamento compartilhado de 100 mil passos de avaliação. Estado de eventos em personagem v3: até 100 registros, 100 propostas, 1000 identidades de raiz e 256 KiB no conjunto. Ao esgotar a capacidade, uma nova cadeia é bloqueada até o arquivamento explícito. Personagens antigos exigem habilitação v3 explícita, com preservação do original; abrir não os converte.

A execução é local a um personagem. Não inclui transações entre fichas, polling, cenas inferidas ou scripts do pacote. Texto inválido da autoria permanece no rascunho e bloqueia exportação/aplicação até ser corrigido ou descartado. Pacote exportado leva regras; personagem exportado leva marcadores e registros. O ensaio usa personagem isolado, sem incluir seus resultados no pacote.
