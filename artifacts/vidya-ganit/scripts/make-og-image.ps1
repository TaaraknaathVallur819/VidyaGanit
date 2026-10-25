<#
.SYNOPSIS
  Regenerates public/opengraph.jpg, the 1200x630 card used for link previews.

.DESCRIPTION
  The preview image has to be rebuilt whenever the homepage wording changes,
  otherwise shared links keep advertising the old copy. That already happened
  once: the card was a homepage screenshot taken before "Math" became "Maths",
  so every shared link previewed a headline the site no longer used.

  This draws the card instead of screenshotting it. A screenshot scaled into a
  preview slot loses its body text; a card laid out for 1200x630 stays readable
  at the ~500px most feeds actually render.

  Colours mirror src/index.css and the header logo, so the card and the site
  stay recognisably the same brand.

  Windows only: it uses System.Drawing (GDI+) via Windows PowerShell, which is
  what the project's machine has. There is no cross-platform equivalent here,
  so treat it as a maintenance tool rather than part of the build.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\make-og-image.ps1

.EXAMPLE
  # After changing the hero copy:
  .\make-og-image.ps1 -HeadlineTop "Maths that clicks" -HeadlineBottom "every time."
#>
[CmdletBinding()]
param(
  [string]$Badge          = 'The Socratic Maths Companion',
  [string]$HeadlineTop    = 'Maths tutoring that',
  [string]$HeadlineBottom = 'makes sense.',
  [string]$Strapline      = $null,   # defaults below; needs char codes for the dashes
  [string]$OutFile        = (Join-Path $PSScriptRoot '..\public\opengraph.jpg')
)

Add-Type -AssemblyName System.Drawing

$W = 1200; $H = 630
$ndash = [char]0x2013   # en dash
$mdot  = [char]0x00B7   # middle dot
if (-not $Strapline) { $Strapline = "Classes 4$ndash" + "7 $mdot CBSE, ICSE and state boards" }

function C([string]$hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }

# Prefer the site's own typeface when the machine has it, but stay usable on one
# that does not. Inter is what the site loads from Google Fonts.
function PickFont([string[]]$candidates) {
  $installed = (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }
  foreach ($c in $candidates) { if ($installed -contains $c) { return $c } }
  return $candidates[-1]
}
$sans  = PickFont @('Inter', 'Segoe UI', 'Arial')
$serif = PickFont @('Georgia', 'Times New Roman')
Write-Verbose "Using $sans for text and $serif for the logo mark."

function RoundedPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x,       $y,       $d, $d, 180, 90)
  $p.AddArc($x+$w-$d, $y,       $d, $d, 270, 90)
  $p.AddArc($x+$w-$d, $y+$h-$d, $d, $d,   0, 90)
  $p.AddArc($x,       $y+$h-$d, $d, $d,  90, 90)
  $p.CloseFigure()
  return $p
}

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# ---- background + dot grid ------------------------------------------------
$g.FillRectangle((New-Object System.Drawing.SolidBrush (C '#F8F8FD')), 0, 0, $W, $H)
$dotA = New-Object System.Drawing.SolidBrush (C '#DCE0F6')
$dotB = New-Object System.Drawing.SolidBrush (C '#FBE7CE')
$step = 48; $rad = 3.5
# Alternate on integer row/column indices. Deriving the parity from the pixel
# coordinates divides into a float and collapses the grid to a single colour.
$row = 0
for ($y = 34; $y -lt $H; $y += $step) {
  $col = 0
  for ($x = 34; $x -lt $W; $x += $step) {
    $brush = if ((($row + $col) % 2) -eq 0) { $dotA } else { $dotB }
    $g.FillEllipse($brush, [single]($x-$rad), [single]($y-$rad), [single]($rad*2), [single]($rad*2))
    $col++
  }
  $row++
}

$sfC = New-Object System.Drawing.StringFormat
$sfC.Alignment = [System.Drawing.StringAlignment]::Center
$sfC.LineAlignment = [System.Drawing.StringAlignment]::Center
$sfL = New-Object System.Drawing.StringFormat
$sfL.Alignment = [System.Drawing.StringAlignment]::Near
$sfL.LineAlignment = [System.Drawing.StringAlignment]::Center

