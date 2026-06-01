import { getCurrentProfile } from '@/domains/auth/queries'
import { AppSidebar } from './components/AppSidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#f5f5f3' }}>
      {profile && (profile.role === 'student' || profile.role === 'tutor') && (
        <AppSidebar
          fullName={profile.full_name ?? ''}
          role={profile.role}
        />
      )}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </div>
    </div>
  )
}
