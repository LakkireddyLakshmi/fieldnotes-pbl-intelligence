$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$pblFiles = Get-ChildItem (Join-Path $projectRoot "data\raw\pbl\*.csv")
$grantFinance = Import-Csv (Join-Path $projectRoot "data\raw\grant\01_Grant_Profile_and_Finance.csv")
$grantReports = Import-Csv (Join-Path $projectRoot "data\raw\grant\02_Grant_Performance_and_Report_Material.csv")
$media = Import-Csv (Join-Path $projectRoot "data\raw\grant\03_Evidence_and_Media_Index.csv")
$allRows = @()

foreach ($file in $pblFiles) {
  $allRows += Import-Csv $file.FullName
}

$errors = @()
if ($allRows.Count -ne 6900) { $errors += "Expected 6,900 PBL response rows; found $($allRows.Count)." }
if (($allRows | Select-Object -ExpandProperty "Reporting Month" -Unique).Count -ne 3) {
  $errors += "Expected exactly three reporting months."
}
if (($allRows | Select-Object -ExpandProperty "What is your school's synthetic school code?" -Unique).Count -ne 2300) {
  $errors += "Expected 2,300 unique synthetic school codes."
}
$duplicateKeys = $allRows |
  Group-Object { "$($_."Reporting Month")|$($_."What is your school's synthetic school code?")" } |
  Where-Object Count -gt 1
if ($duplicateKeys.Count) { $errors += "Found duplicate school-month response keys." }
if ($grantFinance.Count -ne 45 -or $grantReports.Count -ne 9 -or $media.Count -ne 9) {
  $errors += "Unexpected grant finance, performance, or media record counts."
}

foreach ($item in $media) {
  $assetPath = Join-Path $projectRoot "public\evidence\$($item.file_name)"
  if (-not (Test-Path $assetPath)) { $errors += "Missing indexed evidence asset: $($item.file_name)." }
}

$enrollmentColumns = @(
  "Total number of students enrolled in Class 6, including all sections",
  "Total number of students enrolled in Class 7, including all sections",
  "Total number of students enrolled in Class 8, including all sections"
)
$mathColumns = @(
  "Average student attendance during the Class 6 PBL Math session. If you did not teach Math in Class 6, enter 0.",
  "Average student attendance during the Class 7 PBL Math session. If you did not teach Math in Class 7, enter 0.",
  "Average student attendance during the Class 8 PBL Math session. If you did not teach Math in Class 8, enter 0."
)
$scienceColumns = @(
  "Average student attendance during the Class 6 PBL Science session. If you did not teach Science in Class 6, enter 0.",
  "Average student attendance during the Class 7 PBL Science session. If you did not teach Science in Class 7, enter 0.",
  "Average student attendance during the Class 8 PBL Science session. If you did not teach Science in Class 8, enter 0."
)

foreach ($file in $pblFiles) {
  $rows = @(Import-Csv $file.FullName)
  $participating = @($rows | Where-Object { $_."Was the PBL project conducted in your school this month?" -eq "Yes" })
  $evidence = @($participating | Where-Object { $_."Was evidence submitted for the completed PBL project?" -eq "Yes" })
  $enrollment = 0
  $attendance = 0
  $sessionPlaces = 0

  foreach ($row in $rows) {
    for ($index = 0; $index -lt 3; $index++) {
      $enrollment += [int]$row.($enrollmentColumns[$index])
    }
  }

  foreach ($row in $participating) {
    $classText = $row."In which class/classes did you conduct the PBL project?"
    $subjectText = $row."Which subject do you teach?"
    for ($index = 0; $index -lt 3; $index++) {
      $grade = $index + 6
      $enrollmentValue = [int]$row.($enrollmentColumns[$index])
      if ($classText -match "(?<!\d)$grade(?!\d)") {
        if ($subjectText.Contains("Math")) {
          $attendance += [int]$row.($mathColumns[$index])
          $sessionPlaces += $enrollmentValue
        }
        if ($subjectText.Contains("Science")) {
          $attendance += [int]$row.($scienceColumns[$index])
          $sessionPlaces += $enrollmentValue
        }
      }
    }
  }

  $month = $rows[0]."Reporting Month"
  [pscustomobject]@{
    Month = $month
    Schools = $rows.Count
    Participating = $participating.Count
    ParticipationPercent = [math]::Round(100 * $participating.Count / $rows.Count, 1)
    EvidencePercent = [math]::Round(100 * $evidence.Count / $participating.Count, 1)
    Enrollment = $enrollment
    Attendance = $attendance
    SessionPlaces = $sessionPlaces
    AttendancePercent = if ($sessionPlaces) { [math]::Round(100 * $attendance / $sessionPlaces, 1) } else { $null }
  } | Format-List
}

if ($errors.Count) {
  $errors | ForEach-Object { Write-Error $_ }
  exit 1
}
Write-Output "Data validation passed: 6,900 unique school-month rows, 45 finance rows, 9 grant reports, and 9 linked media records."
