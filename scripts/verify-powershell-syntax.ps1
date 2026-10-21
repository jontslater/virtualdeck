param(
    [Parameter(Mandatory = $true)][string]$Path
)

$errors = $null
$tokens = $null
$resolved = Resolve-Path -LiteralPath $Path
[void][System.Management.Automation.Language.Parser]::ParseFile($resolved.Path, [ref]$tokens, [ref]$errors)
if ($errors -and $errors.Count -gt 0) {
    foreach ($err in $errors) {
        Write-Error $err.ToString()
    }
    exit 1
}
exit 0
