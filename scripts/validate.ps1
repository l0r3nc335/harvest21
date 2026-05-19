# PowerShell validation script for Windows
# Run this manually before pushing: .\scripts\validate.ps1

Write-Host ""
Write-Host "🔍 Running validation checks..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Run TypeScript type checking
Write-Host "📝 Checking TypeScript types..." -ForegroundColor Yellow
npm run type-check
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ TypeScript check failed!" -ForegroundColor Red
    Write-Host "Please fix type errors before pushing." -ForegroundColor Red
    exit 1
}
Write-Host "✅ TypeScript check passed" -ForegroundColor Green
Write-Host ""

# Run production build
Write-Host "🔨 Running production build..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Write-Host "Please fix build errors before pushing." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build passed" -ForegroundColor Green
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ All validation checks passed!" -ForegroundColor Green
Write-Host "You're ready to push! 🚀" -ForegroundColor Green
Write-Host ""
