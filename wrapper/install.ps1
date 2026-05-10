#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Resolve-Path (Join-Path $ScriptDir '..')
$WrapperJs = Join-Path $RootDir 'wrapper\tc-claude.js'

if (-not (Test-Path $WrapperJs)) {
    Write-Error "tc-claude.js not found at $WrapperJs"
    exit 1
}

if (-not (Test-Path $PROFILE)) {
    New-Item -ItemType File -Path $PROFILE -Force | Out-Null
}

$FunctionLine = "function claude { node `"$WrapperJs`" @args }"

$existing = Get-Content $PROFILE -ErrorAction SilentlyContinue
if ($existing -notcontains $FunctionLine) {
    Add-Content -Path $PROFILE -Value "`n$FunctionLine"
    Write-Host "TC Token Optimizer installed. Restart your shell or run: . `$PROFILE"
} else {
    Write-Host "TC Token Optimizer alias already present in $PROFILE"
}
