$filePath = "C:\Optimotive-dev\OptiDiagFlow\ExamplesForClaude\TraceLogs\Landrover\Defender\2020\Camera Calibration\8873778.txt"
$url = "http://localhost:6001/api/jobs/upload"

# Create the multipart form data
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$bodyLines = @()
$bodyLines += "--$boundary"
$bodyLines += "Content-Disposition: form-data; name=`"vehicleId`""
$bodyLines += ""
$bodyLines += "cmfochyq60004uczcty2z5o8a"
$bodyLines += "--$boundary"
$bodyLines += "Content-Disposition: form-data; name=`"jobName`""
$bodyLines += ""
$bodyLines += "Land Rover Defender Camera Calibration - Full Trace"
$bodyLines += "--$boundary"
$bodyLines += "Content-Disposition: form-data; name=`"file`"; filename=`"8873778.txt`""
$bodyLines += "Content-Type: text/plain"
$bodyLines += ""
$fileContent = Get-Content $filePath -Raw
$bodyLines += $fileContent
$bodyLines += "--$boundary--"

$body = $bodyLines -join $LF

$headers = @{
    "Content-Type" = "multipart/form-data; boundary=$boundary"
}

$response = Invoke-WebRequest -Uri $url -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -Headers $headers -UseBasicParsing
Write-Output $response.Content