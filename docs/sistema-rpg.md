# Sistema de RPG: ficha assistida

A referência é o livro fornecido em `docs/references/Sistema RPG/conteudo-livro.tex`, especialmente os capítulos 1–10, os exemplos do capítulo 15 e os casos especiais do capítulo 16. O resultado é uma ficha assistida de personagem jogador, não um simulador de campanha ou árbitro automático da ficção. A variante visual `editorial` é reutilizável: tipografia sem serifa e grupos com hierarquia clara. As cores seguem a paleta escolhida nas Configurações da aplicação, com modo claro ou escuro independente; o layout não impõe uma cor de sistema.

## Perícias

Perícias não registradas permanecem gratuitamente em d4. A ficha normal mostra apenas as que ultrapassaram esse dado. **Editar perícias** abre o catálogo por categoria; escolher d4 remove a entrada do personagem. **Concluir edição** volta à lista compacta. As categorias e os nomes continuam definidos no JSON do sistema.

## Criação

Em **Progressão**, a Qualidade determina o orçamento e o teto inicial das Perícias e dos Atributos. Buffs e Debuffs têm nome e pontos, sem dado: Leve 1, Médio 2, Pesado 4 e Debilitante 8, conforme a tabela opcional do livro. A ficha soma Buffs e subtrai Debuffs automaticamente dos pontos disponíveis. **Ajuste de pontos de criação** continua disponível para outras convenções da campanha; não repita nele um valor já registrado como Buff ou Debuff. Entradas antigas que eram apenas texto mantêm o nome e começam com 0 pontos, sem presumir sua intensidade; selecione o valor correspondente.

Os custos são cumulativos:

| Dado final | Perícia, partindo de d4 | Especialização, partindo de 0 |
| --- | --- | --- |
| d4 | 0 | 1 |
| d6 | 1 | 3 |
| d8 | 3 | 7 |
| d10 | 7 | 15 |
| d12 | 15 | 31 |

Cada Técnica possui **Pontos pagos na criação**, inicialmente 0. Técnicas gratuitas do repertório permanecem em 0; uma compra adicional usa o custo combinado com a mesa. O livro não define um preço universal para toda Técnica. Este campo é independente do Dado Máximo e do Custo de Energia.

**Concluir criação** registra os gastos, o orçamento, a Qualidade, os totais de Buffs/Debuffs e uma cópia das escolhas iniciais em `progression.creation`. Saldo negativo, custo indefinido ou Perícia acima do teto impedem a conclusão. É possível concluir com pontos não utilizados; eles permanecem no saldo de criação, sem virar automaticamente pontos de evolução. A criação pode ser reaberta para correção antes de existirem evoluções registradas. Os modificadores iniciais ficam bloqueados após a conclusão; concessões posteriores devem ser registradas no orçamento/histórico de evolução, sem recontar os pontos iniciais.

Especializações mostram o custo cumulativo por entrada e o total das escolhas atuais em sua própria aba. No orçamento de criação, d4 custa 1; d6, 3; d8, 7; d10, 15; d12, 31. Esses valores somam todos os passos desde 0, não apenas o último Aprimoramento.

Os campos de Técnicas e outros campos complexos têm um botão **i** junto ao rótulo. Passe o mouse, foque pelo teclado ou toque/clique para abrir uma explicação flutuante, sem deslocar os campos. A caixa se posiciona dentro da tela e acima dos cartões; Escape ou um clique fora fecha. As mensagens vêm da propriedade `help` do layout ou do `itemSchema`, permitindo reutilizar a mesma ajuda contextual em outros sistemas.

## Evolução

Depois da criação, os gastos iniciais ficam congelados. Informe o total recebido em **Pontos de evolução recebidos** e use **Registrar evolução**:

- **Narrativa / gratuita** melhora o traço selecionado e registra custo 0.
- **Paga com pontos** sugere o custo para Perícias e Especializações usando as tabelas do sistema. O custo pode ser ajustado pela campanha; para Técnicas, é informado explicitamente.
- **Outro / registro livre** permite lançar uma aquisição ou melhoria que não tenha um dado editável nesse formulário. Preencha a descrição e faça a alteração correspondente na ficha.

