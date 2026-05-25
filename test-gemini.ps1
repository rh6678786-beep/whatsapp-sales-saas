$apiKey = "AIzaSyBDj50E7C_3eaCq14CSp79ybg8QnyOqOV8"
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$apiKey"

$body = @{
    contents = @(
        @{
            parts = @(
                @{ text = "Say 'Hello' in Urdu" }
            )
        }
    )
} | ConvertTo-Json -Depth 3

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30
    Write-Host "✅ Gemini API working!"
    Write-Host $response.candidates[0].content.parts[0].text
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)"
}