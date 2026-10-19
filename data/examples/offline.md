# Instalação e uso offline

Em **Configurações → Instalar e usar offline**, acompanhe a preparação. A primeira abertura precisa de conexão para baixar o aplicativo e seus sistemas embutidos. Quando a preparação terminar, o status muda para **Disponível offline**, sem exigir recarga. Se o navegador ainda oferecer **Reabrir para ativar offline**, esse comando salva a ficha e o rascunho antes de recarregar; falha de salvamento mantém a edição na página. Reabrir reinicia o histórico de desfazer daquela sessão.

O botão **Instalar aplicativo** aparece quando o navegador oferece a instalação. Você também pode usar seu menu de instalação. No iPhone/iPad, use Compartilhar → Adicionar à Tela de Início. A disponibilidade depende do navegador e do endereço: service workers exigem contexto seguro, normalmente HTTPS; localhost/127.0.0.1 servem para desenvolvimento. Consulte a [orientação de instalação da MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

Depois de preparado, o aplicativo pode abrir, editar, salvar, buscar, rolar dados, importar/exportar arquivos locais e preparar impressão sem rede. Os oito sistemas embutidos e seus 16 layouts são preparados juntos, mesmo que você ainda não os tenha aberto. Pacotes importados e retratos locais ficam na biblioteca do navegador. Links externos, downloads externos e verificação/preparação de novas versões precisam de conexão. Retratos externos continuam sem carregamento automático, conforme o contrato existente.

Instalar não cria conta, nuvem ou backup. Os dados permanecem vinculados à origem e ao perfil do navegador. Instalações/perfis diferentes podem ter bibliotecas diferentes; use **Exportar tudo** para transferir ou proteger os dados. O navegador pode remover armazenamento por falta de espaço ou ação do usuário. O estado de disponibilidade offline verifica os arquivos presentes no cache, mas não garante sua retenção futura.

## Atualizações

O aplicativo prepara uma versão completa em um cache separado. Cada arquivo precisa corresponder ao hash daquela versão. Falha de rede, armazenamento ou arquivo divergente impede ativar a nova versão; o app atual e os personagens salvos permanecem.

O app procura atualizações ao abrir, ao recuperar conexão, ao voltar à janela e a cada minuto enquanto estiver visível. A checagem automática tem intervalo mínimo de um minuto. Quando a versão estiver pronta, um aviso aparece na ficha e no editor com **Atualizar agora** e **Depois**. O mesmo comando fica em Configurações → Instalar e usar offline. O aviso não recarrega a página sozinho.

**Atualizar agora** coordena as abas abertas do mesmo aplicativo: salva alterações da ficha e rascunhos do editor, aguarda as gravações e só então ativa a versão completa e reabre as abas. Campos pendentes do editor ficam no rascunho, sem serem aplicados ao pacote; depois da atualização, use **Recuperar rascunho** em Sistemas. A recarga reinicia o histórico transitório e a amostra de ensaio.

Uma janela de edição ou confirmação aberta, conflito de gravação, falta de armazenamento ou aba que não responde impede a troca. A interface é liberada e explica como tentar de novo. Conclua ou cancele os diálogos antes de atualizar. Abas com versões antigas que ainda não reconhecem esse procedimento precisam ser fechadas uma vez; depois de receber esta versão, não é necessário usar uma guia anônima.

A limpeza atinge somente caches deste aplicativo e escopo; personagens, preferências, rascunhos e caches de outros aplicativos são preservados. A atualização não apaga dados do site. A troca explícita segue o [ciclo de vida de service workers](https://web.dev/articles/service-worker-lifecycle) e usa [skipWaiting](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting) após a preparação das abas. O conjunto inteiro muda junto, evitando servir módulos de versões diferentes durante a edição.

Em **Verificar / preparar offline**, o aplicativo procura uma versão nova e tenta recuperar arquivos faltantes da versão ativa, sempre verificando seus hashes. O indicador **Offline** acompanha o estado de conexão informado pelo navegador; estar conectado não garante que o servidor responda. As gravações da biblioteca são coordenadas entre abas; não há edição colaborativa ou sincronização entre dispositivos. Atualizar o app não converte os documentos. A [migração de dados instalados](data-migration.md) é um fluxo explícito e separado, com revisão e confirmação.

## Desenvolvimento

O [catálogo local](catalog.md) usa os sistemas já preparados com o aplicativo. Instalar ou reinstalar funciona offline; excluir uma instalação não remove os arquivos originais do catálogo do cache. As cópias editáveis e a seleção de sistemas instalados ficam na biblioteca local e são incluídas em Exportar tudo.

O editor JSON e seu runtime de prévia também são locais. `build:offline` gera primeiro o bundle isolado; `check:offline` confere ambos. esbuild é dependência de desenvolvimento com versão fixada e não é carregado no navegador. Rascunhos ficam no armazenamento da origem e têm [download próprio](editor-json.md), separado do backup da biblioteca.

`manifest.webmanifest`, os ícones em `assets/app/`, `js/pwa.js` e `sw.js` implementam instalação e disponibilidade. O worker usa uma lista restrita de recursos estáticos: HTML principal, CSS, módulos do runtime, vetores e os JSONs referenciados pelo manifesto de sistemas embutidos. Não há cache dinâmico de personagens, backups, referências privadas, exemplos, screenshots, testes ou documentação.

Depois de mudar arquivos do runtime ou manifestos, execute:

```sh
npm run build:offline
npm run check:offline
```

O gerador em `scripts/build-offline.mjs` incorpora hashes SHA-256 e uma versão determinística no worker, a partir de `scripts/service-worker.template.js`. Não edite `sw.js` manualmente. Publicar arquivos sem regenerá-lo pode impedir a preparação de uma versão nova. Uma publicação precisa entregar o conjunto completo; preparar offline não constitui empacotamento público nem publicação do site.

Servidores de desenvolvimento podem acrescentar um script de recarga ao documento; o [Live Server](https://github.com/ritwickdey/vscode-live-server/blob/master/lib/live-server/index.js) e o Five Server usam blocos identificados distintos. Em localhost, 127.0.0.1 e loopback IPv6, o worker consegue retirar esses blocos e verificar o hash exato do arquivo original. Inclui a indentação final inserida pelo Five Server no head. Apenas o conteúdo original entra no cache; alterações reais continuam impedindo a preparação. Depois de reabrir a versão offline, a página não inclui o script de recarga do servidor. Use a verificação de atualização e regenere o worker quando alterar o runtime.

Quando a preparação falha, a mensagem indica o arquivo e a causa disponível, por exemplo HTTP 404/503, download interrompido ou conteúdo de outra versão. Corrija os arquivos/conexão e use **Verificar / preparar offline** para tentar novamente. Recarregar após atualizar o código carrega o diagnóstico novo; não é necessário apagar a biblioteca do navegador.

Os testes regeneram o worker antes de iniciar o servidor. Durante desenvolvimento, regenere o worker ao alterar o runtime e use Atualizar agora. Se uma aba ainda executar uma versão anterior a esse fluxo, feche as abas antigas uma vez e reabra. Limpar todos os dados do site também apaga personagens; exporte a biblioteca antes dessa operação. O servidor de desenvolvimento continua servindo o repositório inteiro: não hospede essa pasta ou suas referências privadas.

Ícones PNG são renderizados a partir do símbolo SVG do cabeçalho com `node scripts/build-icons.mjs`, usando Playwright/Edge, sem rede ou arte externa. O manifesto e registro usam caminhos relativos e suportam instalação em uma subpasta com seu próprio escopo.

Os testes de PWA exercitam service workers reais com rede desligada e releases simuladas em memória. O diálogo de instalação é exercitado por evento simulado; não instalam o aplicativo no sistema operacional. A revisão em iOS/Safari e aparelhos físicos ainda precisa ser feita antes de uma publicação para esses ambientes.
