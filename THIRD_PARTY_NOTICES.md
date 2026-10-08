# Avisos de terceiros

Este inventário não substitui as licenças completas nem certifica a proveniência de todo o projeto. Dependências mantêm suas próprias licenças, independentemente da licença não comercial da engine.

## Ferramentas de desenvolvimento

- `esbuild` **0.28.2**, versão exata no manifest/lockfile: MIT, Copyright (c) 2020 Evan Wallace. [Projeto e licença](https://github.com/evanw/esbuild/blob/v0.28.2/LICENSE.md). Ferramenta de build, sem dependência npm no navegador. A licença completa acompanha o pacote em `node_modules/esbuild/LICENSE.md`; preserve-a ao redistribuir a ferramenta. O bundle contém o código local da prévia, sob os termos próprios do projeto e de seus assets.

- `@playwright/test`, `playwright` e `playwright-core`: Apache-2.0, conforme os metadados do lockfile e os avisos dos pacotes instalados. Projeto: [Microsoft Playwright](https://github.com/microsoft/playwright). Usados nos testes; não são importados pela aplicação no navegador.
- Dependências transitivas e navegadores têm seus próprios avisos. Preserve-os se redistribuir esses componentes; seu uso nos testes não permite relicenciá-los como código próprio.

## Fontes e ícones

A interface usa pilhas de fontes do sistema, sem arquivos de fontes incluídos no repositório. Citar uma família em CSS não distribui seu arquivo nem concede licença sobre ela.

Os ícones são definidos em SVG inline em `js/icons.js`. A ausência de uma dependência externa não comprova a origem dos desenhos; confirme a proveniência antes do lançamento e acrescente avisos se algum asset derivar de uma biblioteca de terceiros.

## Conteúdo de RPG

### Fate Acelerado

This work is based on Fate Core System and Fate Accelerated Edition (found at https://www.faterpg.com/), products of Evil Hat Productions, LLC, developed, authored, and edited by Leonard Balsera, Brian Engard, Jeremy Keller, Ryan Macklin, Mike Olson, Clark Valentine, Amanda Valentine, Fred Hicks, and Rob Donoghue, and licensed for our use under the Creative Commons Attribution 3.0 Unported license (https://creativecommons.org/licenses/by/3.0/).

O pacote usa nomes de campos, resumos próprios em português e implementação independente das mecânicas; não inclui artes, logos ou tradução integral. Fate é marca de Evil Hat Productions, LLC. Adaptação não oficial, sem endosso. [Referência e cobertura](data/examples/additional-systems.md).

### Blades e referências de Cthulhu

This work is based on Blades in the Dark (found at http://www.bladesinthedark.com/), product of One Seven Design, developed and authored by John Harper, and licensed for our use under the Creative Commons Attribution 3.0 Unported license (http://creativecommons.org/licenses/by/3.0/).

O pacote de compatibilidade usa campos e resumos próprios do SRD, sem cenário, mapas, artes ou playbooks. Blades in the Dark é marca de One Seven Design. Não há endosso ou afiliação.

Cthulhu 7e usa como referência de mecânicas o Quick-Start gratuito da Chaosium (2021), sem redistribuir seu texto, personagens, aventura ou imagens. Call of Cthulhu e seus materiais pertencem aos respectivos titulares. A disponibilidade gratuita de uma referência não a coloca sob a licença da engine.

### SWADE, Ironsworn e Ordem Paranormal

Savage Worlds e SWADE pertencem à Pinnacle Entertainment Group. O Test Drive 2020 foi consultado para implementar mecânicas e campos, sem reproduzir aventura, personagens, imagens, poderes ou vantagens. Esta ficha é independente e não oficial.

This work is based on Ironsworn, created by Shawn Tomkin, and licensed for our use under the Creative Commons Attribution 4.0 International License (https://creativecommons.org/licenses/by/4.0/).

O pacote usa o SRD disponibilizado sob CC BY 4.0, com resumos próprios em português e implementação de mecânicas. Não inclui artes, ícones, cenário ou livro integral. Não é um produto oficial Tomkin Press. [Fonte e termos específicos](https://tomkinpress.com/pages/licensing).

Ordem Paranormal é uma ficha preenchível independente baseada nos nomes de campos da ficha pública da Jambô, sem o desenho oficial, textos do livro, catálogos ou regras não verificadas. Marcas e conteúdos permanecem com seus titulares; não há endosso ou afiliação.

### D&D, RPG autoral e artes

O módulo D&D é não oficial. Marcas e materiais da Wizards of the Coast permanecem sujeitos aos direitos de seus titulares. O SRD possui sua própria licença e obrigações, que não se estendem automaticamente a outros materiais.

O livro original do Sistema de RPG é conteúdo autoral separado da engine. Referências locais não são materiais destinados à distribuição.

As artes autorais selecionadas em `assets/artwork/` foram integradas com autorização do autor e mantêm direitos separados da licença da engine. O [registro de artes](assets/artwork/README.md) identifica as adaptações dos dados e símbolos e as composições decorativas locais. A aplicação não carrega a pasta de referências do livro.

Consulte a [licença da aplicação](LICENSE). A documentação interna de direitos e as pendências de distribuição ficam na memória privada do projeto, sem integrar o repositório público.
