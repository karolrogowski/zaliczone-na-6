'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/domains/auth/actions'

type Props = {
  fullName: string
  role: 'student' | 'tutor'
}

export function AppSidebar({ fullName, role }: Props) {
  const pathname = usePathname()
  const isStudent = role === 'student'

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')

  function active(path: string, exact = false) {
    return exact ? pathname === path : pathname.startsWith(path)
  }

  return (
    <aside
      className="w-[210px] shrink-0 flex flex-col py-[18px] px-3 border-r border-[#e8e6de]"
      style={{ backgroundColor: '#f5f5f3' }}
    >
      <div className="text-[13px] font-medium text-[#2c2c2a] px-2 pb-4 mb-[14px] border-b border-[#e8e6de]">
        Zaliczone na 6
      </div>

      {isStudent && (
        <Link
          href="/request"
          className="flex items-center gap-[10px] px-[11px] py-[9px] rounded-[8px] text-[12px] font-medium text-[#0C447C] bg-[#E6F1FB] hover:bg-[#d3e7f8] transition-colors mb-[6px]"
        >
          <PlusIcon />
          Nowe zlecenie
        </Link>
      )}

      <NavLink href="/dashboard" active={active('/dashboard', true)} icon={<DashboardIcon />}>Dashboard</NavLink>
      <NavLink href="/history"   active={active('/history')}         icon={<HistoryIcon />}>Historia</NavLink>
      {!isStudent && (
        <NavLink href="/profile" active={active('/profile', true)} icon={<UsersIcon />}>Profil</NavLink>
      )}

      <div className="flex-1" />

      <div className="pt-3 border-t border-[#e8e6de]">
        <NavLink href="/settings" active={active('/settings', true)} icon={<SettingsIcon />}>Ustawienia</NavLink>

        <div className="flex items-center gap-[10px] px-2 py-[6px] mt-1">
          <div
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-medium shrink-0"
            style={isStudent
              ? { backgroundColor: '#E6F1FB', color: '#0C447C' }
              : { backgroundColor: '#E1F5EE', color: '#085041' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-[#2c2c2a] leading-[1.2] truncate">{fullName}</p>
            <p className="text-[10px] text-[#888780] mt-[1px]">{isStudent ? 'Uczeń' : 'Korepetytor'}</p>
          </div>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="cursor-pointer w-full flex items-center gap-[10px] px-[10px] py-[8px] rounded-[8px] text-[12px] text-[#5f5e5a] hover:bg-white hover:text-[#2c2c2a] transition-colors"
          >
            <LogoutIcon />
            Wyloguj
          </button>
        </form>
      </div>
    </aside>
  )
}

function NavLink({
  href, active, icon, children, badge,
}: {
  href: string
  active: boolean
  icon: React.ReactNode
  children: React.ReactNode
  badge?: number
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-[10px] px-[10px] py-[8px] rounded-[8px] text-[12px] transition-colors ${
        active
          ? 'bg-white font-medium text-[#2c2c2a] shadow-[inset_0_0_0_0.5px_#e8e6de]'
          : 'text-[#5f5e5a] hover:bg-white hover:text-[#2c2c2a]'
      }`}
    >
      <span className="opacity-85 shrink-0">{icon}</span>
      {children}
      {badge !== undefined && (
        <span className="ml-auto bg-[#FAEEDA] text-[#633806] text-[10px] font-medium px-[6px] py-[1px] rounded-[8px]">
          {badge}
        </span>
      )}
    </Link>
  )
}

function PlusIcon() {
  return <svg className="w-[14px] h-[14px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function DashboardIcon() {
  return <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
}
function HistoryIcon() {
  return <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}
function UsersIcon() {
  return <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function SettingsIcon() {
  return (
    <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
function LogoutIcon() {
  return <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