# ---- brand lockup ---------------------------------------------------------
$indigo = C '#393181'
$logoX = 72; $logoY = 52; $logoS = 60
$g.FillPath((New-Object System.Drawing.SolidBrush $indigo), (RoundedPath $logoX $logoY $logoS $logoS 12))
$vFont = New-Object System.Drawing.Font($serif, 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('V', $vFont, [System.Drawing.Brushes]::White,
  (New-Object System.Drawing.RectangleF($logoX, $logoY, $logoS, $logoS)), $sfC)
$wordFont = New-Object System.Drawing.Font($sans, 36, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('VidyaGanit', $wordFont, (New-Object System.Drawing.SolidBrush $indigo),
  (New-Object System.Drawing.RectangleF(($logoX+$logoS+16), $logoY, 400, $logoS)), $sfL)

# ---- badge pill (sized to its text) ---------------------------------------
$badgeFont = New-Object System.Drawing.Font($sans, 23, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$bW = $g.MeasureString($Badge, $badgeFont).Width + 64
$bH = 52; $bX = ($W-$bW)/2; $bY = 196
$bp = RoundedPath $bX $bY $bW $bH ($bH/2)
$g.FillPath([System.Drawing.Brushes]::White, $bp)
$g.DrawPath((New-Object System.Drawing.Pen((C '#DDE0F4'), 2)), $bp)
$g.DrawString($Badge, $badgeFont, (New-Object System.Drawing.SolidBrush (C '#4C3FBF')),
  (New-Object System.Drawing.RectangleF($bX, $bY, $bW, $bH)), $sfC)

# ---- headline -------------------------------------------------------------
$headFont = New-Object System.Drawing.Font($sans, 82, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$topY = 272; $botY = 366; $lineH = 96
$g.DrawString($HeadlineTop, $headFont, (New-Object System.Drawing.SolidBrush (C '#1E293B')),
  (New-Object System.Drawing.RectangleF(0, $topY, $W, $lineH)), $sfC)
$g.DrawString($HeadlineBottom, $headFont, (New-Object System.Drawing.SolidBrush (C '#7C3AED')),
  (New-Object System.Drawing.RectangleF(0, $botY, $W, $lineH)), $sfC)

# Underline derived from the measured width of the line it sits under, so it
# still fits when the copy or the available font changes.
$botW = $g.MeasureString($HeadlineBottom, $headFont).Width
$uL = ($W - $botW)/2 + 10
$uR = ($W + $botW)/2 - 16
$uY = $botY + $lineH + 8
$swoosh = New-Object System.Drawing.Pen((C '#F5A623'), 11)
$swoosh.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$swoosh.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
$span = $uR - $uL
# Each coordinate is cast and parenthesised on its own: PowerShell reads
# `New-Object PointF($a, $b + 2)` as an array of three arguments, not two, and
# the constructor then fails to bind.
function Pt([double]$x, [double]$y) { New-Object System.Drawing.PointF([single]$x, [single]$y) }
$pts = [System.Drawing.PointF[]]@(
  (Pt $uL                ($uY + 2)),
  (Pt ($uL + $span*0.33) ($uY - 7)),
  (Pt ($uL + $span*0.69) ($uY + 6)),
  (Pt $uR                ($uY - 6))
)
$g.DrawCurve($swoosh, $pts, [single]0.6)

# ---- strapline ------------------------------------------------------------
$subFont = New-Object System.Drawing.Font($sans, 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString($Strapline, $subFont, (New-Object System.Drawing.SolidBrush (C '#5A6478')),
  (New-Object System.Drawing.RectangleF(0, 516, $W, 44)), $sfC)

# ---- save -----------------------------------------------------------------
$OutFile = [System.IO.Path]::GetFullPath($OutFile)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 92)
$bmp.Save($OutFile, $codec, $ep)
$g.Dispose(); $bmp.Dispose()

"Wrote {0} ({1}x{2}, {3:N0} bytes) using {4}." -f $OutFile, $W, $H, (Get-Item $OutFile).Length, $sans

# Only nag when the copy on the card actually differs from the defaults,
# otherwise the reminder fires on every routine rebuild and gets ignored.
# Note this cannot see a change made by editing the defaults above rather than
# by passing a parameter; if you do that, update the alt text as well.
$copyParams = @('Badge', 'HeadlineTop', 'HeadlineBottom', 'Strapline')
$changed = $copyParams | Where-Object { $PSBoundParameters.ContainsKey($_) }
if ($changed) {
  Write-Warning ("Card copy changed ({0}). Update og:image:alt and twitter:image:alt in index.html to match." -f ($changed -join ', '))
}
