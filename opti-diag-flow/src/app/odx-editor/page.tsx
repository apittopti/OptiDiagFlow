'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ODXEditorPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to jobs page as there's no default ODX editor
    router.push('/jobs')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Redirecting to Jobs...</h2>
        <p className="text-gray-600">Please select a job to edit ODX data.</p>
      </div>
    </div>
  )
}