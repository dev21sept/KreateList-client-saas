$logPath = "d:\Project\elister\backend\scratch\run_progress.log"
"Starting execution of parse_poshmark.ps1 at $(Get-Date)" | Out-File -FilePath $logPath -Encoding utf8

$jsonPath = "d:\Project\elister\backend\poshmark_initializers.json"
$outputPath = "d:\Project\elister\backend\constants\poshmarkTaxonomy.js"

try {
    "Reading Poshmark catalog from: $jsonPath" | Out-File -FilePath $logPath -Append -Encoding utf8
    if (-not (Test-Path $jsonPath)) {
        "Error: File not found at $jsonPath." | Out-File -FilePath $logPath -Append -Encoding utf8
        Exit 1
    }

    $jsonContent = Get-Content -Raw -Path $jsonPath -Encoding UTF8
    "Loaded JSON content, length: $($jsonContent.Length) characters. Parsing JSON..." | Out-File -FilePath $logPath -Append -Encoding utf8
    
    $data = ConvertFrom-Json -InputObject $jsonContent
    "JSON parsed successfully. Catalog ID: $($data.catalog.id)" | Out-File -FilePath $logPath -Append -Encoding utf8

    $paths = @()

    foreach ($dept in $data.catalog.departments) {
        $deptName = $dept.display
        $deptId = $dept.id
        "Processing department: $deptName ($deptId)" | Out-File -FilePath $logPath -Append -Encoding utf8
        
        foreach ($cat in $dept.categories) {
            $catName = $cat.display
            $catId = $cat.id
            
            if ($null -ne $cat.category_features) {
                $subcats = @($cat.category_features)
            } else {
                $subcats = @()
            }
            
            if ($subcats.Count -gt 0) {
                foreach ($sub in $subcats) {
                    $subName = $sub.display
                    $subId = $sub.id
                    $paths += [PSCustomObject]@{
                        id = $subId
                        path = "$deptName > $catName > $subName"
                        categoryId = $catId
                        departmentId = $deptId
                    }
                }
            } else {
                $paths += [PSCustomObject]@{
                    id = $catId
                    path = "$deptName > $catName"
                    categoryId = $catId
                    departmentId = $deptId
                }
            }
        }
    }

    "Total Poshmark category paths found: $($paths.Count)" | Out-File -FilePath $logPath -Append -Encoding utf8

    $jsObjects = @()
    foreach ($p in $paths) {
        $jsonObj = ConvertTo-Json -InputObject $p -Compress
        $jsObjects += "  $jsonObj"
    }

    $outputContent = "const POSHMARK_TAXONOMY = [`r`n" + ($jsObjects -join ",`r`n") + "`r`n];`r`n`r`nmodule.exports = { POSHMARK_TAXONOMY };`r`n"

    "Writing generated JavaScript to $outputPath..." | Out-File -FilePath $logPath -Append -Encoding utf8
    Set-Content -Path $outputPath -Value $outputContent -Encoding utf8
    "Successfully generated and updated: $outputPath" | Out-File -FilePath $logPath -Append -Encoding utf8

} catch {
    "Exception caught: $_" | Out-File -FilePath $logPath -Append -Encoding utf8
    "StackTrace: $($_.ScriptStackTrace)" | Out-File -FilePath $logPath -Append -Encoding utf8
}
