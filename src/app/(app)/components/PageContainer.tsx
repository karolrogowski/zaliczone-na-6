export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-auto px-8 py-8">
      {children}
    </div>
  )
}
