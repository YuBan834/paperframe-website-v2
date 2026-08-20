$ErrorActionPreference = 'Stop'

$mediaDir = Join-Path $PSScriptRoot '..\assets\images\media'
New-Item -ItemType Directory -Force -Path $mediaDir | Out-Null

$assets = @()

# Query Kitsu so the script always uses its web-sized large renditions rather
# than multi-megabyte originals. The file extension is preserved from the CDN.
$kitsuAnime = @{
    'm01' = 11614; 'm09' = 7158; 'm10' = 4478; 'm11' = 43248;
    'm12' = 45469; 'm22' = 48618; 'm23' = 5497; 'm24' = 47356;
    'm31' = 7023; 'm32' = 21; 'm37' = 5646; 'm38' = 7203
}

foreach ($entry in $kitsuAnime.GetEnumerator()) {
    $anime = (Invoke-RestMethod -Uri "https://kitsu.io/api/edge/anime/$($entry.Value)").data.attributes
    $posterUrl = $anime.posterImage.large
    $posterExt = [System.IO.Path]::GetExtension(([uri]$posterUrl).AbsolutePath)
    $assets += @{ File = "$($entry.Key)$posterExt"; Url = $posterUrl }

    if ($anime.coverImage -and $anime.coverImage.large) {
        $wallpaperUrl = $anime.coverImage.large
        $wallpaperExt = [System.IO.Path]::GetExtension(([uri]$wallpaperUrl).AbsolutePath)
        $assets += @{ File = "$($entry.Key)-wallpaper$wallpaperExt"; Url = $wallpaperUrl }
    }
}

$steamApps = @{
    'm02' = 391540; 'm04' = 553640; 'm06' = 105600; 'm07' = 8500;
    'm18' = 1091500; 'm19' = 2167960; 'm20' = 281990; 'm21' = 730;
    'm25' = 1245620; 'm26' = 1238810; 'm27' = 347620; 'm28' = 1237370;
    'm29' = 394360; 'm30' = 1451940; 'm39' = 2161700; 'm40' = 1388880;
    'm41' = 1607200
}

foreach ($entry in $steamApps.GetEnumerator()) {
    $assets += @{
        File = "$($entry.Key).jpg"
        Url = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/$($entry.Value)/library_600x900_2x.jpg"
    }
    $assets += @{
        File = "$($entry.Key)-wallpaper.jpg"
        Url = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/$($entry.Value)/library_hero.jpg"
    }
}

# App Store artwork is used for the four mobile-first titles that have no
# reliable Steam library cover. Icons are complete official key art; the first
# iPad promotional image supplies a landscape backdrop.
$appStoreApps = @{
    'm03' = 1517783697; 'm05' = 1290687550;
    'm13' = 1571873795; 'm16' = 1535759278
}

foreach ($entry in $appStoreApps.GetEnumerator()) {
    $app = (Invoke-RestMethod -Uri "https://itunes.apple.com/lookup?id=$($entry.Value)&country=us").results[0]
    $assets += @{ File = "$($entry.Key).jpg"; Url = $app.artworkUrl512 }

    $wallpaperUrl = $app.ipadScreenshotUrls | Select-Object -First 1
    if (-not $wallpaperUrl) {
        $wallpaperUrl = $app.screenshotUrls | Select-Object -First 1
    }
    if ($wallpaperUrl) {
        $wallpaperUrl = $wallpaperUrl -replace '/\d+x\d+bb\.', '/1104x828bb.'
        $assets += @{ File = "$($entry.Key)-wallpaper.jpg"; Url = $wallpaperUrl }
    }
}

# The App Store gallery for Glory of Generals 3 opens with an in-game
# screenshot. Use the game's promotional key art for the detail banner instead.
$assets = @($assets | Where-Object { $_.File -ne 'm16-wallpaper.jpg' })
$assets += @{
    File = 'm16-wallpaper.jpg'
    Url = 'https://cdn-www.bluestacks.com/bs-images/gametiles_com.easytech.iron_.android18.jpg'
}

foreach ($asset in $assets) {
    $target = Join-Path $mediaDir $asset.File
    Write-Host "Fetching $($asset.File)"
    & curl.exe --fail --location --silent --show-error --retry 3 --output $target $asset.Url
}

Write-Host "Downloaded $($assets.Count) media assets."
