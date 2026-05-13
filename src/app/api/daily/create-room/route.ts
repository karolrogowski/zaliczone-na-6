export async function POST() {
  const apiKey = process.env.DAILY_API_KEY

  // Fallback dla środowiska testowego / brak klucza
  if (!apiKey) {
    const mockName = `test-room-${Date.now()}`
    return Response.json({
      name: mockName,
      url: `https://test.daily.co/${mockName}`,
    })
  }

  const exp = Math.floor(Date.now() / 1000) + 3600 * 2

  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        exp,
        max_participants: 2,
        enable_chat: false,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return Response.json(
      { error: `Daily.co API zwróciło błąd: ${res.status} ${text}` },
      { status: 500 }
    )
  }

  const room = await res.json()
  return Response.json({ name: room.name, url: room.url })
}