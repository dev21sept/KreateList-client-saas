Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$serializer.MaxJsonLength = 67108864

function Get-LeafPaths($catalogs, $currentPath = @()) {
    $paths = @()
    foreach ($cat in $catalogs) {
        $title = $cat["title"]
        $newPath = $currentPath + $title
        $childCatalogs = $cat["catalogs"]
        if ($childCatalogs -and $childCatalogs.Length -gt 0) {
            $paths += Get-LeafPaths $childCatalogs $newPath
        } else {
            # Leaf node with attributes
            $item = @{
                id = $cat["id"]
                path = $newPath -join ' > '
                brand_field_visibility = $cat["brand_field_visibility"]
                size_field_visibility = $cat["size_field_visibility"]
                color_field_visibility = $cat["color_field_visibility"]
                isbn_field_visibility = $cat["isbn_field_visibility"]
                author_field_visibility = $cat["author_field_visibility"]
                book_title_field_visibility = $cat["book_title_field_visibility"]
                video_game_rating_field_visibility = $cat["video_game_rating_field_visibility"]
                measurements_field_visibility = $cat["measurements_field_visibility"]
            }
            $paths += $item
        }
    }
    return $paths
}

try {
    $jsonPath = "d:\Project\elister\backend\vinted_initializers.json"
    $outputPath = "d:\Project\elister\backend\constants\vintedTaxonomy.js"

    [System.Console]::Out.WriteLine("Reading file...")
    $content = [System.IO.File]::ReadAllText($jsonPath)
    
    [System.Console]::Out.WriteLine("Deserializing JSON...")
    $data = $serializer.DeserializeObject($content)
    
    [System.Console]::Out.WriteLine("Parsing catalogs with dynamic field rules...")
    $catalogs = $data["catalogs"]
    $leafPaths = Get-LeafPaths $catalogs
    [System.Console]::Out.WriteLine("Found $($leafPaths.Count) leaf categories.")

    $jsLines = @()
    foreach ($p in $leafPaths) {
        $escapedPath = $p.path.Replace('\', '\\').Replace('"', '\"')
        $id = $p.id
        
        # Convert 1/0/True/False to JS boolean literals
        $brand = if ($p.brand_field_visibility -eq 1 -or $p.brand_field_visibility -eq $true) { "true" } else { "false" }
        $size = if ($p.size_field_visibility -eq 1 -or $p.size_field_visibility -eq $true) { "true" } else { "false" }
        $color = if ($p.color_field_visibility -eq 1 -or $p.color_field_visibility -eq $true) { "true" } else { "false" }
        $isbn = if ($p.isbn_field_visibility -eq 1 -or $p.isbn_field_visibility -eq $true) { "true" } else { "false" }
        $author = if ($p.author_field_visibility -eq 1 -or $p.author_field_visibility -eq $true) { "true" } else { "false" }
        $book_title = if ($p.book_title_field_visibility -eq 1 -or $p.book_title_field_visibility -eq $true) { "true" } else { "false" }
        $game_rating = if ($p.video_game_rating_field_visibility -eq 1 -or $p.video_game_rating_field_visibility -eq $true) { "true" } else { "false" }
        $measurements = if ($p.measurements_field_visibility -eq 1 -or $p.measurements_field_visibility -eq $true) { "true" } else { "false" }

        $jsLines += "  { id: $id, path: `"$escapedPath`", brand_field_visibility: $brand, size_field_visibility: $size, color_field_visibility: $color, isbn_field_visibility: $isbn, author_field_visibility: $author, book_title_field_visibility: $book_title, video_game_rating_field_visibility: $game_rating, measurements_field_visibility: $measurements }"
    }

    $output = "const VINTED_TAXONOMY = [`n" + ($jsLines -join ",`n") + "`n];`n`nmodule.exports = { VINTED_TAXONOMY };`n"
    
    [System.Console]::Out.WriteLine("Writing output file...")
    [System.IO.File]::WriteAllText($outputPath, $output)
    [System.Console]::Out.WriteLine("Successfully updated Vinted Taxonomy with dynamic attributes!")
} catch {
    [System.Console]::Error.WriteLine("Error occurred: $_")
    [System.Console]::Error.WriteLine($_.ScriptStackTrace)
}
