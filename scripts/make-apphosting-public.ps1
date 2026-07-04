# Make Firebase App Hosting (Cloud Run) publicly accessible via gcloud CLI
# Requires: gcloud CLI installed (https://cloud.google.com/sdk/docs/install)
# Run once: gcloud auth login
# Then run: .\scripts\make-apphosting-public.ps1

param(
    [string]$ProjectId = "cms-011",
    [string]$Region = "us-central1",
    [string]$ServiceName = "campus-connect"
)

$ErrorActionPreference = "Stop"

# Check gcloud is installed
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "gcloud CLI not found. Install it from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
    Write-Host "Then run: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Using gcloud - making App Hosting site public..." -ForegroundColor Cyan
Write-Host ""

# 1. Set project
Write-Host "[1/2] Setting project to $ProjectId..." -ForegroundColor Yellow
gcloud config set project $ProjectId

# 2. Allow public access (IAM)
Write-Host "[2/3] Adding public access (allUsers) to service: $ServiceName..." -ForegroundColor Yellow
gcloud run services add-iam-policy-binding $ServiceName `
    --project=$ProjectId `
    --region=$Region `
    --member="allUsers" `
    --role="roles/run.invoker"

# 3. Allow all ingress (internet traffic)
Write-Host "[3/3] Setting ingress to allow all traffic..." -ForegroundColor Yellow
gcloud run services update $ServiceName --project=$ProjectId --region=$Region --ingress=all

Write-Host ""
Write-Host "Done. Your site is now accessible on all devices." -ForegroundColor Green
Write-Host "Use this URL on other devices: https://campus-connect-6x72c7pova-uc.a.run.app" -ForegroundColor Green
$hostedUrl = "https://" + $ServiceName + "--" + $ProjectId + "." + $Region + ".hosted.app"
Write-Host ("Or: " + $hostedUrl) -ForegroundColor Cyan
