import { ResetPasswordForm } from '@/domains/auth/components/ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={{ backgroundColor: '#f5f5f3' }}>

      <div
        aria-hidden
        className="absolute pointer-events-none select-none font-bold leading-[0.8] tracking-[-0.04em]"
        style={{ right: '-4vw', bottom: '-22vh', fontSize: '92vh', color: '#185FA5', opacity: 0.05, zIndex: 0 }}
      >
        6
      </div>

      <nav className="relative z-10 flex items-center py-[22px] px-[clamp(20px,5vw,56px)]">
        <div className="flex items-center gap-[9px] text-[15px] font-medium text-[#2c2c2a]">
          <span className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[13px] font-bold text-white bg-[#185FA5]">
            6
          </span>
          Zaliczone na 6
        </div>
      </nav>

      <main className="relative z-10 flex flex-col items-center justify-center px-5 pb-14" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="w-full max-w-[452px]">

          <div className="w-12 h-12 rounded-[14px] bg-[#E6F1FB] flex items-center justify-center mb-6">
            <svg className="w-6 h-6 text-[#185FA5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>

          <h1
            className="font-medium leading-[1.12] tracking-[-0.02em] text-[#2c2c2a] mb-[14px]"
            style={{ fontSize: 'clamp(30px, 4.6vw, 42px)' }}
          >
            Nowe hasło.<br />
            <span style={{ color: '#0C447C' }}>Zaraz gotowe.</span>
          </h1>
          <p className="text-[15.5px] text-[#5f5e5a] leading-[1.6] mb-[30px]">
            Ustaw nowe hasło dla swojego konta.
          </p>

          <ResetPasswordForm />
        </div>
      </main>
    </div>
  )
}
