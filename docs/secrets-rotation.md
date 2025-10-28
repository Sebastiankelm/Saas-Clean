# Secrets Rotation Guide

## Overview

This document outlines the procedure for rotating critical secrets in the SaaS Clean application. Regular rotation of secrets is essential for maintaining security and compliance.

## Secrets Requiring Rotation

### Critical Secrets (Rotate Every 90 Days)
- `AUTH_SECRET` - Better Auth JWT signing secret
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook endpoint verification
- `POSTGRES_PASSWORD` - Database password (if using custom PostgreSQL)

### Environment-Specific Secrets (Rotate Every 180 Days)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin access
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key

### Infrastructure Secrets (Rotate Every 365 Days)
- SSL certificates
- Domain registrar API keys
- CDN API keys

## Rotation Procedure

### 1. Pre-Rotation Checklist

- [ ] Identify all environments (development, staging, production)
- [ ] Document current secret values (for rollback if needed)
- [ ] Notify team members of maintenance window
- [ ] Prepare rollback plan
- [ ] Test rotation procedure in development environment

### 2. Generate New Secrets

#### AUTH_SECRET
```bash
# Generate new 32-character random string
openssl rand -base64 32
```

#### STRIPE_WEBHOOK_SECRET
```bash
# Generate new webhook secret in Stripe Dashboard
# Go to: Stripe Dashboard > Webhooks > [Your Webhook] > Signing secret
```

#### Database Password
```bash
# Generate new password
openssl rand -base64 32
```

### 3. Update Environment Variables

#### Development Environment
1. Update `.env` file locally
2. Restart development server
3. Test authentication and webhooks

#### Staging Environment
1. Update environment variables in hosting platform
2. Redeploy application
3. Run integration tests
4. Verify all functionality

#### Production Environment
1. **Schedule maintenance window**
2. Update environment variables in hosting platform
3. Redeploy application
4. Monitor application logs
5. Verify critical functionality
6. Monitor for 24 hours

### 4. Update GitHub Secrets

For CI/CD pipelines, update GitHub repository secrets:

```bash
# Using GitHub CLI
gh secret set AUTH_SECRET --body "new-secret-value"
gh secret set STRIPE_WEBHOOK_SECRET --body "new-webhook-secret"
gh secret set POSTGRES_PASSWORD --body "new-db-password"
```

### 5. Update Stripe Configuration

1. Log into Stripe Dashboard
2. Navigate to Webhooks section
3. Update webhook endpoint signing secret
4. Test webhook delivery

### 6. Database Password Rotation

If using custom PostgreSQL:

1. Update database user password
2. Update connection strings in all environments
3. Restart database connections
4. Verify connectivity

### 7. Post-Rotation Verification

- [ ] Authentication works correctly
- [ ] Stripe webhooks are received
- [ ] Database connections are stable
- [ ] All API endpoints respond correctly
- [ ] Monitoring shows no errors
- [ ] User sessions are maintained

## Automated Rotation Script

### PowerShell Script (`scripts/rotate-secrets.ps1`)

```powershell
# Secrets Rotation Script
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

# Update GitHub Secrets
Write-Host "Updating GitHub secrets..." -ForegroundColor Blue
gh secret set AUTH_SECRET --body $newAuthSecret
gh secret set STRIPE_WEBHOOK_SECRET --body $newWebhookSecret

# Create reminder issue
$issueTitle = "Secrets Rotation Reminder - $(Get-Date -Format 'yyyy-MM-dd')"
$issueBody = @"
## Next Secrets Rotation Due

**Date:** $(Get-Date (Get-Date).AddDays(90) -Format 'yyyy-MM-dd')
**Environment:** $Environment

### Action Required
- [ ] Rotate AUTH_SECRET
- [ ] Rotate STRIPE_WEBHOOK_SECRET
- [ ] Update GitHub secrets
- [ ] Test authentication
- [ ] Test webhooks
- [ ] Monitor for 24 hours

### Generated Secrets
- AUTH_SECRET: $newAuthSecret
- STRIPE_WEBHOOK_SECRET: $newWebhookSecret

---
*This issue was automatically created by the secrets rotation script.*
"@

gh issue create --title $issueTitle --body $issueBody --label "security,maintenance"

Write-Host "Secrets rotation completed successfully!" -ForegroundColor Green
Write-Host "Reminder issue created for next rotation." -ForegroundColor Cyan
```

### Usage

```bash
# Dry run to see what would be changed
.\scripts\rotate-secrets.ps1 -Environment "production" -DryRun

# Actual rotation
.\scripts\rotate-secrets.ps1 -Environment "production"
```

## Emergency Rollback Procedure

If rotation causes issues:

1. **Immediate Actions**
   - Revert to previous secret values
   - Restart affected services
   - Monitor error logs

2. **Communication**
   - Notify team immediately
   - Update status page if applicable
   - Document incident

3. **Investigation**
   - Identify root cause
   - Fix underlying issue
   - Plan re-rotation

## Monitoring and Alerts

### Key Metrics to Monitor
- Authentication failure rate
- Webhook delivery success rate
- Database connection errors
- API response times
- Error rates

### Alert Thresholds
- Authentication failures > 5% of requests
- Webhook delivery failures > 1%
- Database connection errors > 0.1%
- API response time > 2 seconds

## Compliance and Documentation

### Required Documentation
- [ ] Rotation log with timestamps
- [ ] Verification test results
- [ ] Incident reports (if any)
- [ ] Team notification records

### Compliance Requirements
- SOC 2: Quarterly secret rotation
- GDPR: Document access controls
- PCI DSS: Annual security review

## Best Practices

1. **Never reuse secrets** across environments
2. **Use strong, random secrets** (minimum 32 characters)
3. **Rotate during low-traffic periods**
4. **Test thoroughly** before production deployment
5. **Monitor continuously** after rotation
6. **Document everything** for audit purposes
7. **Keep rollback plan ready**
8. **Notify stakeholders** of maintenance windows

## Troubleshooting

### Common Issues

#### Authentication Failures
- **Cause**: Incorrect AUTH_SECRET
- **Solution**: Verify secret matches in all environments
- **Prevention**: Test authentication after rotation

#### Webhook Failures
- **Cause**: Mismatched webhook secret
- **Solution**: Update Stripe webhook configuration
- **Prevention**: Test webhook delivery

#### Database Connection Issues
- **Cause**: Incorrect password or connection string
- **Solution**: Verify connection parameters
- **Prevention**: Test database connectivity

### Support Contacts

- **Development Team**: dev-team@company.com
- **Security Team**: security@company.com
- **Infrastructure Team**: infra@company.com
- **Emergency**: +1-XXX-XXX-XXXX

## Schedule

### Rotation Calendar
- **Q1**: January 15th
- **Q2**: April 15th  
- **Q3**: July 15th
- **Q4**: October 15th

### Review Schedule
- **Monthly**: Review rotation logs
- **Quarterly**: Update procedures
- **Annually**: Full security audit

---

*Last Updated: $(Get-Date -Format 'yyyy-MM-dd')*
*Next Review: $(Get-Date (Get-Date).AddMonths(3) -Format 'yyyy-MM-dd')*
