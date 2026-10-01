# Avisos de terceiros

Este inventário não substitui as licenças completas nem certifica a proveniência de todo o projeto. Dependências mantêm suas próprias licenças, independentemente da licença não comercial da engine.

## Ferramentas de desenvolvimento

- `@playwright/test`, `playwright` e `playwright-core`: Apache-2.0, conforme os metadados do lockfile e os avisos dos pacotes instalados. Projeto: [Microsoft Playwright](https://github.com/microsoft/playwright). Usados nos testes; não são importados pela aplicação no navegador.
- Dependências transitivas e navegadores têm seus próprios avisos. Preserve-os se redistribuir esses componentes; seu uso nos testes não permite relicenciá-los como código próprio.

## Fontes e ícones

A interface usa pilhas de fontes do sistema, sem arquivos de fontes incluídos no repositório. Citar uma família em CSS não distribui seu arquivo nem concede licença sobre ela.

Os ícones são definidos em SVG inline em `js/icons.js`. A ausência de uma dependência externa não comprova a origem dos desenhos; confirme a proveniência antes do lançamento e acrescente avisos se algum asset derivar de uma biblioteca de terceiros.

## Conteúdo de RPG

O módulo D&D é não oficial. Marcas e materiais da Wizards of the Coast permanecem sujeitos aos direitos de seus titulares. O SRD possui sua própria licença e obrigações, que não se estendem automaticamente a outros materiais.

O livro original do Sistema de RPG é conteúdo autoral separado da engine. Referências locais não são materiais destinados à distribuição.

As artes autorais selecionadas em `assets/artwork/` foram integradas com autorização do autor e mantêm direitos separados da licença da engine. O [registro de artes](assets/artwork/README.md) identifica as adaptações dos dados e símbolos e as composições decorativas locais. A aplicação não carrega a pasta de referências do livro.

Veja [Direitos e distribuição](docs/licensing.md) para a política pretendida e as pendências antes da publicação.
