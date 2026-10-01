# Direitos e distribuição

Este documento explica a [licença do código](../LICENSE) e as pendências de publicação. Não é um parecer jurídico ou uma certificação de que todo o conteúdo foi auditado. Consulte LICENSE para as permissões concedidas.

## Código da aplicação

O código original da aplicação, engine, estilos, testes, validação e documentação técnica está sob uma licença própria de código disponível para uso não comercial com atribuição. A concessão inclui a organização e implementação concretas protegidas, mas não cria exclusividade sobre ideias de arquitetura, formatos abstratos ou funcionalidades.

MIT e Apache-2.0 não atendem à restrição comercial pretendida: ambas permitem uso comercial por terceiros. Uma licença com restrições dessa natureza deve ser descrita como **código disponível / source-available**, não como open source segundo a [definição da Open Source Initiative](https://opensource.org/osd).

Uso, modificações privadas, forks e compartilhamento gratuito não comercial são permitidos. Créditos e avisos devem ser preservados; versões hospedadas precisam disponibilizá-los em Sobre, Créditos ou equivalente. Não há obrigação geral de publicar alterações privadas.

Vender cópias, cobrar por acesso ou hospedagem, monetizar com anúncios e prestar serviços pagos que utilizem o software coberto exigem autorização escrita. Arrecadação vinculada à distribuição ou hospedagem, inclusive para pagar servidores, também depende de autorização. Ser uma organização sem fins lucrativos não constitui uma exceção automática.

As restrições recaem sobre o software coberto, não sobre a titularidade de fichas, conteúdos ou programas criados independentemente. Contribuições originais de terceiros precisam ter permissões compatíveis para integrar uma distribuição.

O nome público do titular, o endereço oficial para atribuição e o canal de autorização comercial precisam ser confirmados antes do lançamento. Não foi inferido um nome civil a partir do usuário do computador ou do histórico Git.

## Conteúdo original do RPG autoral

O conteúdo original fornecido pelo autor permanece sem licença aberta concedida por este projeto. Essa separação abrange textos do livro e conteúdo autoral reproduzido ou adaptado nos arquivos `data/systems/sistema-rpg.*.json`, `data/characters/sistema-rpg.example.character.json` e `docs/sistema-rpg.md`.

Essa reserva não reivindica exclusividade sobre ideias, métodos, mecânicas abstratas ou elementos de terceiros. A licença da engine não autoriza automaticamente publicar o livro, suas artes ou sua identidade visual.

## D&D e materiais de terceiros

D&D e Dungeons & Dragons são marcas da Wizards of the Coast. Este é um projeto independente e não oficial.

Os [SRDs publicados pela Wizards](https://www.dndbeyond.com/srd) oferecem conteúdo sob CC BY 4.0. A [FAQ oficial para criadores](https://www.dndbeyond.com/creator-faq) diferencia esse material das Basic Rules e de outros conteúdos que não recebem a mesma autorização. Textos de livros e traduções não devem ser considerados livres apenas porque tratam das mesmas regras.

A implementação D&D existente ainda não tem uma auditoria de proveniência concluída. Antes de distribuição pública:

1. Identifique a origem de textos, traduções, tabelas e exemplos nos JSONs, no código e no HTML estático.
2. Separe criação própria, conteúdo do SRD e material que depende de outra autorização.
3. Para conteúdo derivado do SRD, registre a versão utilizada, a atribuição exigida, a licença e as modificações realizadas.
4. Remova ou substitua materiais sem autorização compatível. Atribuição isolada não resolve falta de permissão.
5. Confira os avisos na distribuição final, inclusive para usuários que recebem apenas o aplicativo hospedado.

Este documento não declara que o módulo inteiro é CC BY 4.0 nem que deriva exclusivamente de uma versão específica do SRD.

## Referências privadas e dados dos usuários

`docs/references/` é uma pasta local de pesquisa ignorada pelo Git. Isso não impede sua exposição por um servidor que hospede a pasta inteira. Não a inclua em sites, pacotes ou capturas públicas sem autorização.

Personagens e pacotes importados podem conter textos e imagens com direitos próprios. Usar o aplicativo não transfere esses direitos ao projeto nem concede permissão de redistribuição a outros usuários.

## Antes do primeiro lançamento

- Confirmar os titulares, os créditos públicos e o canal de autorização comercial.
- Concluir a auditoria de conteúdo D&D e assets de terceiros.
- Separar arquivos públicos de testes, dependências e referências privadas.
- Preservar avisos de dependências redistribuídas.
- Revisar juridicamente a licença própria antes do lançamento.

Não aplique uma licença Creative Commons genérica à raiz do projeto: software, conteúdo autoral e direitos de terceiros precisam ser diferenciados.
