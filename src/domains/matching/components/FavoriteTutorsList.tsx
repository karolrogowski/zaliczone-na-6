'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removeFavoriteTutor } from '../actions'

type FavoriteTutor = { tutorId: string; tutorName: string }

export function FavoriteTutorsList({ tutors }: { tutors: FavoriteTutor[] }) {
  if (tutors.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        Nie masz jeszcze żadnych ulubionych korepetytorów.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {tutors.map((t) => (
        <FavoriteTutorRow key={t.tutorId} tutor={t} />
      ))}
    </ul>
  )
}

function FavoriteTutorRow({ tutor }: { tutor: FavoriteTutor }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleRemove() {
    startTransition(async () => {
      await removeFavoriteTutor(tutor.tutorId)
      router.refresh()
    })
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5">
      <span className="text-sm text-zinc-800">{tutor.tutorName}</span>
      <button
        onClick={handleRemove}
        disabled={isPending}
        className="cursor-pointer shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Usuwanie...' : 'Usuń z ulubionych'}
      </button>
    </li>
  )
}
