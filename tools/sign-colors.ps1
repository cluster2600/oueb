# Relève les couleurs d'une enseigne sur une photo de façade (Windows).
#
#   pwsh tools/sign-colors.ps1 -Image photo.jpg -X 885 -Y 1840 -W 1400 -H 1100
#
# Donne le fond et le lettrage du panneau, séparés par percentile de luminance.
#
# Pourquoi des percentiles et non une moyenne : une moyenne mélange les pixels
# d'anti-crénelage des lettres avec le fond et sort une teinte boueuse qui
# n'existe nulle part sur le panneau. On isole donc les extrêmes.
#
# Les valeurs sorties sont celles de la PHOTO. Un panneau à l'ombre donne des
# teintes sombres et désaturées : il faut remonter la luminosité pour l'écran
# en gardant la teinte, puis vérifier le contraste (voir docs/production-client.md).

param(
  [Parameter(Mandatory)][string]$Image,
  [Parameter(Mandatory)][int]$X, [Parameter(Mandatory)][int]$Y,
  [Parameter(Mandatory)][int]$W, [Parameter(Mandatory)][int]$H,
  [int]$Step = 3
)

Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Image))
Write-Host "image : $($bmp.Width) x $($bmp.Height)"

$px = @()
for ($j = $Y; $j -lt [Math]::Min($Y + $H, $bmp.Height); $j += $Step) {
  for ($i = $X; $i -lt [Math]::Min($X + $W, $bmp.Width); $i += $Step) {
    $c = $bmp.GetPixel($i, $j)
    $px += [pscustomobject]@{ R = $c.R; G = $c.G; B = $c.B
                              L = 0.2126 * $c.R + 0.7152 * $c.G + 0.0722 * $c.B }
  }
}
$bmp.Dispose()

if ($px.Count -eq 0) { Write-Error "zone vide — vérifiez X/Y/W/H"; exit 1 }
$sorted = $px | Sort-Object L
$n = $sorted.Count

function Show($label, $slice) {
  $r = [int]($slice | Measure-Object -Property R -Average).Average
  $g = [int]($slice | Measure-Object -Property G -Average).Average
  $b = [int]($slice | Measure-Object -Property B -Average).Average
  "{0,-26} #{1:x2}{2:x2}{3:x2}   rgb({1},{2},{3})   n={4}" -f $label, $r, $g, $b, $slice.Count
}

Show "lettrage (6% + clairs)"  $sorted[[int]($n * 0.94)..($n - 1)]
Show "fond du panneau (20-45%)" $sorted[[int]($n * 0.20)..[int]($n * 0.45)]
Show "ombres (0-10%)"           $sorted[0..[int]($n * 0.10)]
