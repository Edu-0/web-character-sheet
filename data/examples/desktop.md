# Ficha RPG para Windows

Há três executáveis para Windows 10/11 x64. Os arquivos são gerados em `output/`, ignorado pelo Git; os commits levam somente código e lockfile.

| Arquivo | Uso | Dados |
| --- | --- | --- |
| `Ficha-RPG-<versão>-portable-x64.exe` | Abrir sem instalar, numa pasta gravável | `Ficha RPG Dados`, ao lado do executável |
| `Ficha-RPG-<versão>-instalador-x64.exe` | Instalar para o usuário atual, sem administrador | `%APPDATA%\Ficha RPG` |
| `Gerar-Ficha-RPG.exe` | Buscar o código atual do `main` e gerar os três arquivos novamente | Não acessa personagens; cria uma pasta nova por geração |

O aplicativo inclui o Chromium/Electron e funciona offline desde a primeira abertura. Não precisa de Node.js ou navegador instalado. A versão portátil deve ser retirada do ZIP antes de executar; ao mover para outro computador, leve também `Ficha RPG Dados`. A instalação mantém o mesmo perfil entre atualizações e não apaga esse perfil na desinstalação.

Navegador, portátil e instalação têm bibliotecas separadas. Para transferir seus personagens e sistemas editados, use **Configurações → Exportar tudo / Importar tudo**. Atualizar não converte nem mistura automaticamente essas bibliotecas. Faça backup antes de substituir versões. Feche o aplicativo antes de trocar o portátil ou executar um novo instalador.

## Usar o gerador

Coloque `Gerar-Ficha-RPG.exe` numa pasta gravável e abra. É necessário ter internet, Windows PowerShell 5.1 e .NET Framework 4.x, normalmente presentes no Windows 10/11. Git e Node.js instalados não são necessários. A primeira geração baixa centenas de MB de ferramentas e pode levar vários minutos; reserve espaço para as ferramentas, código e executáveis.

O gerador consulta o commit atual do `main` em `Edu-0/web-character-sheet`, baixa esse snapshot imutável e registra seu SHA. Portanto, inclui alterações publicadas no `main` que podem ser posteriores à última release. O código precisa conter o empacotamento Windows; antes de publicá-lo no `main`, use a opção local abaixo.

Depois, reutiliza um Node.js compatível já disponível ou baixa a versão mais recente da linha Node.js 22 LTS portátil e confere o SHA-256 oficial via HTTPS. Executa `npm ci` com o lockfile e compila. O log e as ferramentas ficam em `Ficha RPG Gerados/build-<data>-<id>/`, e os executáveis prontos em `Executaveis/`. O cache compartilhado de downloads fica em `Ficha RPG Gerados/cache/`. Downloads têm limites de tempo e tentativas; falhas interrompem a geração, preservando o log. O gerador executa o código de build do repositório configurado; use o executável e a fonte do projeto em que você confia.

Opções por terminal:

```powershell
.\Gerar-Ficha-RPG.exe --output "D:\Meus executaveis"
.\Gerar-Ficha-RPG.exe --source "C:\Projetos\Ficha" --non-interactive
```

`--source` copia os arquivos de desenvolvimento necessários para uma pasta nova; não instala dependências nem executa o build no checkout informado. Sem essa opção, sempre busca o `main`. O gerador não substitui o aplicativo aberto, não modifica seu checkout e não faz commit, push ou publicação.

## Compilar no checkout

```sh
npm ci
npm run build:desktop
```

Requer Windows x64, Node.js 22.12+ e acesso à rede para baixar ferramentas. O resultado fica numa pasta nova `output/desktop/ficha-rpg-<versão>-<sufixo>/`, junto de `LEIA-ME.txt`, `SHA256SUMS.txt` e `desktop-build.json`. O build usa somente o snapshot público de `build:site`; documentos privados, referências, Git e dados pessoais não integram o aplicativo. As licenças do Electron/Chromium acompanham a distribuição.

`npm run build:generator` compila somente o pequeno gerador, usando o compilador C# do .NET Framework do Windows. `npm run desktop:dev` abre o código local com um snapshot público novo e perfil separado em `tmp/desktop-dev-profile`. `npm run test:desktop` verifica a versão empacotada mais recente com Playwright, em perfil de teste próprio. `FICHA_DESKTOP_EXECUTABLE` pode indicar outra versão empacotada; `FICHA_DESKTOP_TEST_PROFILE` é reservado para testes isolados.

O workflow [Executáveis Windows](../../.github/workflows/windows.yml) permite gerar no GitHub Actions manualmente ou ao enviar uma tag `v*`. Os executáveis ficam no artefato do workflow, sem entrar no histórico Git. O workflow não publica automaticamente uma release. Para distribuir sem compilação local, os binários também podem ser anexados a uma GitHub Release.

`npm run test:portable`, com `FICHA_PORTABLE_EXECUTABLE` indicando o arquivo portátil, verifica também sua extração real e o perfil ao lado do exe. O teste copia o executável para uma pasta temporária e usa um personagem fictício.

## Atualizações e limites

No desktop, a seção offline informa que os arquivos já estão incluídos e orienta usar o gerador. Não registra service worker nem usa o atualizador PWA: cada abertura lê o snapshot instalado inteiro, evitando cache antigo sobre um executável novo. O endereço interno `ficha://app` e os diretórios de perfil são estáveis entre builds. A engine, layouts, dados e backups continuam usando os mesmos contratos do navegador.

O renderer não tem acesso a Node.js; usa sandbox, isolamento de contexto e protocolo restrito aos arquivos públicos listados. Links HTTPS externos abrem no navegador padrão; guias públicos podem abrir numa janela local. A prévia do editor mantém seu iframe isolado. Não há servidor HTTP, sincronização, atualização silenciosa ou serviço de nuvem.

Os executáveis são **sem assinatura digital**; o Windows pode mostrar editor desconhecido/SmartScreen. O arquivo SHA256 permite conferir integridade de uma cópia, mas não substitui assinatura de editor. A licença não comercial do projeto e os direitos separados dos conteúdos permanecem: consulte [LICENSE](../../LICENSE) e [avisos de terceiros](../../THIRD_PARTY_NOTICES.md).
