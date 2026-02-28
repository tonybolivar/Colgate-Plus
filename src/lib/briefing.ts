import { supabase } from './supabase/client'
import type { Assignment } from '../types'

export async function generateBriefing(
  assignments: Assignment[],
  firstName: string
): Promise<string> {
  const now = new Date()
  const datetime = now.toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  const relevant = assignments
    .filter((a) => a.due_date && a.status === 'pending')
    .slice(0, 20)
    .map((a) => ({
      title: a.title,
      course: a.course?.short_name || a.course?.name || 'Unknown',
      due: a.due_date,
      type: a.type,
      status: a.status,
    }))

  const { data, error } = await supabase.functions.invoke('briefing', {
    body: { assignments: relevant, firstName, datetime },
  })

  if (error || !data?.text) throw new Error(error?.message || 'Briefing failed')

  return data.text
}
