# Recadre et compresse une photo de commerce pour le web (Windows).
#
#   pwsh tools/crop-photo.ps1 -Image IMG_1234.jpeg -X 0 -Y 1500 -W 3213 -H 2410 `
#        -Out clients/garage/facade.jpg -TargetWidth 1400
#
# Le rapport d'affichage attendu par le gabarit :
#   hero (première photo) : 4/3      galerie (suivantes) : 3/2
# Le recadrage doit respecter ce rapport, sinon le navigateur rogne au centre
# et coupe souvent l'enseigne.

param(
  [Parameter(Mandatory)][string]$Image,
  [Parameter(Mandatory)][int]$X, [Parameter(Mandatory)][int]$Y,
  [Parameter(Mandatory)][int]$W, [Parameter(Mandatory)][int]$H,
  [Parameter(Mandatory)][string]$Out,
  [int]$TargetWidth = 1400,
  [int]$Quality = 80
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Image))
$tw = $TargetWidth
$th = [int][Math]::Round($TargetWidth * $H / $W)

$dst = New-Object System.Drawing.Bitmap($tw, $th)
$g = [System.Drawing.Graphics]::FromImage($dst)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($src,
  (New-Object System.Drawing.Rectangle(0, 0, $tw, $th)),
  (New-Object System.Drawing.Rectangle($X, $Y, $W, $H)),
  [System.Drawing.GraphicsUnit]::Pixel)

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [int]$Quality)

$dir = Split-Path -Parent $Out
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
$dst.Save($Out, $codec, $ep)

"{0} : {1}x{2}, {3} Ko (rapport {4:N2})" -f `
  $Out, $tw, $th, [math]::Round((Get-Item $Out).Length / 1KB), ($tw / $th)

$g.Dispose(); $dst.Dispose(); $src.Dispose()
