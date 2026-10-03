# Instalação e uso offline

Em **Configurações → Instalar e usar offline**, acompanhe a preparação. A primeira abertura precisa de conexão para baixar o aplicativo e seus sistemas embutidos. Quando aparecer **Preparação concluída**, use **Reabrir para ativar offline** ou feche e reabra o app. A reabertura salva a ficha antes de recarregar; uma falha de salvamento mantém a edição na página. Reabrir reinicia o histórico de desfazer daquela sessão.

O botão **Instalar aplicativo** aparece quando o navegador oferece a instalação. Você também pode usar seu menu de instalação. No iPhone/iPad, use Compartilhar → Adicionar à Tela de Início. A disponibilidade depende do navegador e do endereço: service workers exigem contexto seguro, normalmente HTTPS; localhost/127.0.0.1 servem para desenvolvimento. Consulte a [orientação de instalação da MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

Depois de preparado e reaberto, o aplicativo pode abrir, editar, salvar, buscar, rolar dados, importar/exportar arquivos locais e preparar impressão sem rede. Os dois sistemas embutidos e seus layouts são preparados juntos, mesmo que você ainda não os tenha aberto. Pacotes importados e retratos locais ficam na biblioteca do navegador. Links externos, downloads externos e verificação/preparação de novas versões precisam de conexão. Retratos externos continuam sem carregamento automático, conforme o contrato existente.

Instalar não cria conta, nuvem ou backup. Os dados permanecem vinculados à origem e ao perfil do navegador. Instalações/perfis diferentes podem ter bibliotecas diferentes; use **Exportar tudo** para transferir ou proteger os dados. O navegador pode remover armazenamento por falta de espaço ou ação do usuário. O estado de disponibilidade offline verifica os arquivos presentes no cache, mas não garante sua retenção futura.

## Atualizações

O aplicativo prepara uma versão completa em um cache separado. Cada arquivo precisa corresponder ao hash daquela versão. Falha de rede, armazenamento ou arquivo divergente impede ativar a nova versão; o app atual e os personagens salvos permanecem.

Quando aparecer **Atualização pronta**, feche todas as abas e janelas do Ficha RPG e reabra. Recarregar uma única janela enquanto outras estão abertas mantém a versão antiga. Não há troca forçada ou recarga automática durante o jogo. A limpeza de caches antigos ocorre depois da ativação e atinge somente os caches deste aplicativo e escopo; não altera a biblioteca, preferências ou caches de outros aplicativos. Esse comportamento segue o [ciclo de vida de service workers](https://web.dev/articles/service-worker-lifecycle).

Em **Verificar / preparar offline**, o aplicativo procura uma versão nova e tenta recuperar arquivos faltantes da versão ativa, sempre verificando seus hashes. O indicador **Offline** acompanha o estado de conexão informado pelo navegador; estar conectado não garante que o servidor responda. Não há sincronização entre abas nem migração geral de schemas nesta etapa.

## Desenvolvimento

`manifest.webmanifest`, os ícones em `assets/app/`, `js/pwa.js` e `sw.js` implementam instalação e disponibilidade. O worker usa uma lista restrita de recursos estáticos: HTML principal, CSS, módulos do runtime, vetores e os JSONs referenciados pelo manifesto de sistemas embutidos. Não há cache dinâmico de personagens, backups, referências privadas, exemplos, screenshots, testes ou documentação.

Depois de mudar arquivos do runtime ou manifestos, execute:

```sh
npm run build:offline
npm run check:offline
```

O gerador em `scripts/build-offline.mjs` incorpora hashes SHA-256 e uma versão determinística no worker, a partir de `scripts/service-worker.template.js`. Não edite `sw.js` manualmente. Publicar arquivos sem regenerá-lo pode impedir a preparação de uma versão nova. Uma publicação precisa entregar o conjunto completo; preparar offline não constitui empacotamento público nem publicação do site.

Servidores de desenvolvimento podem acrescentar um script de recarga ao documento; o [Live Server](https://github.com/ritwickdey/vscode-live-server/blob/master/lib/live-server/index.js) e o Five Server usam blocos identificados distintos. Em localhost, 127.0.0.1 e loopback IPv6, o worker consegue retirar esses blocos e verificar o hash exato do arquivo original. Inclui a indentação final inserida pelo Five Server no head. Apenas o conteúdo original entra no cache; alterações reais continuam impedindo a preparação. Depois de reabrir a versão offline, a página não inclui o script de recarga do servidor. Use a verificação de atualização e regenere o worker quando alterar o runtime.

Quando a preparação falha, a mensagem indica o arquivo e a causa disponível, por exemplo HTTP 404/503, download interrompido ou conteúdo de outra versão. Corrija os arquivos/conexão e use **Verificar / preparar offline** para tentar novamente. Recarregar após atualizar o código carrega o diagnóstico novo; não é necessário apagar a biblioteca do navegador.

Os testes regeneram o worker antes de iniciar o servidor. Durante desenvolvimento, feche as janelas controladas após preparar uma atualização ou remova apenas o registro do worker pelas ferramentas do navegador. Limpar todos os dados do site também apaga personagens; exporte a biblioteca antes dessa operação. O servidor de desenvolvimento continua servindo o repositório inteiro: não hospede essa pasta ou suas referências privadas.

Ícones PNG são renderizados a partir do símbolo SVG do cabeçalho com `node scripts/build-icons.mjs`, usando Playwright/Edge, sem rede ou arte externa. O manifesto e registro usam caminhos relativos e suportam instalação em uma subpasta com seu próprio escopo.

Os testes de PWA exercitam service workers reais com rede desligada e releases simuladas em memória. O diálogo de instalação é exercitado por evento simulado; não instalam o aplicativo no sistema operacional. A revisão em iOS/Safari e aparelhos físicos ainda precisa ser feita antes de uma publicação para esses ambientes.
