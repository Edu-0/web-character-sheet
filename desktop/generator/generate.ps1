param(
    [string]$OutputRoot = (Join-Path $PWD 'Ficha RPG Gerados'),
    [string]$SourceDirectory,
    [switch]$NoOpen
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
$headers = @{ 'User-Agent' = 'Ficha-RPG-Generator'; 'Accept' = 'application/vnd.github+json' }
$repository = 'Edu-0/web-character-sheet'
function Download-File([string]$Url, [string]$Destination) {
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
        & $curl.Source --fail --location --silent --show-error --retry 2 --retry-delay 2 --connect-timeout 20 --max-time 600 --speed-time 30 --speed-limit 1024 --output $Destination $Url
        if ($LASTEXITCODE -ne 0) { throw "Falha no download de $Url (curl $LASTEXITCODE)." }
    } else {
        Invoke-WebRequest -UseBasicParsing -TimeoutSec 600 -Uri $Url -OutFile $Destination
    }
}
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
# Each invocation owns a new workspace; no checkout, existing build or user profile is overwritten.
$job = Join-Path $OutputRoot ('build-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $job -Force | Out-Null
Start-Transcript -Path (Join-Path $job 'geracao.log') | Out-Null
try {
    Write-Host '1/4 - Preparando uma cópia do código...'
    if ($SourceDirectory) {
        $SourceDirectory = [IO.Path]::GetFullPath($SourceDirectory)
        $source = Join-Path $job 'source'
        New-Item -ItemType Directory -Path $source | Out-Null
        # Local development also uses a fresh workspace and an explicit source list.
        foreach ($name in @('package.json','package-lock.json','README.md','LICENSE','THIRD_PARTY_NOTICES.md','index.html','manifest.webmanifest','css','js','data','assets','scripts','desktop')) {
            Copy-Item -LiteralPath (Join-Path $SourceDirectory $name) -Destination $source -Recurse
        }
        $commit = 'local-copy'
    } else {
        $latest = Invoke-RestMethod -TimeoutSec 60 -Uri "https://api.github.com/repos/$repository/commits/main" -Headers $headers
        $commit = [string]$latest.sha
        if ($commit -notmatch '^[a-f0-9]{40}$') { throw 'O GitHub retornou um commit inválido.' }
        Write-Host "Commit: $commit"
        $archive = Join-Path $job 'source.zip'
        Download-File "https://codeload.github.com/$repository/zip/$commit" $archive
        $expanded = Join-Path $job 'download'
        Expand-Archive -LiteralPath $archive -DestinationPath $expanded
        $folders = @(Get-ChildItem -LiteralPath $expanded -Directory)
        if ($folders.Count -ne 1) { throw 'Estrutura do código baixado inesperada.' }
        $source = $folders[0].FullName
    }
    if (!(Test-Path -LiteralPath (Join-Path $source 'scripts/build-desktop.mjs'))) {
        throw 'A versão baixada ainda não tem o empacotamento Windows. Publique os arquivos do gerador no main primeiro, ou use --source com a pasta local.'
    }

    Write-Host '2/4 - Preparando Node.js...'
    $nodeDirectory = $null
    $installedNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($installedNode -and (Test-Path -LiteralPath (Join-Path (Split-Path $installedNode.Source) 'npm.cmd'))) {
        $candidate = & $installedNode.Source -p 'process.versions.node'
        if ($LASTEXITCODE -eq 0 -and $candidate -match '^\d+\.\d+\.\d+$') {
            $parts = $candidate.Split('.')
            if ([int]$parts[0] -gt 22 -or ([int]$parts[0] -eq 22 -and [int]$parts[1] -ge 12)) {
                $nodeDirectory = Split-Path $installedNode.Source
                $nodeVersion = 'v' + $candidate
                Write-Host "Usando Node.js $nodeVersion já disponível."
            }
        }
    }
    if (!$nodeDirectory) {
        Write-Host 'Baixando Node.js 22 LTS portátil e verificando SHA-256...'
        $releases = Invoke-RestMethod -TimeoutSec 60 -Uri 'https://nodejs.org/dist/index.json'
        $release = $releases | Where-Object { $_.version -match '^v22\.' -and $_.lts -and $_.files -contains 'win-x64-zip' } | Select-Object -First 1
        if (!$release -or $release.version -notmatch '^v22\.\d+\.\d+$') { throw 'Não foi possível localizar Node.js 22 LTS.' }
        $nodeVersion = [string]$release.version
        $filename = "node-$nodeVersion-win-x64.zip"
        $base = "https://nodejs.org/dist/$nodeVersion"
        $zip = Join-Path $job $filename
        Download-File "$base/$filename" $zip
        $sumsFile = Join-Path $job 'SHASUMS256-node.txt'
        Download-File "$base/SHASUMS256.txt" $sumsFile
        $sums = Get-Content -LiteralPath $sumsFile -Raw
        $expected = ($sums -split "`n" | Where-Object { $_.Trim().EndsWith('  ' + $filename) } | Select-Object -First 1)
        if (!$expected -or $expected -notmatch '^([a-f0-9]{64})\s') { throw 'SHA-256 oficial do Node.js não encontrado.' }
        if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Matches[1]) { throw 'O download do Node.js não corresponde ao SHA-256 oficial.' }
        $tools = Join-Path $job 'tools'
        Expand-Archive -LiteralPath $zip -DestinationPath $tools
        $nodeDirectory = Join-Path $tools "node-$nodeVersion-win-x64"
    }
    $env:PATH = "$nodeDirectory;$env:PATH"
    $env:npm_config_cache = Join-Path $OutputRoot 'cache/npm'
    $env:ELECTRON_CACHE = Join-Path $OutputRoot 'cache/electron'
    $env:ELECTRON_BUILDER_CACHE = Join-Path $OutputRoot 'cache/electron-builder'
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    $npm = Join-Path $nodeDirectory 'npm.cmd'
    Write-Host '3/4 - Instalando as dependências exatas do lockfile...'
    Push-Location $source
    try {
        & $npm ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "npm ci falhou ($LASTEXITCODE)." }
        Write-Host '4/4 - Gerando portátil, instalador e novo gerador...'
        & $npm run build:desktop
        if ($LASTEXITCODE -ne 0) { throw "O empacotamento falhou ($LASTEXITCODE)." }
    } finally { Pop-Location }
    $build = Get-ChildItem -LiteralPath (Join-Path $source 'output/desktop') -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (!$build) { throw 'Pasta de saída não encontrada.' }
    $artifacts = Join-Path $job 'Executaveis'
    New-Item -ItemType Directory -Path $artifacts | Out-Null
    Get-ChildItem -LiteralPath $build.FullName -File | Where-Object { $_.Extension -eq '.exe' -or $_.Name -in @('SHA256SUMS.txt','LEIA-ME.txt','desktop-build.json') } | Copy-Item -Destination $artifacts
    @{ repository=$repository; commit=$commit; node=$nodeVersion; generatedAt=(Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $artifacts 'source-info.json') -Encoding UTF8
    Write-Host "`nPronto: $artifacts"
    if (!$NoOpen) { Start-Process explorer.exe -ArgumentList ('"' + $artifacts + '"') }
} catch {
    Write-Host "`nFalha: $($_.Exception.Message)" -ForegroundColor Red
    Stop-Transcript | Out-Null
    exit 1
}
Stop-Transcript | Out-Null
