param(
    [string]$JarPath
)

# Configuration
$Extensions = @(".yml", ".yaml", ".properties", ".xml", ".json", ".conf")
$Keywords = @("jdbc", "database", "datasource", "password", "secret", "redis", "mongo", "elasticsearch")

# Validate Input
if (-not (Test-Path $JarPath)) {
    Write-Output "{ ""error"": ""File not found: $JarPath"" }"
    exit 1
}

# Create Temp Directory
$TempDir = Join-Path $env:TEMP ("fuxi_jar_" + [Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TempDir | Out-Null

try {
    # Extract JAR (it's just a zip)
    Expand-Archive -Path $JarPath -DestinationPath $TempDir -Force

    # Find Config Files
    $Results = @()
    $Files = Get-ChildItem -Path $TempDir -Recurse | Where-Object { $_.Extension -in $Extensions }

    foreach ($File in $Files) {
        $Content = Get-Content -Path $File.FullName -Raw -ErrorAction SilentlyContinue
        if (-not $Content) { continue }

        # Basic Heuristic: Check if filename looks like config OR content has keywords
        $IsConfig = $false
        
        # Check filename
        if ($File.Name -match "application|bootstrap|setting|config|persistence|context") {
            $IsConfig = $true
        }
        
        # Check content if not already identified
        if (-not $IsConfig) {
            foreach ($Keyword in $Keywords) {
                if ($Content -match $Keyword) {
                    $IsConfig = $true
                    break
                }
            }
        }

        if ($IsConfig) {
            # Relative Path
            $RelPath = $File.FullName.Substring($TempDir.Length + 1)
            
            $Results += @{
                path = $RelPath
                content = $Content
                size = $File.Length
            }
        }
    }

    # Return JSON
    $JsonOutput = @{
        jar_path = $JarPath
        timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        files = $Results
    }
    
    Write-Output ($JsonOutput | ConvertTo-Json -Depth 5 -Compress)

} catch {
    Write-Output "{ ""error"": ""$($_.Exception.Message)"" }"
} finally {
    # Cleanup
    if (Test-Path $TempDir) {
        Remove-Item -Path $TempDir -Recurse -Force
    }
}