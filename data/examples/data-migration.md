# Migração dos dados instalados

O editor permite alterar explicitamente os dados de um pacote instalado junto com **todos os seus personagens vinculados**. O catálogo original permanece separado da cópia editada. Abrir um arquivo ou mudar um rótulo não converte personagens.

## Revisar e confirmar

1. Em **Sistemas → Editar pacote**, altere o candidato no mesmo documento do editor. Use v3 explicitamente para os dados tipados. Guarde uma exportação da biblioteca.
2. Abra **Migração dos dados instalados → Preparar migração dos dados**. Essa ação incrementa `system.dataRevision` pelo histórico JSON existente; cancelar a preparação permite retirar esse incremento se ele ainda for o esperado.
3. Escolha fontes e destinos pelos dados identificados. Os rótulos ajudam na leitura; identidades e bindings continuam distintos. Para cada conversão, escolha conservar a origem ou removê-la com cópia recuperável. Destinos preenchidos bloqueiam por padrão e exigem conservar ou substituir explicitamente.
4. Configure conversões permitidas: conservar valor, texto, número, inteiro com arredondamento, Sim/Não com textos explícitos, mapa de valores/identidades, dividir ou juntar textos. **Inicializar somente ausentes** exige um valor explícito; `null`, texto vazio, zero e Não já são valores presentes. O inicial declarado só é expandido quando você o solicita.
5. Para dados descontinuados, escolha conservar no personagem, admitir que o original fique na recuperação ou remover do personagem com original recuperável. A escolha de recuperação permite que outro destino ocupe o binding; não exige apagar um campo ainda inofensivo.
6. Atualize o ensaio e use **Revisar migração e personagens**. Confira contagens, diagnósticos, entradas identificadas, amostras antes/depois e remoções. Há até dez amostras e dez patches por personagem; valores longos aparecem abreviados. O relatório mostra cinquenta personagens por vez, com opção de mostrar mais. Os originais completos ficam na cópia baixável. Conflitos de destino podem ter decisão individual por personagem.
7. Só uma revisão sem conflitos libera **Aplicar pacote**. A confirmação grava pacote, todos os personagens, índice e cópia de recuperação pela mesma transação usada na biblioteca. O ativo é recarregado a partir do documento salvo, com histórico de edição reiniciado.

Alterar o candidato, as escolhas, a ficha ativa ou a biblioteca depois da revisão exige conferir novamente. Uma ficha não salva em outra janela impede a gravação. Clientes antigos ou sem coordenação também bloqueiam a substituição: preserve a edição e reabra essas janelas. O rascunho conserva as escolhas, mas a autorização de aplicação e as prévias dos personagens são recalculadas; não são persistidas como autoridade.

## Revisões e recuperação

`system.dataRevision` é opcional em sistemas v3, inteiro de 1 a 1000000. Sem declaração, a revisão inicial é 1. A migração instalada exige o próximo inteiro, carimbando `character.meta.systemDataRevision` sem alterar o `schemaVersion` do personagem. Criação e reset usam a revisão declarada; abertura/importação de personagem de outra revisão é recusada e conserva o arquivo original. Sistemas v1/v2 não interpretam esses metadados. Se um personagem já usava esse nome antes da adoção do contrato, a substituição requer escolha explícita e preserva o original na recuperação.

Em **Consultar cópias de migração**, baixe os originais ou revise uma restauração. A restauração conjunta só é permitida se pacote e todos os personagens vinculados ainda coincidirem com o estado guardado após a migração. Edição posterior, personagem novo/removido, pacote alterado ou cópia indisponível bloqueiam a operação. Restaurar cria uma cópia inversa. O rascunho do editor permanece preservado e passa a ter como base o pacote restaurado; ele não substitui automaticamente esse pacote novamente.

A cópia `rpg-data-migration` v1 guarda pacote e personagens anteriores, brutos originais, escolhas e guardas do estado posterior. Cópias corrompidas/futuras não executam operações; a recuperação geral das configurações permite exportar seus brutos. Se não houver espaço para cópia e journal, a operação falha e conserva a biblioteca. Um journal interrompido é recuperado pelo mecanismo comum antes de novas gravações.

## Limites

As conversões são declarativas e limitadas; não executam JavaScript nem cobram evolução, rolam dados ou reexecutam ações. Números exigem texto decimal completo, sem coerção de `null`, vazio ou booleano. Divisão limita partes e junção exige fontes de texto presentes no mesmo escopo de coleção. As fontes vêm do snapshot anterior: não há encadeamento arbitrário entre passos.

IDs de entradas, extras e registros de proveniência são preservados. Alterações incompatíveis em enum, referência, dado concedido ou efeito ativo bloqueiam a migração. Revisões antigas de concessões mantêm seus custos/snapshots; um efeito ativo de outra revisão não é reinterpretado automaticamente. Não há conversor universal de históricos ou substituição automática de origens de jogo.

O plano aceita até 500 passos, 10000 personagens, 100000 avaliações de valores e 32 MiB; a cópia de recuperação também precisa caber em 32 MiB. Cada personagem usa o aplicador comum, limitado a 10000 patches. Migração parcial e múltiplas revisões instaladas simultaneamente para o mesmo sistema não fazem parte deste fluxo.

Consulte [dados tipados](typed-data.md), [dados estruturados](structured-data.md), [catálogo](catalog.md) e [editor JSON](editor-json.md).
