import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase/client'
import type { SyncProgress } from '../types'

export function useMoodleSync() {
  const [progress, setProgress] = useState<SyncProgress>({
    total: 0,
    completed: 0,
    current_course: null,
    status: 'idle',
    error: null,
  })

  const triggerSync = useCallback(async () => {
    setProgress({ total: 0, completed: 0, current_course: null, status: 'syncing', error: null })

    try {
      const { data, error } = await supabase.functions.invoke('sync-moodle')
      console.log('[sync-moodle] data:', data, 'error:', error)

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || JSON.stringify({ data, error }) || 'Sync failed')
      }

      setProgress({
        total: data.courses_count,
        completed: data.courses_count,
        current_course: null,
        status: 'done',
        error: null,
      })
    } catch (err) {
      setProgress((p) => ({
        ...p,
        status: 'error',
        error: err instanceof Error ? err.message : 'Sync failed',
      }))
    }
  }, [])

  return { progress, triggerSync }
}
