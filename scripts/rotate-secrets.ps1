# Secrets Rotation Script for SaaS Clean
param(
    [Parameter(Mandatory=$true)]
    [string]$Environment,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun
)

Write-Host "Starting secrets rotation for environment: $Environment" -ForegroundColor Green

# Generate new secrets
$newAuthSecret = [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$newWebhookSecret = [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

Write-Host "Generated new secrets:" -ForegroundColor Yellow
Write-Host "AUTH_SECRET: $newAuthSecret"
Write-Host "STRIPE_WEBHOOK_SECRET: $newWebhookSecret"

if ($DryRun) {
    Write-Host "DRY RUN - No changes made" -ForegroundColor Cyan
    exit 0
}

# Check if GitHub CLI is available
try {
    gh --version | Out-Null
    Write-Host "GitHub CLI found" -ForegroundColor Green
} catch {
    Write-Host "GitHub CLI not found. Please install it first: https://cli.github.com/" -ForegroundColor Red
    exit 1
}

# Update GitHub Secrets
Write-Host "Updating GitHub secrets..." -ForegroundColor Blue
try {
    gh secret set AUTH_SECRET --body $newAuthSecret
    gh secret set STRIPE_WEBHOOK_SECRET --body $newWebhookSecret
    Write-Host "GitHub secrets updated successfully" -ForegroundColor Green
} catch {
    Write-Host "Failed to update GitHub secrets: $_" -ForegroundColor Red
    exit 1
}

# Create reminder issue
$nextRotationDate = (Get-Date).AddDays(90).ToString('yyyy-MM-dd')
$issueTitle = "Secrets Rotation Reminder - $nextRotationDate"
$issueBody = @"
## Next Secrets Rotation Due

**Date:** $nextRotationDate
**Environment:** $Environment

### Action Required
- [ ] Rotate AUTH_SECRET
- [ ] Rotate STRIPE_WEBHOOK_SECRET  
- [ ] Update GitHub secrets
- [ ] Test authentication
- [ ] Test webhooks
- [ ] Monitor for 24 hours

### Generated Secrets (for reference)
- AUTH_SECRET: $newAuthSecret
- STRIPE_WEBHOOK_SECRET: $newWebhookSecret

### Manual Steps Required
1. Update environment variables in hosting platform
2. Redeploy application
3. Test authentication endpoints
4. Verify Stripe webhook delivery
5. Monitor application logs for 24 hours

---
*This issue was automatically created by the secrets rotation script.*
"@

try {
    gh issue create --title $issueTitle --body $issueBody --label "security,maintenance"
    Write-Host "Reminder issue created successfully" -ForegroundColor Green
} catch {
    Write-Host "Failed to create reminder issue: $_" -ForegroundColor Yellow
    Write-Host "Please create the issue manually" -ForegroundColor Yellow
}

Write-Host "Secrets rotation completed successfully!" -ForegroundColor Green
Write-Host "Next rotation due: $nextRotationDate" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: Manual steps required:" -ForegroundColor Red
Write-Host "1. Update environment variables in your hosting platform" -ForegroundColor White
Write-Host "2. Redeploy the application" -ForegroundColor White
Write-Host "3. Test authentication and webhooks" -ForegroundColor White
Write-Host "4. Monitor for 24 hours" -ForegroundColor White
