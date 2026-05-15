export const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Oczekuje',      className: 'bg-yellow-100 text-yellow-800' },
  accepted:  { label: 'Zaakceptowane', className: 'bg-blue-100 text-blue-800' },
  cancelled: { label: 'Anulowane',     className: 'bg-zinc-100 text-zinc-500' },
  expired:   { label: 'Wygasłe',       className: 'bg-zinc-100 text-zinc-500' },
  completed: { label: 'Zakończone',    className: 'bg-green-100 text-green-800' },
}

export const STATUS_LABEL_FALLBACK = { label: '', className: 'bg-zinc-100 text-zinc-500' }