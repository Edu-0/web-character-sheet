# Traços da Jornada

Este [pacote fictício](traits.package.json) reúne criação, evolução, técnicas, Pool, recursos, carga e estados em Padrão e Mesa. Foi construído desde vazio pelos controles de Compor. Seus números são escolhas explícitas do exemplo; fontes, preços, condições e consequências continuam editáveis.

## Preparar o personagem

Preencha Buffs/Debuffs iniciais com nome e pontos. O exemplo soma Buffs e subtrai Debuffs do orçamento-base 14. Valores 4/2 mostram orçamento 16; 2/2 deixam 14. **Confirmar orçamento inicial** apresenta a mudança antes de registrar o saldo e bloquear os modificadores iniciais. Cancelar conserva a edição. O comando não pode ser repetido depois da confirmação.

Em **Distribuir conjunto inicial**, escolha Vigor e atenção ou Domínio e presença. A primeira distribuição usa d6/d6/d4/d4; a segunda d4/d4/d6/d6. A escolha custa zero no exemplo e registra as concessões. A mesa pode redistribuir os traços; não há pagamento universal implícito para Atributos.

Adicione uma Especialização, dê-lhe nome e deixe o campo Traço ausente antes do aprendizado. Selecione-a em Especialização a treinar. Aprender d6 custa 3 desde zero. Adicione uma Perícia e selecione-a em Perícia a aprimorar: treinar d6 custa 1 desde d4. Com teto de Qualidade d6, adquirir perícia d8 é recusado. As tabelas cumulativas também expressam perícia d8 por 3 e especialização d8 por 7 desde as respectivas bases.

A conclusão exige orçamento confirmado e Atributos/Perícias dentro do teto, inclusive quando o traço foi editado diretamente. Corrija a condição indicada antes de concluir. O exemplo com essas duas aquisições deixa saldo 10 e gasto 4 congelados; a sobra não vira evolução. Avançar a Perícia d6 para d8 custa 2 na origem paga e zero na narrativa. Edição direta continua sem cobrança. Essências têm traços editáveis e uma concessão narrativa d4→d6 por entrada, sem preço universal inventado.

## Técnica e resolução

Adicione uma Técnica, vincule a Especialização e selecione-a em Técnica escolhida. O máximo limita o dado usado. Energia é compartilhada entre o recurso principal e Energia na mesa.

Usar técnica vinculada compromete o preço antes de lançar: d6 custa 2 mesmo quando o teste falha. Exceção de custo zero cobra zero; null utiliza a tabela. Tentativa reduzida usa o dado original para o preço. Manutenção é gratuita no perfil configurado, exige concentração ativa e respeita o grau sustentado. Encerrar a concentração é um comando separado.

A Pool mantém cada fonte separada, escolhe Ápice/Base e oferece as fontes restantes para Potência. Peso não duplica uma fonte única; Potência usa o tamanho da fonte escolhida, com piso declarado. A dificuldade é 10 + Peso da oposição − Peso do ator. Com Peso9/oposição7, d20=8 falha e 9 passa. Dificuldade≤0 ou ≥20 produz o crítico configurado sem d20; as faces da Pool continuam sendo lançadas. Resultados naturais 1/20 não decidem críticos por si só.

Somente sucesso ativa concentração. Fechar após comprometer Energia permite retomar o registro sem pagar novamente. Cancelar antes do compromisso conserva os recursos.

## Repouso, carga e estados

Repouso breve lança as Especializações atuais, soma recuperação de Energia até o máximo, reduz apenas Exausto recuperável e restaura usos marcados Breve. Repouso completo restaura Energia, remove somente Exausto recuperável e inclui usos marcados Completo. Ferido, Trauma, estados não recuperáveis e usos manuais permanecem.

A carga soma quantidade × peso apenas dos itens Carregados da mesma coleção de usos. Capacidade usa o maior dado do Atributo do teste × multiplicador. O multiplicador ausente usa 5; zero explícito continua zero.

Aplicar cura na jornada recebe sucesso, Potência e a escolha de limitar a uma redução. Falha conserva o estado; sucesso reduz um grau ou remove quando a Potência supera o grau sem o limite. A mesa escolhe o estado tratado e decide a possibilidade da cura.

Aplicar excesso declarado escolhe Desgaste d12 e cria Trauma d6 relacionado por identidade. Novos excessos avançam esse vínculo até d12; no limite, o pacote apresenta uma orientação para a mesa. Não decide morte, retirada ou exceções narrativas automaticamente.

Nova rodada recupera Reação por confirmação; Reagir a gasta. Ganho de RA exige o marcador de autorização da mesa e usa o valor informado. Nenhuma rolagem infere uma condição universal de Essência.

Desfazer/refazer conserva identidades e registros sem novos dados. Exportar/reimportar o personagem preserva a criação congelada, evolução, referências, concentrações e estados relacionados. Consulte [ações](action-flows.md), [progressão](progression-choices.md), [histórico](history.md) e [dados estruturados](structured-data.md).
