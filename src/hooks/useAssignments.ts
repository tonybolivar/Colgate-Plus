import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase/client'
import type { Assignment } from '../types'

interface AssignmentFilter {
  status?: string
  course_id?: string
  due_before?: string
  due_after?: string
}

export function useAssignments(filter?: AssignmentFilter) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAssignments() {
      try {
        let query = supabase
          .from('assignments')
          .select('*, course:courses(*)')
          .order('due_date', { ascending: true, nullsFirst: false })

        if (filter?.status) query = query.eq('status', filter.status)
        if (filter?.course_id) query = query.eq('course_id', filter.course_id)
        if (filter?.due_before) query = query.lte('due_date', filter.due_before)
        if (filter?.due_after) query = query.gte('due_date', filter.due_after)

        const { data, error } = await query
        if (error) throw error
        setAssignments(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch assignments')
      } finally {
        setLoading(false)
      }
    }

    fetchAssignments()
  }, [filter?.status, filter?.course_id, filter?.due_before, filter?.due_after])

  async function updateStatus(id: string, status: Assignment['status']) {
    const { error } = await supabase
      .from('assignments')
      .update({ status })
      .eq('id', id)

    if (!error) {
      setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, status } : a))
    }
    return { error }
  }

  return { assignments, loading, error, updateStatus }
}
