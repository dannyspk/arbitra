# Vercel Deployment Helper Script
# This script helps you prepare and deploy your app to Vercel

Write-Host "==================================" -ForegroundColor Cyan
Write-Host " Arbitrage Dashboard Deployment  " -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
$currentPath = Get-Location
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Please run this script from the frontend directory" -ForegroundColor Red
    Write-Host "   cd C:\arbitrage\web\frontend" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Running from correct directory" -ForegroundColor Green
Write-Host ""

# Step 1: Test Build
Write-Host "Step 1: Testing production build..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Please fix errors before deploying" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build successful!" -ForegroundColor Green
Write-Host ""

# Step 2: Check Git Status
Write-Host "Step 2: Checking Git status..." -ForegroundColor Yellow
if (-not (Test-Path ".git")) {
    Write-Host "⚠️  Git repository not initialized" -ForegroundColor Yellow
    $initGit = Read-Host "Initialize Git repository? (y/n)"
    if ($initGit -eq "y") {
        git init
        Write-Host "✅ Git initialized" -ForegroundColor Green
    }
} else {
    Write-Host "✅ Git repository found" -ForegroundColor Green
}
Write-Host ""

# Step 3: Check for uncommitted changes
Write-Host "Step 3: Checking for uncommitted changes..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    Write-Host "⚠️  You have uncommitted changes" -ForegroundColor Yellow
    Write-Host "Changed files:" -ForegroundColor Gray
    git status --short
    Write-Host ""
    $commit = Read-Host "Commit these changes? (y/n)"
    if ($commit -eq "y") {
        git add .
        $message = Read-Host "Enter commit message (or press Enter for default)"
        if (-not $message) {
            $message = "Prepare for Vercel deployment"
        }
        git commit -m $message
        Write-Host "✅ Changes committed" -ForegroundColor Green
    }
} else {
    Write-Host "✅ Working directory clean" -ForegroundColor Green
}
Write-Host ""

# Step 4: Check Remote
Write-Host "Step 4: Checking Git remote..." -ForegroundColor Yellow
$remote = git remote get-url origin 2>$null
if (-not $remote) {
    Write-Host "⚠️  No Git remote configured" -ForegroundColor Yellow
    Write-Host "You need to:" -ForegroundColor Yellow
    Write-Host "  1. Create a repository on GitHub" -ForegroundColor White
    Write-Host "  2. Add remote: git remote add origin https://github.com/USERNAME/REPO.git" -ForegroundColor White
    Write-Host "  3. Push: git push -u origin main" -ForegroundColor White
    Write-Host ""
    $openGitHub = Read-Host "Open GitHub to create a new repository? (y/n)"
    if ($openGitHub -eq "y") {
        Start-Process "https://github.com/new"
    }
} else {
    Write-Host "✅ Remote configured: $remote" -ForegroundColor Green
    $push = Read-Host "Push to GitHub? (y/n)"
    if ($push -eq "y") {
        git push
        Write-Host "✅ Pushed to GitHub" -ForegroundColor Green
    }
}
Write-Host ""

# Step 5: Environment Variables Reminder
Write-Host "==================================" -ForegroundColor Cyan
Write-Host " Important: Environment Variables" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "In Vercel, you need to set:" -ForegroundColor Yellow
Write-Host "  NEXT_PUBLIC_API_URL = your backend API URL" -ForegroundColor White
Write-Host ""
Write-Host "Example: https://your-backend.railway.app" -ForegroundColor Gray
Write-Host ""

# Step 6: Deploy Options
Write-Host "==================================" -ForegroundColor Cyan
Write-Host " Ready to Deploy!" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Choose deployment method:" -ForegroundColor Yellow
Write-Host "  1. Via Vercel Dashboard (Recommended for first time)" -ForegroundColor White
Write-Host "  2. Via Vercel CLI" -ForegroundColor White
Write-Host "  3. Exit (I'll do it manually)" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Opening Vercel dashboard..." -ForegroundColor Green
        Write-Host ""
        Write-Host "Steps in Vercel:" -ForegroundColor Yellow
        Write-Host "  1. Click 'Add New' → 'Project'" -ForegroundColor White
        Write-Host "  2. Import your GitHub repository" -ForegroundColor White
        Write-Host "  3. Set Root Directory to: web/frontend" -ForegroundColor Cyan
        Write-Host "  4. Add environment variable:" -ForegroundColor White
        Write-Host "     Name: NEXT_PUBLIC_API_URL" -ForegroundColor Cyan
        Write-Host "     Value: [your backend URL]" -ForegroundColor Cyan
        Write-Host "  5. Click 'Deploy'" -ForegroundColor White
        Write-Host ""
        Start-Process "https://vercel.com/new"
    }
    "2" {
        Write-Host ""
        Write-Host "Checking Vercel CLI..." -ForegroundColor Yellow
        $vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
        if (-not $vercelInstalled) {
            Write-Host "Vercel CLI not installed. Installing..." -ForegroundColor Yellow
            npm install -g vercel
        }
        Write-Host ""
        Write-Host "Running Vercel deployment..." -ForegroundColor Green
        Write-Host "⚠️  Note: Set Root Directory to 'web/frontend' when prompted" -ForegroundColor Yellow
        Write-Host ""
        vercel
    }
    "3" {
        Write-Host ""
        Write-Host "✅ All checks passed! You're ready to deploy manually." -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Push your code to GitHub (if not already done)" -ForegroundColor White
        Write-Host "  2. Go to https://vercel.com/new" -ForegroundColor White
        Write-Host "  3. Follow the deployment guide in VERCEL_DEPLOYMENT_GUIDE.md" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host " Deployment Checklist" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Before going live, ensure:" -ForegroundColor Yellow
Write-Host "  [ ] Backend API is deployed and accessible" -ForegroundColor White
Write-Host "  [ ] Backend CORS is configured for Vercel domain" -ForegroundColor White
Write-Host "  [ ] NEXT_PUBLIC_API_URL is set in Vercel" -ForegroundColor White
Write-Host "  [ ] Test the deployment in a browser" -ForegroundColor White
Write-Host "  [ ] Check browser console for errors" -ForegroundColor White
Write-Host ""
Write-Host "See VERCEL_DEPLOYMENT_GUIDE.md for detailed instructions" -ForegroundColor Cyan
Write-Host ""
Write-Host "Good luck!" -ForegroundColor Green
