/**
 * Abstrakcja dostawcy wideo — jedyne miejsce do zmiany przy przełączaniu providerów.
 *
 * Aktywny provider: Whereby Embedded
 * Żeby wrócić do Daily.co: zamień implementację createVideoRoom() na blok oznaczony "DAILY.CO"
 */

export type VideoRoom = {
  name: string
  url: string       // URL dla uczestnika (uczeń)
  hostUrl: string   // URL dla hosta z uprawnieniami (korepetytor)
}

export async function createVideoRoom(): Promise<VideoRoom> {
  return createWherebyRoom()
}

/** Usuwa pokój wideo — wywołaj po zakończeniu sesji żeby nie naliczać minut. Best-effort: błędy są logowane, nie rzucane. */
export async function deleteVideoRoom(roomName: string): Promise<void> {
  await deleteWherebyRoom(roomName)
}

// ─── Whereby Embedded ────────────────────────────────────────────────────────
// Wymaga: WHEREBY_API_KEY w .env.local (app.whereby.com/user/profile → API keys)
// Free tier: 2 000 participant-minutes/miesiąc, bez karty kredytowej.

async function createWherebyRoom(): Promise<VideoRoom> {
  const apiKey = process.env.WHEREBY_API_KEY

  if (!apiKey) {
    const name = `test-room-${Date.now()}`
    return {
      name,
      url: `https://test.whereby.com/${name}`,
      hostUrl: `https://test.whereby.com/${name}?roomKey=testkey`,
    }
  }

  const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const res = await fetch('https://api.whereby.dev/v1/meetings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endDate, fields: ['hostRoomUrl'] }),
  })

  if (!res.ok) throw new Error(`Whereby API error: ${res.status}`)

  const data = await res.json()
  return {
    name: data.meetingId,
    url: data.roomUrl,
    hostUrl: data.hostRoomUrl,
  }
}

async function deleteWherebyRoom(meetingId: string): Promise<void> {
  const apiKey = process.env.WHEREBY_API_KEY
  if (!apiKey || meetingId.startsWith('test-room-')) return

  try {
    await fetch(`https://api.whereby.dev/v1/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  } catch (err) {
    console.error('[Whereby] Nie udało się usunąć pokoju:', meetingId, err)
  }
}

// ─── Daily.co ────────────────────────────────────────────────────────────────
// Żeby przywrócić: zamień ciało createVideoRoom() na createDailyRoom()
// Wymagane: DAILY_API_KEY w .env.local

// async function createDailyRoom(): Promise<VideoRoom> {
//   const apiKey = process.env.DAILY_API_KEY
//   if (!apiKey) {
//     const name = `test-room-${Date.now()}`
//     return { name, url: `https://test.daily.co/${name}`, hostUrl: `https://test.daily.co/${name}` }
//   }
//   const res = await fetch('https://api.daily.co/v1/rooms', {
//     method: 'POST',
//     headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       properties: { exp: Math.floor(Date.now() / 1000) + 7200, max_participants: 2 },
//     }),
//   })
//   if (!res.ok) throw new Error(`Daily.co error: ${res.status}`)
//   const room = await res.json()
//   return { name: room.name, url: room.url, hostUrl: room.url }
// }