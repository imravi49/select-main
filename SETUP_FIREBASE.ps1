Write-Host "Setting up Firestore data..."

# === Load .env ===
$envFile = ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^(?<key>[^=]+)=(?<value>.+)$") {
            Set-Item -Path "Env:$($Matches['key'])" -Value $Matches['value']
        }
    }
}

$projectId = $Env:VITE_FIREBASE_PROJECT_ID
$apiKey = $Env:VITE_FIREBASE_API_KEY

if (-not $projectId -or -not $apiKey) {
    Write-Host "ERROR: Missing Firebase project settings in .env" -ForegroundColor Red
    exit
}

$adminUid = Read-Host "Enter your Firebase Admin UID"
$adminEmail = "ravi.rv73838@gmail.com"

if (-not $adminUid) {
    Write-Host "ERROR: UID is required" -ForegroundColor Red
    exit
}

function Firestore-Patch {
    param(
        [string]$path,
        [object]$data
    )

    $url = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/$path?key=$apiKey"

    try {
        $json = $data | ConvertTo-Json -Depth 20
        Invoke-RestMethod -Method Patch -Uri $url -Body $json -ContentType "application/json" -ErrorAction Stop | Out-Null
        Write-Host "Created: $path"
    }
    catch {
        Write-Host "Exists (skipped): $path"
    }
}

# === Create admin profile ===
Firestore-Patch "profiles/$adminUid" @{
    fields = @{
        id = @{ stringValue = $adminUid }
        email = @{ stringValue = $adminEmail }
        full_name = @{ stringValue = "Admin" }
        role = @{ stringValue = "admin" }
        google_drive_connected = @{ booleanValue = $false }
    }
}

# === Create admin role ===
Firestore-Patch "user_roles/$adminUid" @{
    fields = @{
        user_id = @{ stringValue = $adminUid }
        role = @{ stringValue = "admin" }
    }
}

# === Initialize app collections ===
$collections = @(
    "users/meta",
    "photos/meta",
    "selections/meta",
    "feedback/meta",
    "activity_logs/meta",
    "settings/app"
)

foreach ($c in $collections) {
    Firestore-Patch $c @{
        fields = @{
            created = @{ stringValue = "system" }
        }
    }
}

Write-Host ""
Write-Host "Firestore setup complete."
Write-Host "Admin added: $adminEmail"
Write-Host "You can now use the admin panel."
