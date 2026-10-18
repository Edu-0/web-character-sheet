# Registros, coleções e composição v3

Em **Sistemas → Criar pacote → Compor**, abra **Registros, coleções e compostos**. O pacote começa vazio. Crie um registro, uma coleção de registros, uma escolha, um traço ou uma referência; nenhum deles exige um componente. Para acrescentar campos, escolha o registro, a coleção ou o catálogo em **Onde definir o novo dado**.

Use o card **Valor tipado** para mostrar e editar esses dados. Uma coleção oferece formulário de nova entrada, inclusão, remoção e reordenação. Campos obrigatórios podem ser preenchidos nesse formulário mesmo sem inicial. A presença distingue ausência, null, texto vazio, false e zero. Alterações que duplicam um campo declarado único ou deixam referências órfãs são recusadas antes de mudar o personagem.

Quando um registro ou uma coleção estão ausentes, **Preencher registro/coleção** permite preparar os campos antes de confirmar tudo junto. Isso permite criar uma coleção com mínimo de entradas maior que zero. Em **Unicidade de…**, marque os campos por nome: cada campo marcado deve ter valores distintos entre as entradas. Catálogos oferecem inclusão, edição e remoção de entradas com revisão; editar conserva a identidade da entrada.

Para consultar uma coleção em outra apresentação, acrescente **Grupo aninhado**, selecione a coleção em **Repetir grupo** e inclua componentes dentro dele. Cada ocorrência acompanha a identidade da entrada; reordenar não troca seus vínculos. Na prévia, selecionar um filho repetido aponta para sua definição original. **Experimentar** atualiza a revisão da composição antes de ensaiar mudanças; a amostra fica fora do pacote exportado.

Cada coleção pode aparecer uma vez na cadeia de repetição de um grupo; repetir a mesma identidade dentro dela é recusado para evitar um contexto ambíguo. Referências em campos de catálogos apontam somente a catálogos do sistema, inclusive dentro de registros aninhados. Dados do personagem podem referenciar catálogos e coleções do personagem.

**Orientação sem campo** mostra título e texto seguro, sem criar um valor no personagem. Grupos, caixas e seções v3 podem começar vazios. Um título ou uma nota permanecem informativos; um grupo sem conteúdo não inventa controles. Busca e impressão leem a mesma expansão limitada, incluindo informações e rótulos de escolhas/referências. A impressão compacta respeita a exclusão de um grupo inteiro.

A prévia de composição oferece uma área para incluir componentes em grupos vazios, inclusive quando a coleção repetida ainda não tem entradas. Essa indicação pertence à autoria e não preenche a coleção. No papel, seções vazias com título ou nota conservam essas informações.

Selecione um grupo e use **Revisar grupo como composto local** para compartilhar sua apresentação. Os vínculos de dados tornam-se parâmetros nomeados e tipados. Outra instância pode usar os mesmos dados ou dados independentes. Editar um texto compartilhado afeta todas as instâncias; copiar a definição cria uma apresentação independente. **Desvincular** transforma a instância em grupo, conservando dados, disposição, repetição, notas, ajuda, variante, opções de impressão e extensões. Cópia de apresentação não copia valores do personagem.

| Contrato | Limite e comportamento |
| --- | --- |
| Definições de dados | Até 500, contando campos aninhados; IDs únicos, independentes dos rótulos e do armazenamento. |
| Registros e coleções | Até oito níveis e 64 campos por registro. Uma coleção contém até 1000 entradas com IDs únicos e estáveis. Campos filhos têm binding relativo de uma chave; `id` é reservado à entrada. |
| Restrições | Número/inteiro: `minimum`/`maximum`; texto: `maxLength`; coleção: `minItems`/`maxItems` e `unique` por IDs de campos. Sem coerção durante leitura. |
| Escolha (`enum`) | Opções nomeadas com ID estável; o personagem guarda o ID, e busca/papel mostram o rótulo. |
| Traço (`trait`) | Array de tamanhos de dados da escala declarada. Um dado ou composição explicitamente permitida, até oito dados. A definição declara a escala; não depende do nome do RPG. |
| Referência (`reference`) | Uma identidade ou lista de identidades únicas, com destino explícito: catálogo do sistema ou coleção do personagem. Falta/ambiguidade de destino é erro. |
| Catálogo | `system.catalogs`: até 100 catálogos, cada um com ID, rótulo, campos tipados e entradas identificadas. A referência aponta ao original. |
| Composição | `information`, `group`, `componentInstance` e `dataField` exigem v3. Até oito níveis de composição e 10000 passos/componentes expandidos. Ciclos são recusados. |
| Composto local | `system.componentDefinitions`: até 100 definições com ID, revisão, parâmetros de dados tipados e componentes. A instância guarda `definitionId` e `bindings` explícitos. |

Os contratos e a execução v1/v2 continuam próprios. Abrir não converte o pacote nem inicializa personagens existentes. Iniciais só participam de criação ou reset explícito. A edição usa o documento canônico, as operações, o histórico e o preflight comuns. Mudanças estruturais em dados instalados com personagens vinculados exigem [migração explícita com revisão](data-migration.md); mudar rótulo ou inicial não migra dados salvos.

Os cálculos numéricos de [primeiro vínculo](typed-data.md) mantêm seu recorte. O conjunto atual também oferece [consultas](rule-queries.md), [predicados](predicates.md), [ações e resoluções](action-flows.md), [gatilhos](rule-events.md), [efeitos](typed-effects.md), [concessões](progression-choices.md) e [migração](data-migration.md). Cada capacidade exige configuração explícita; a existência de campos estruturados não as executa. Testes automatizados não comprovam compreensão por iniciantes, aparelhos físicos ou tecnologias assistivas.

[Exemplo de registros e composição](structured.package.json): criado pelos controles no percurso automatizado desde um pacote vazio, com apenas nome/ID do sistema ajustados para distribuição. Mostra coleção, campos filhos, orientação e apresentação repetida; não contém consultas ou regras ocultas.

[Exemplo adicional de composto local](local-composition.package.json) acrescenta uma definição compartilhada e duas instâncias, ligadas a valores independentes 2 e 9. Este exemplo documenta o contrato; o teste visual também constrói duas instâncias pelos controles.


As receitas de recuperação existentes também podem escolher dados v3 declarados e campos de coleções vazias. Os menus usam os bindings relativos dos campos, incluindo registros internos; não precisam de entradas de amostra. Cura por dados continua usando as fontes declaradas e o mesmo executor, prévia, confirmação e desfazer. Ausência de valor corrente bloqueia a execução sem criar um inicial. Recuperações em lote por caminho não percorrem coleções internas: consultas aninhadas têm seu escopo próprio. Ao criar outra recuperação no mesmo destino, um painel compatível sem condições adicionais é reutilizado; cada ação mantém a configuração explícita.


Na cura por dados, o saldo mínimo para começar é uma escolha explícita e pode permanecer ausente. O cálculo do modificador usa o personagem da prévia e é relido ao aplicar; edição posterior da fonte impede usar uma prévia antiga. O contexto da renderização não é reutilizado em outra cópia do personagem. Nenhuma alteração na política de versões v1/v2 ou conversão ao abrir.