O formulário atualiza Atributos, Perícias, Especializações, Essências e Técnicas existentes. Perícias ainda em d4 também podem ser adquiridas por ele. Uma nova Técnica ou Especialização é cadastrada em sua aba; seu eventual pagamento durante a campanha pode ser registrado como lançamento livre. Custos que o livro não define explicitamente precisam ser combinados com a mesa: não se presume um preço para todo Atributo, Essência ou Técnica.

Nos traços habilitados, **Traço composto / Ascensão** aceita `d12 + d6`. A Ascensão inicial tem custo definido pela campanha, não pela fórmula pós-Ascensão. O módulo **Custos opcionais após Ascensão** sugere `16 + 8n` para evoluções de um traço já composto: 24, 32, 40 etc. A ficha não decide se a Ascensão é permitida. Na aba Atributos, o seletor de composição também permite edição direta; aplicar um conjunto inicial substitui os dados, que devem ser redistribuídos pelo jogador segundo as regras de criação.

Edições diretas durante o jogo são ajustes da ficha e não descontam pontos automaticamente. Para uma melhoria paga, utilize o formulário de evolução. Cada lançamento guarda origem, custo, descrição, data e, quando há um traço vinculado, o dado anterior e posterior. Isso permite que a mesma Técnica custe pontos ao ser criada e evolua narrativamente sem cobrar novamente o custo inicial.

**Desfazer última evolução** restaura o dado anterior e devolve os pontos desse lançamento. Se o traço foi removido ou alterado depois, a operação solicita corrigir seu dado antes de desfazer. A identidade do item é preservada ao reordenar listas.

## Uso, recursos e recuperação

**Técnicas → Uso assistido** monta os testes e paga Energia na ativação, inclusive em falha. Uma técnica aprendida pode usar um dado menor sem consumir seu Dado Máximo. Custo especial vazio usa a tabela de Energia; um valor explícito é uma exceção definida pela capacidade e não é recalculado automaticamente. As versões reduzidas de capacidades com custo especial precisam da convenção da campanha.

Os modos distinguem técnica aprendida, técnica nova da mesma Especialização (duas Reduções), mesma área (uma Redução), Especialização desconhecida (Atributo + d4), conhecimento genérico e manutenção de concentração. As tentativas não aprendidas pagam pelo dado original, não pelo dado reduzido. A resolução informa Reverso e o impacto de risco muito alto, mas a mesa escolhe a consequência concreta. A concentração só se torna ativa após resolução bem-sucedida; sua manutenção padrão não paga Energia novamente. Exceções de custo e consumo da ação bônus continuam explícitas na descrição e no controle da mesa.

**Recursos** oferece descanso curto/longo, nova rodada, uso de Reação, ganho/gasto de RA e encerramento de concentrações. Descanso curto rola cada Especialização e soma a recuperação, limitada à Energia máxima, além de reduzir Exausto recuperável. Descanso longo restaura Energia e remove Exausto recuperável. Nenhum descanso apaga Ferido ou Trauma. A última ação pode ser desfeita enquanto os campos afetados não tiverem mudado. RA depende das condições próprias das Essências; os botões não inventam um gatilho universal.

**Estados** permite aplicar Potência e registrar o resultado de um teste de cura já resolvido. Falha não cura; sucesso reduz um nível ou remove o estado quando a Potência é maior. O limite de descanso curto restringe a uma Redução. Desgaste d12 que recebe novo Aprimoramento gera Trauma d6 vinculado e sinaliza retirada; repetições elevam esse Trauma até d12, e o próximo excesso sinaliza limite letal, salvo exceção. A cura não decide automaticamente retorno à cena. Características permanentes são registradas separadamente.

**Inventário** calcula peso × quantidade dos itens carregados, compara com a soma máxima de Força × multiplicador pessoal e informa sobrecarga. O multiplicador padrão é 5, inclusive quando o campo estiver ausente em uma ficha; valores personalizados são preservados. Penalidades, propriedades, requisitos, alcance e consumo de itens dependem da regra aplicável, sem presumir redução de dano por armadura.

