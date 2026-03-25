param([string]$Cmd = "help")

Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Header($t) { Write-Host ""; Write-Host "--- $t ---" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  [OK]   $t" -ForegroundColor Green }
function Warn($t)   { Write-Host "  [WARN] $t" -ForegroundColor Yellow }
function Err($t)    { Write-Host "  [FAIL] $t" -ForegroundColor Red }
function Info($t)   { Write-Host "  [    ] $t" -ForegroundColor Gray }

if ($Cmd -eq "start") {
    Header "Iniciando WindSpot"
    docker compose up -d --build
    if ($LASTEXITCODE -eq 0) {
        Ok "Containers iniciados"
        Info "Dashboard : http://localhost:3000"
        Info "API       : http://localhost:8000"
        Info "Renderer  : http://localhost:8001"
    } else {
        Err "Falha ao iniciar. Execute: .\windspot.ps1 logs"
    }
}
elseif ($Cmd -eq "stop") {
    Header "Parando WindSpot"
    docker compose down
    if ($LASTEXITCODE -eq 0) { Ok "Todos os containers parados" }
}
elseif ($Cmd -eq "restart") {
    Header "Reiniciando WindSpot"
    docker compose restart
    if ($LASTEXITCODE -eq 0) {
        Ok "Containers reiniciados"
        Info "Aguarde ~15s para o healthcheck passar"
    }
}
elseif ($Cmd -eq "restart-api") {
    Header "Reiniciando API"
    docker compose restart api
    if ($LASTEXITCODE -eq 0) { Ok "API reiniciada - novos spots do DB serao carregados" }
}
elseif ($Cmd -eq "rebuild") {
    Header "Rebuild completo"
    Warn "Reconstroi todas as imagens Docker (pode demorar)"
    docker compose down
    docker compose build --no-cache
    docker compose up -d
    if ($LASTEXITCODE -eq 0) { Ok "Rebuild concluido e containers iniciados" }
}
elseif ($Cmd -eq "status") {
    Header "Status dos Containers"
    docker compose ps
    Write-Host ""
    Header "Health Check"
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 3 -UseBasicParsing
        Ok "API online - $($r.Content)"
    } catch {
        Err "API offline ou nao responde"
    }
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 3 -UseBasicParsing
        Ok "Dashboard online (HTTP $($r.StatusCode))"
    } catch {
        Err "Dashboard offline ou nao responde"
    }
}
elseif ($Cmd -eq "logs") {
    Header "Logs (Ctrl+C para sair)"
    docker compose logs -f --tail=50
}
elseif ($Cmd -eq "logs-api") {
    Header "Logs da API (Ctrl+C para sair)"
    docker compose logs -f --tail=80 api
}
elseif ($Cmd -eq "logs-dashboard") {
    Header "Logs do Dashboard (Ctrl+C para sair)"
    docker compose logs -f --tail=50 dashboard
}
elseif ($Cmd -eq "spots") {
    Header "Spots no Banco de Dados"
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8000/api/spots" -UseBasicParsing
        $spots = $r.Content | ConvertFrom-Json
        $spots | Format-Table id, name, slug, region, state_code, lat, lon -AutoSize
        Info "Total: $($spots.Count) spots"
    } catch {
        Err "API nao esta respondendo. Execute: .\windspot.ps1 start"
    }
}
elseif ($Cmd -eq "db") {
    Header "Shell SQLite"
    docker compose exec api python3 -c @"
import sqlite3, cmd

class WSDB(cmd.Cmd):
    prompt = 'db> '
    def __init__(self):
        super().__init__()
        self.conn = sqlite3.connect('/data/kitesurf.db')
        self.conn.row_factory = sqlite3.Row
        print('WindSpot SQLite shell. Digite SQL ou quit.')
    def default(self, line):
        if line.strip().lower() in ('quit','exit','.quit'):
            return True
        try:
            rows = self.conn.execute(line).fetchall()
            if rows:
                print('  ' + ' | '.join(rows[0].keys()))
                print('  ' + '-'*60)
                for r in rows: print('  ' + ' | '.join(str(v) for v in r))
        except Exception as e:
            print(f'Erro: {e}')

WSDB().cmdloop()
"@
}
elseif ($Cmd -eq "clear-cache") {
    Header "Limpar Cache de Forecast"
    Warn "Isso forca o re-fetch de todos os forecasts"
    docker compose exec api python3 -c "
import sqlite3
conn = sqlite3.connect('/data/kitesurf.db')
deleted = conn.execute('DELETE FROM forecast_cache').rowcount
conn.commit()
conn.close()
print(f'Cache limpo - {deleted} entradas removidas')
"
    if ($LASTEXITCODE -eq 0) { Ok "Cache limpo. Reinicie a API para re-popular." }
}
elseif ($Cmd -eq "open") {
    Header "Abrindo no Browser"
    Start-Process "http://localhost:3000"
    Ok "Dashboard aberto em http://localhost:3000"
}
else {
    Header "WindSpot - Comandos Disponiveis"
    $cmds = @(
        "start          - Inicia todos os containers (com build)",
        "stop           - Para todos os containers",
        "restart        - Reinicia todos os containers",
        "restart-api    - Reinicia so a API (aplica novos spots do DB)",
        "rebuild        - Rebuild completo das imagens Docker",
        "status         - Mostra status e health check",
        "logs           - Logs em tempo real de todos os servicos",
        "logs-api       - Logs em tempo real da API",
        "logs-dashboard - Logs em tempo real do Dashboard",
        "spots          - Lista todos os spots no banco de dados",
        "db             - Shell interativo no SQLite",
        "clear-cache    - Limpa o cache de forecasts",
        "open           - Abre o dashboard no browser"
    )
    foreach ($c in $cmds) { Info $c }
    Write-Host ""
    Info "Exemplo: .\windspot.ps1 start"
    Info "Exemplo: .\windspot.ps1 restart-api"
}

Write-Host ""
