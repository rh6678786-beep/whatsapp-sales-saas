$body = @{ From = "whatsapp:+923004444444"; Body = "price" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/webhook/whatsapp" -Method Post -Body $body -ContentType "application/json"
$response