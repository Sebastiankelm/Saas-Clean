# Local Development Startup Script
Write-Host "🚀 Uruchamianie projektu lokalnie..." -ForegroundColor Cyan

# Check if Docker is running
Write-Host "📦 Sprawdzanie Dockera..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker nie jest uruchomiony!" -ForegroundColor Red
    Write-Host "Proszę uruchomić Docker Desktop i spróbować ponownie." -ForegroundColor Yellow
    Write-Host "Naciśnij Enter gdy Docker będzie działał..." -ForegroundColor Yellow
    Read-Host
}

# Start Supabase
Write-Host "🗄️  Uruchamianie Supabase lokalnie..." -ForegroundColor Yellow
pnpm dlx supabase start

Write-Host "⏳ Czekam 5 sekund na uruchomienie Supabase..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Apply migrations
Write-Host "📝 Stosowanie migracji bazy danych..." -ForegroundColor Yellow
pnpm dlx supabase migration up --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Seed database
Write-Host "🌱 Zasiewanie bazy danych..." -ForegroundColor Yellow
pnpm --filter=@saas-clean/web db:seed

# Start dev server
Write-Host "🎉 Uruchamianie serwera deweloperskiego..." -ForegroundColor Green
pnpm dev

