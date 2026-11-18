import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { SubjectSelect, TextArea } from '../../components/study'
import { Alert, Button, TextField } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import { useCreateNote, useStatus } from '../../lib/queries'

const MAX_MB = 10
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain'

export function UploadNoteForm() {
  const navigate = useNavigate()
  const { data: status } = useStatus()
  const create = useCreateNote()
  const fileRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [classDate, setClassDate] = useState('')
  const [title, setTitle] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)

  const aiOn = status?.ai_enabled ?? true
  const canSubmit = (text.trim() || file) && (aiOn || subjectId !== '') && !fileError

  const pickFile = (f: File | null) => {
    setFileError(f && f.size > MAX_MB * 1024 * 1024 ? `El archivo supera los ${MAX_MB} MB` : null)
    setFile(f)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    create.mutate(
      { text, file, subject_id: subjectId || undefined, class_date: classDate || undefined, title },
      { onSuccess: (note) => navigate(`/apuntes/${note.id}`, { state: { justCreated: true } }) },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Subir apunte">
      <TextArea
        label="Apunte"
        rows={5}
        maxLength={100000}
        placeholder="Escribí o pegá tus apuntes de la clase… (o subí una foto / PDF abajo)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Foto, PDF o .txt (opcional)</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            {file ? 'Cambiar archivo' : 'Elegir archivo'}
          </Button>
          {file && (
            <>
              <span className="max-w-full truncate text-sm text-zinc-600 dark:text-zinc-400">{file.name}</span>
              <Button
                variant="ghost"
                className="px-2 py-1"
                onClick={() => {
                  pickFile(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                Quitar
              </Button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-label="Archivo del apunte"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {fileError && <p className="text-sm text-red-600 dark:text-red-400">{fileError}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SubjectSelect
          label="Materia"
          value={subjectId}
          onChange={setSubjectId}
          emptyLabel={aiOn ? 'Que la detecte la IA' : 'Elegí una materia'}
        />
        <TextField
          label="Fecha de la clase"
          type="date"
          value={classDate}
          onChange={(e) => setClassDate(e.target.value)}
          hint={aiOn ? 'Vacío: la detecta la IA o usa hoy' : 'Vacío: hoy'}
        />
        <TextField label="Título (opcional)" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
      {create.isPending && (
        <Alert tone="info">La IA está leyendo tu apunte y armando qué repasar… puede tardar hasta un minuto.</Alert>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={create.isPending} disabled={!canSubmit}>
          Guardar apunte
        </Button>
      </div>
    </form>
  )
}
