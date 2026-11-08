$ErrorActionPreference = 'Stop'
$hosts = 'C:\Windows\System32\drivers\etc\hosts'
$line = '140.82.114.4 github.com'
$content = [System.IO.File]::ReadAllText($hosts)
if ($content -notmatch 'github\.com') {
    Add-Content -Path $hosts -Value "`n# fitness push fix`n$line"
    Write-Output 'HOSTS_UPDATED'
} else {
    Write-Output 'HOSTS_ALREADY'
}