**Combate → Pool** permite selecionar fontes relevantes, incluindo equipamentos e estados, e inserir dados de apoio. A opção **Perícia não graduada — d4** permite selecionar uma perícia no dado base sem cadastrá-la ou mostrá-la na ficha compacta; use-a em vez do dado de uma perícia aprendida quando apropriado. Vírgulas representam fontes separadas; `+` forma um único Traço Composto. Um traço composto rola e soma internamente, mas conta como uma fonte. Aprimoramentos temporários precisam omitir o dado original e informar seu substituto; uma Ascensão temporária acrescenta um dado separado. Também é possível rolar uma oposição personalizada, como `d8, d8, d6` para curar um estado d6. Em uma Pool de um dado, Peso é o resultado único, não o dobro. Cada resultado informa o tamanho do dado (ou a composição inteira) junto à função Ápice, Base ou Potência disponível; uma fonte única informa Ápice e Base simultaneamente.

## Cobertura e limites deliberados

| Referência | Suporte da ficha | Decisão manual |
| --- | --- | --- |
| 1–3: dados, Pools e resolução | dados simples/compostos, seleção de Potência, oposição, d20 e críticos por Dificuldade | fontes relevantes, ação possível e compatibilidade do efeito |
| 4: criação e traços | Qualidade, orçamento, conjuntos de Atributos, catálogo, Especializações, três Essências | redistribuição dos Atributos, concessões e exceções da campanha |
| 5: capacidades e estados | repertório mínimo, técnicas, energia, concentração, características e estados graduados | efeitos, limitações, reversos e propriedades especiais |
| 6: combate | iniciativa, velocidade, carga, Pool, Reação por rodada | movimento tático, ação principal/bônus, gatilhos, preparação, montaria e múltiplos alvos |
| 7: recuperação e sobrevivência | descanso, aplicação do resultado de cura, recursos graduados de apoio | testes de Fadiga, oposição/condições de tratamento e redução de reservas após manutenção |
| 8–9: modificadores e evolução | ajuste de pontos, registros narrativos/pagos, desfazer e composição pós-Ascensão opcional | preço de melhorias sem tabela, autorização de Ascensão e concessão de pontos |
| 10: ficha padrão | identidade, traços, recursos, itens, estados e notas | personalizações da campanha |
| 11–14: NPCs, ameaças e condução | descrições e notas podem registrar informações | gerenciamento de NPCs, Grupos/Bosses/Fases, encontros e arbitragem do Mestre; fora da ficha de PJ |
| 15–16: exemplos e casos especiais | casos centrais de Pool, cura, Energia e críticos exercitados | exceções narrativas; desempate composto usa o maior componente como convenção explícita |

Isso conclui o escopo de **ficha assistida de PJ**, não a automação integral de todas as regras do livro. Fases de Bosses e um gerenciador de cena são módulos distintos, não campos obrigatórios desta ficha.

## Configuração e verificação

`sistema-rpg.system.json` contém custos, presets, orçamento, receitas de teste e ações declarativas. `sistema-rpg.layout.json` decide onde aparecem os componentes. `skillCatalog`, `pointBudget`, `traitAllocation`, `repertoire`, `techniqueUse`, `inventorySummary`, recuperação e `actionGroup` não verificam o ID do sistema. Outros sistemas podem reutilizar configurações compatíveis com seus contratos de dados; regras realmente diferentes devem ganhar módulos próprios. Não se promete que qualquer livro possa ser representado sem ampliar a biblioteca.

`tests/e2e/system-rpg-progression.spec.js` exercita os pontos; `system-rpg-components.spec.js` cobre os componentes e o catálogo compacto; `system-rpg-assistance.spec.js` cobre carga, descanso, cura, limites de Desgaste, RA/Reação, técnicas, concentração, composição e repertório. As verificações incluem persistência e telas móveis. A referência estática D&D permanece separada e é coberta pela regressão existente.
