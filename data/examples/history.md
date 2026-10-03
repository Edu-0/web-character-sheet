# Desfazer e refazer edições

Os botões de seta junto ao seletor de layout desfazem e refazem alterações do personagem ativo. Os atalhos são **Ctrl/⌘ Z**, **Ctrl/⌘ Shift Z** e **Ctrl Y**. Eles operam na ficha, inclusive em campos editáveis; busca, bandeja de dados e painéis abertos conservam sua própria interação de teclado.

O histórico é **desta sessão da página**. Recarregar ou fechar a página o apaga, mantendo os dados salvos da ficha. Cada personagem tem seu histórico; trocar de sistema, layout ou apresentação D&D não cria uma cópia nem mistura os históricos. Restaurar a biblioteca reinicia todos os históricos. Abrir dados diferentes para o mesmo personagem também reinicia o histórico correspondente.

## Operações e limites

- Digitação contínua no mesmo controle é agrupada enquanto o intervalo entre alterações for menor que um segundo. Sair do campo ou realizar outra ação encerra o grupo.
- Uma ação reúne seus campos, recursos e registros: descanso, evolução, uso de técnica e lançamento com consumo podem ser desfeitos juntos. Listas conservam IDs e ordem ao adicionar, remover e mover entradas.
- Refazer restaura os valores registrados; não executa regras, cobra pontos ou rola dados novamente. Resultados transitórios nos componentes não são reconstruídos ao refazer; a bandeja mantém as rolagens originais.
- Uma nova edição após desfazer descarta o caminho de refazer. As opções de desfazer específicas de recuperação, ação e evolução continuam funcionando e também são edições registradas pelo histórico geral.
- São mantidas até **50 operações** e **2 MiB de patches por personagem**, para os **10 personagens usados mais recentemente**. Ao exceder os limites, operações antigas são descartadas. Uma alteração isolada maior que 2 MiB encerra o histórico anterior e não pode ser desfeita pelo histórico geral; o personagem continua editável e salvável.

O histórico cobre mudanças nos dados notificadas ao aplicativo, incluindo ajustes de cálculo, retratos e **Limpar ficha**. Metadados de identidade e datas não são revertidos. Preferências, navegação, layouts, importação/exclusão na biblioteca e resultados transitórios de dados não são operações de personagem. Os patches não entram no JSON, backup ou impressão. Registros próprios de evolução e recuperação continuam salvos no personagem conforme seus contratos.

## Integração com componentes

Componentes reutilizáveis continuam usando `context.onChange()` depois de alterar o personagem. A captura em `js/state.js` ocorre após os listeners de atualização, incluindo os defaults aplicados durante o refresh. Ao montar ou trocar layout, o shell sincroniza a base do histórico para que os defaults de apresentação não apareçam como edições manuais.

`js/character-history.js` guarda diferenças por caminhos segmentados. Objetos são comparados por campo; coleções são guardadas inteiras, preservando identidade e ordem. Chaves literais com pontos, como as de `calculationOverrides`, não são interpretadas como caminhos. Campo ausente e `null` são distintos.

Antes de aplicar uma operação, todos os campos afetados precisam corresponder aos valores esperados e o personagem resultante precisa passar pela validação do pacote ativo. Divergência ou erro cancela a operação inteira. Alterações externas em campos não afetados são preservadas. Depois, o shell atualiza as apresentações e agenda o salvamento pelo fluxo habitual; falhas de armazenamento mantêm a ficha em memória para exportação.
