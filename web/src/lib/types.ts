/** Tipos que reflejan las respuestas del backend (ver los schemas de FastAPI en /docs). */

export type Page<T> = { items: T[]; total: number; limit: number; offset: number }

export type Subject = { id: number; name: string; color: string; created_at: string }

export type SubjectSummary = Subject & {
  next_class: string | null
  open_questions: number
  pending_topics: number
  pending_tasks: number
}

export type DateKind = 'exam' | 'holiday' | 'deadline' | 'other'

export type Modality = 'in_person' | 'virtual' | 'unknown'

export type ClassSession = {
  id: number
  subject_id: number
  subject_name: string
  subject_color: string
  weekday: number
  start_time: string
  end_time: string
  location: string | null
  modality: Modality
  meeting_url: string | null
}

export type ImportantDate = {
  id: number
  date: string
  kind: DateKind
  title: string
  subject_id: number | null
  subject_name: string | null
}

export type Schedule = {
  sessions: ClassSession[]
  important_dates: ImportantDate[]
  starts_on: string | null
  ends_on: string | null
}

/** Formato para guardar el horario (PUT /schedule) y el borrador que arma la IA. */
export type SessionInput = {
  weekday: number
  start_time: string
  end_time: string
  location: string | null
  modality: Modality
  meeting_url: string | null
}
export type SubjectScheduleInput = { name: string; color?: string | null; sessions: SessionInput[] }
export type ImportantDateInput = { date: string; kind: DateKind; title: string; subject_name: string | null }
export type ScheduleInput = {
  subjects: SubjectScheduleInput[]
  important_dates: ImportantDateInput[]
  /** Vigencia del horario (YYYY-MM-DD). null = sin límite. */
  starts_on: string | null
  ends_on: string | null
}
export type ScheduleDraft = ScheduleInput & { warnings: string[] }

export type StudyTask = {
  id: number
  subject_id: number
  subject_name: string
  subject_color: string
  note_id: number | null
  due_date: string
  title: string
  detail: string | null
  done: boolean
}

export type Question = {
  id: number
  text: string
  subject_id: number | null
  subject_name: string | null
  subject_color: string | null
  scheduled_for: string | null
  resolved: boolean
  answer: string | null
  created_at: string
}

export type NoteListItem = {
  id: number
  subject_id: number
  subject_name: string
  subject_color: string
  class_date: string
  title: string
  summary: string | null
  file_type: string | null
  created_at: string
}

export type NoteDetail = NoteListItem & {
  content: string | null
  tasks: Pick<StudyTask, 'id' | 'title' | 'detail' | 'due_date' | 'done'>[]
  topics: { id: number; topic: string; resolved: boolean }[]
  ai_used: boolean
}

export type Agenda = {
  date: string
  classes: {
    subject_id: number
    subject_name: string
    subject_color: string
    start_time: string
    end_time: string
    location: string | null
    modality: Modality
    meeting_url: string | null
  }[]
  tasks: StudyTask[]
  questions: Question[]
  upcoming: { date: string; kind: DateKind; title: string; subject_name: string | null }[]
}

export type SubjectSheet = {
  subject: Subject
  next_class: string | null
  questions: { id: number; text: string; scheduled_for: string | null; created_at: string }[]
  topics: { id: number; topic: string; note_id: number | null; created_at: string }[]
  tasks: { id: number; title: string; detail: string | null; due_date: string }[]
}

export type CalendarEventKind = 'class' | 'exam' | 'holiday' | 'deadline' | 'other' | 'task' | 'question'

export type CalendarEvent = {
  key: string
  kind: CalendarEventKind
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  subject_name: string | null
  subject_color: string | null
  location: string | null
  meeting_url: string | null
  modality: Modality | null
  description: string | null
  done: boolean
  ref_id: number | null
}

export type GoogleEvent = {
  id: string
  title: string
  date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  location: string | null
  html_link: string | null
}

export type CalendarSettings = {
  feed_active: boolean
  feed_created_at: string | null
  include_classes: boolean
  include_tasks: boolean
  include_questions: boolean
  google: {
    available: boolean
    connected: boolean
    email: string | null
    connected_at: string | null
    last_sync_at: string | null
    last_error: string | null
  }
}

export type SyncResult = { created: number; updated: number; deleted: number; settings: CalendarSettings }
