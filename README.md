# Ficha RPG

Aplicação web para criar, preencher e organizar fichas de RPG de mesa. Uma engine declarativa transforma sistemas e layouts em JSON em fichas responsivas, com componentes reutilizáveis e assistência opcional às regras.

**Status:** protótipo funcional em desenvolvimento, ainda sem lançamento de produção. Os nomes do aplicativo e do RPG autoral são provisórios. Estruturas de dados podem mudar; exporte seus personagens antes de atualizar.

## Funcionalidades atuais

- Biblioteca local de sistemas e personagens, com criação, duplicação e importação/exportação em JSON.
- Fichas modulares com abas, cartões, listas, tabelas e ajuda contextual flutuante.
- Temas claro/escuro, responsividade e impressão pelo navegador, inclusive salvar como PDF.
- Rolagens, fórmulas e assistência configuráveis conforme o sistema.
- Persistência por `localStorage`, sem backend ou conta de usuário.
- Testes de interface com Playwright, incluindo persistência, regras assistidas e telas móveis.

O aplicativo não é um VTT, um simulador de campanha nem um árbitro automático. A mesa continua responsável por decisões narrativas e exceções.

## Sistemas incluídos

| Sistema | Implementação |
| --- | --- |
| D&D 5e (2024) | Ficha modular com cálculos e controles de personagem. A apresentação estática permanece separada para comparação visual. Não automatiza todo o livro. |
| RPG autoral, ainda sem nome | Ficha assistida com criação por pontos, evolução, perícias, traços compostos, Técnicas, Energia, estados, recuperação, carga e Pool. |
| Sistema fictício de teste | Exemplo técnico para verificar componentes sem depender dos sistemas principais. |

Consulte a [comparação D&D estático × modular](docs/dnd-parity.md) e a [cobertura do sistema autoral](docs/sistema-rpg.md).

## Executar localmente

Requisitos: Node.js **22 ou superior**, npm e um navegador moderno. Os testes estão configurados para usar o Microsoft Edge instalado.

```sh
npm ci
node tests/static-server.mjs
```

