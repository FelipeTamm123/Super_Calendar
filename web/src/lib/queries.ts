/**
 * Hooks de datos del dominio de estudio (TanStack Query).
 * Como casi todo está relacionado (un apunte genera tareas, una pregunta cambia
 * la hoja de dudas...), las mutaciones invalidan todas las consultas de estudio.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { request } from './api'
import type {
  Agenda,
  CalendarEvent,
  CalendarSettings,
  GoogleEvent,
  SyncResult,
  NoteDetail,
  NoteListItem,
  Page,
  Question,
  Schedule,
  ScheduleDraft,
  ScheduleInput,
  StudyTask,
  Subject,
  SubjectSheet,
  SubjectSummary,
} from './types'

const STUDY_KEYS = ['agenda', 'subjects', 'notes', 'questions', 'tasks', 'sheet', 'schedule', 'calendar'] as const

function invalidateStudy(qc: QueryClient) {
  return Promise.all(STUDY_KEYS.map((key) => qc.invalidateQueries({ queryKey: [key] })))
}

function useStudyMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateStudy(qc) })
}

// --- Estado del backend ------------------------------------------------------

export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    queryFn: () => request<{ ai_enabled: boolean }>('/status'),
    staleTime: 5 * 60_000,
  })
}

// --- Agenda ------------------------------------------------------------------

export function useAgenda(date?: string) {
  return useQuery({
    queryKey: ['agenda', date ?? 'today'],
    queryFn: ({ signal }) => request<Agenda>('/agenda', { query: { date }, signal }),
  })
}

export function useTasks(params: { from?: string; to?: string; subject_id?: number; done?: boolean }) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: ({ signal }) => request<StudyTask[]>('/study-tasks', { query: params, signal }),
  })
}

export function useUpdateTask() {
  return useStudyMutation(({ id, ...data }: { id: number; done?: boolean; due_date?: string; title?: string }) =>
    request<StudyTask>(`/study-tasks/${id}`, { method: 'PATCH', body: data }),
  )
}

export function useCreateTask() {
  return useStudyMutation((data: { subject_id: number; due_date: string; title: string; detail?: string | null }) =>
    request<StudyTask>('/study-tasks', { method: 'POST', body: data }),
  )
}

export function useDeleteTask() {
  return useStudyMutation((id: number) => request<void>(`/study-tasks/${id}`, { method: 'DELETE' }))
}

export function useUpdateTopic() {
  return useStudyMutation(({ id, resolved }: { id: number; resolved: boolean }) =>
    request(`/pending-topics/${id}`, { method: 'PATCH', body: { resolved } }),
  )
}

export function useCreateTopic() {
  return useStudyMutation((data: { subject_id: number; topic: string }) =>
    request('/pending-topics', { method: 'POST', body: data }),
  )
}

// --- Materias ----------------------------------------------------------------

export function useSubjects() {
  return useQuery({
    queryKey: ['subjects'],
    queryFn: ({ signal }) => request<SubjectSummary[]>('/subjects', { signal }),
  })
}

export function useCreateSubject() {
  return useStudyMutation((data: { name: string; color?: string }) =>
    request<Subject>('/subjects', { method: 'POST', body: data }),
  )
}

export function useUpdateSubject() {
  return useStudyMutation(({ id, ...data }: { id: number; name?: string; color?: string }) =>
    request<Subject>(`/subjects/${id}`, { method: 'PATCH', body: data }),
  )
}

export function useDeleteSubject() {
  return useStudyMutation((id: number) => request<void>(`/subjects/${id}`, { method: 'DELETE' }))
}

export function useSubjectSheet(id: number) {
  return useQuery({
    queryKey: ['sheet', id],
    queryFn: ({ signal }) => request<SubjectSheet>(`/subjects/${id}/sheet`, { signal }),
  })
}

// --- Horario -----------------------------------------------------------------

export function useSchedule() {
  return useQuery({
    queryKey: ['schedule'],
    queryFn: ({ signal }) => request<Schedule>('/schedule', { signal }),
  })
}

export function useSaveSchedule() {
  return useStudyMutation((data: ScheduleInput) => request<Schedule>('/schedule', { method: 'PUT', body: data }))
}

export function useImportSchedule() {
  // No invalida nada: solo devuelve un borrador para revisar
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return request<ScheduleDraft>('/schedule/import', { method: 'POST', body: form })
    },
  })
}

// --- Apuntes -----------------------------------------------------------------

export function useNotes(params: { subject_id?: number; limit: number; offset: number }) {
  return useQuery({
    queryKey: ['notes', params],
    queryFn: ({ signal }) => request<Page<NoteListItem>>('/notes', { query: params, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useNote(id: number) {
  return useQuery({
    queryKey: ['notes', 'detail', id],
    queryFn: ({ signal }) => request<NoteDetail>(`/notes/${id}`, { signal }),
  })
}

export type NewNote = { subject_id?: number; class_date?: string; title?: string; text?: string; file?: File | null }

export function useCreateNote() {
  return useStudyMutation((data: NewNote) => {
    const form = new FormData()
    if (data.subject_id) form.append('subject_id', String(data.subject_id))
    if (data.class_date) form.append('class_date', data.class_date)
    if (data.title?.trim()) form.append('title', data.title.trim())
    if (data.text?.trim()) form.append('text', data.text.trim())
    if (data.file) form.append('file', data.file)
    return request<NoteDetail>('/notes', { method: 'POST', body: form })
  })
}

export function useDeleteNote() {
  return useStudyMutation((id: number) => request<void>(`/notes/${id}`, { method: 'DELETE' }))
}

export function fetchNoteFileUrl(id: number) {
  return request<{ url: string; expires_in: number }>(`/notes/${id}/file`)
}

// --- Preguntas ---------------------------------------------------------------

export function useQuestions(params: { resolved?: boolean; subject_id?: number; limit: number; offset: number }) {
  return useQuery({
    queryKey: ['questions', params],
    queryFn: ({ signal }) => request<Page<Question>>('/questions', { query: params, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useCreateQuestion() {
  return useStudyMutation((data: { text: string; subject_id?: number; scheduled_for?: string }) =>
    request<Question>('/questions', { method: 'POST', body: data }),
  )
}

export function useUpdateQuestion() {
  return useStudyMutation(
    ({ id, ...data }: { id: number; resolved?: boolean; answer?: string | null; subject_id?: number | null; scheduled_for?: string | null }) =>
      request<Question>(`/questions/${id}`, { method: 'PATCH', body: data }),
  )
}

export function useDeleteQuestion() {
  return useStudyMutation((id: number) => request<void>(`/questions/${id}`, { method: 'DELETE' }))
}

// --- Calendario y sincronización --------------------------------------------

export function useCalendarEvents(from: string, to: string) {
  return useQuery({
    queryKey: ['calendar', 'events', from, to],
    queryFn: ({ signal }) => request<CalendarEvent[]>('/calendar/events', { query: { from, to }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useGoogleEvents(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ['google-events', from, to],
    queryFn: ({ signal }) => request<GoogleEvent[]>('/google/events', { query: { from, to }, signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60_000,
    retry: false,
  })
}

export function useCalendarSettings() {
  return useQuery({
    queryKey: ['calendar-settings'],
    queryFn: ({ signal }) => request<CalendarSettings>('/calendar/settings', { signal }),
  })
}

function useSettingsMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['calendar-settings'] }), qc.invalidateQueries({ queryKey: ['google-events'] })]),
  })
}

export function useUpdateCalendarSettings() {
  return useSettingsMutation((data: Partial<Pick<CalendarSettings, 'include_classes' | 'include_tasks' | 'include_questions'>>) =>
    request<CalendarSettings>('/calendar/settings', { method: 'PATCH', body: data }),
  )
}

export function useCreateFeed() {
  return useSettingsMutation(() => request<{ url: string }>('/calendar/feed', { method: 'POST' }))
}

export function useDeleteFeed() {
  return useSettingsMutation(() => request<void>('/calendar/feed', { method: 'DELETE' }))
}

export function downloadIcs() {
  return request<string>('/calendar/export.ics', { responseType: 'text' })
}

export function fetchGoogleAuthUrl() {
  return request<{ url: string }>('/google/auth-url')
}

export function useGoogleCallback() {
  return useSettingsMutation((data: { code: string; state: string }) =>
    request<SyncResult>('/google/callback', { method: 'POST', body: data }),
  )
}

export function useGoogleSync() {
  return useSettingsMutation(() => request<SyncResult>('/google/sync', { method: 'POST' }))
}

export function useGoogleDisconnect() {
  return useSettingsMutation(() => request<void>('/google', { method: 'DELETE' }))
}
