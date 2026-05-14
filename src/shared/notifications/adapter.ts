/**
 * Adapter powiadomień — jedyne miejsce do zmiany przy dodawaniu email/SMS/push.
 *
 * Aktywna implementacja: NoOp (brak wysyłania).
 * Żeby dodać email: stwórz klasę EmailNotificationAdapter implementującą interfejs poniżej,
 * a następnie zwróć jej instancję z createNotificationAdapter().
 *
 * Wzorzec identyczny jak src/domains/sessions/video-provider.ts.
 */

export interface NotificationAdapter {
  /** Wywoływane gdy korepetytor zaakceptuje zlecenie — uczeń dowiaduje się że sesja startuje. */
  onSessionStarted(params: {
    studentId: string
    sessionId: string
    subject: string
  }): Promise<void>

  /** Wywoływane po zakończeniu sesji przez dowolną stronę. */
  onSessionEnded(params: {
    studentId: string
    tutorId: string
    sessionId: string
  }): Promise<void>

  /** Wywoływane gdy zlecenie ucznia wygaśnie bez akceptacji. */
  onRequestExpired(params: { studentId: string; subject: string }): Promise<void>
}

// ─── NoOp (aktywny) ──────────────────────────────────────────────────────────

class NoOpNotificationAdapter implements NotificationAdapter {
  async onSessionStarted(): Promise<void> {}
  async onSessionEnded(): Promise<void> {}
  async onRequestExpired(): Promise<void> {}
}

export function createNotificationAdapter(): NotificationAdapter {
  return new NoOpNotificationAdapter()
}

// ─── Email (przykład, do zaimplementowania) ───────────────────────────────────
//
// import { Resend } from 'resend'
//
// class EmailNotificationAdapter implements NotificationAdapter {
//   private resend = new Resend(process.env.RESEND_API_KEY)
//
//   async onSessionStarted({ studentId, subject }) {
//     await this.resend.emails.send({ ... })
//   }
//   ...
// }
//
// Żeby włączyć: zamień ciało createNotificationAdapter() na:
//   return new EmailNotificationAdapter()