Abra [http://127.0.0.1:4173](http://127.0.0.1:4173). Encerre o servidor com `Ctrl+C`.

Use HTTP: abrir `index.html` diretamente por `file://` não é o fluxo suportado, pois a aplicação carrega módulos JavaScript e arquivos JSON.

O servidor fornecido é apenas para desenvolvimento local e serve arquivos do repositório. **Não o exponha à internet nem publique a pasta inteira com referências privadas.** Para hospedagem, selecione os arquivos públicos e use uma hospedagem estática apropriada.

## Testar

Pare o servidor manual antes de executar os testes: a configuração inicia seu próprio servidor na porta 4173.

```sh
npm run test:e2e
npm run test:e2e:headed
```

Para executar somente um conjunto:

```sh
npx playwright test tests/e2e/system-rpg-assistance.spec.js
npx playwright test tests/e2e/dnd-parity.spec.js
```

Capturas e traces ficam em `test-results/`, que não é versionado. Para usar Chromium em vez de Edge, ajuste o `channel` em `playwright.config.js` e instale o navegador correspondente pelo Playwright.

## Arquitetura

O sistema define dados e regras; o layout define a apresentação; o personagem guarda escolhas e valores. O renderizador conecta essas partes.

```text
data/systems/       Sistemas, layouts e manifesto
data/characters/    Personagens de exemplo
js/engine/         Renderização, campos, fórmulas, dados e assistência
js/systems/        Componentes específicos de um sistema
js/repositories/   Persistência e importação/exportação
js/validation/     Validação dos documentos JSON
css/               Temas, componentes, responsividade e impressão
tests/e2e/         Testes de interface e regressão
docs/              Cobertura, decisões e direitos de uso
```

No repositório, cada sistema tem arquivos `*.system.json` e `*.layout.json`. Na importação/exportação, eles são reunidos em um pacote `rpg-system-package`, com `schemaVersion`, `system` e `layouts`. Personagens são documentos separados.

### Criar outro sistema

1. Use uma definição existente como exemplo e escolha um ID próprio.
2. Defina o `characterTemplate` e as configurações de regras no sistema.
3. Monte abas e componentes no layout, vinculando campos aos dados do personagem.
4. Importe um pacote pela biblioteca de sistemas ou registre seus arquivos em `data/systems/index.json` para incluí-los no aplicativo.
5. Teste criação, edição, exportação, recarga e apresentação móvel.

Os contratos são verificados em `js/validation/schemas.js`. As definições incluídas são exemplos executáveis; ainda não existe um editor visual completo ou uma documentação completa de todos os componentes.

Regras compatíveis reutilizam a biblioteca. Mecânicas novas podem exigir novos componentes JavaScript: não se promete representar qualquer livro apenas com JSON.

## Assistência e ajustes manuais

Campos editáveis podem ser alterados diretamente. No sistema autoral, ajustes durante o jogo não cobram pontos de evolução automaticamente: melhorias pagas devem ser registradas pelo fluxo de evolução.

Resultados calculados ainda não têm substituição manual universal. Algumas escolhas iniciais ficam bloqueadas após concluir a criação. Assistência não significa automação completa.

## Dados e privacidade

Personagens, sistemas importados e preferências ficam no armazenamento local do navegador. Não há sincronização entre dispositivos nem backup em nuvem implementado. Limpar os dados do site ou mudar de navegador ou endereço pode tornar a biblioteca anterior indisponível.

**Exporte os JSONs para manter backups.** Um arquivo exportado pode conter nomes, anotações e imagens: revise-o antes de compartilhar. Importar ou exportar uma ficha não transfere direitos sobre seu conteúdo.

## Próximos passos

- Polimento visual e de acessibilidade.
- Busca global entre abas, com tolerância a erros de digitação.
- Ajustes manuais explícitos para resultados calculados, com retorno ao automático.
- Editor visual de sistemas, layouts e módulos.
- Documentação dos componentes e novos sistemas para ampliar a biblioteca.

Esses itens são planejamento, não funcionalidades já disponíveis.

## Contribuições e desenvolvimento com IA

O projeto é desenvolvido com auxílio de IA, orientado por decisões de produto e revisão humana. Isso não substitui testes, validação de regras ou verificação de autoria e licenças.

Ao propor mudanças, preserve a referência estática D&D, mantenha regras específicas fora do renderizador genérico quando possível e acrescente testes para comportamentos novos. Não inclua livros, artes, fontes ou textos de terceiros sem autorização compatível.

## Direitos e licenças

O código original da aplicação e da engine está sob uma [licença própria de uso não comercial](LICENSE), incluindo sua estrutura implementada: permite uso, modificações, forks e compartilhamento gratuito não comercial com atribuição. Exploração comercial exige autorização escrita dos titulares. Não é uma licença open source MIT ou Apache-2.0.

Venda, acesso pago, assinaturas, monetização por anúncios e serviços pagos que utilizem o software coberto exigem autorização. Arrecadação vinculada à distribuição ou hospedagem também depende de autorização. A licença não reivindica direitos sobre conteúdo independente criado pelos usuários nem sobre ideias abstratas de arquitetura.

Os termos devem ser revisados juridicamente antes do lançamento; a licença não comprova a autoria ou a proveniência de todas as partes do repositório.

O conteúdo original do RPG autoral permanece separado e sem licença aberta. Referências em `docs/references/` são locais, ignoradas pelo Git e não integram a distribuição planejada.

O projeto não é afiliado, patrocinado ou aprovado pela Wizards of the Coast. A licença do SRD não libera todos os livros, traduções, imagens ou marcas de D&D. A proveniência do conteúdo do módulo D&D ainda precisa ser auditada antes de distribuição pública.

Leia [Direitos e distribuição](docs/licensing.md) e [Avisos de terceiros](THIRD_PARTY_NOTICES.md) antes de redistribuir.
