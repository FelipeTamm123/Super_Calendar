"""Las tareas concretas que hace la IA. Cada una devuelve un modelo Pydantic validado."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.ai.client import Content, FileInput, ask

WEEKDAYS = "0 = lunes, 1 = martes, 2 = miércoles, 3 = jueves, 4 = viernes, 5 = sábado, 6 = domingo"


def _subjects_list(subjects: list[str]) -> str:
    return "\n".join(f"- {s}" for s in subjects) if subjects else "(todavía no hay materias cargadas)"


# ---------------------------------------------------------------------------
# 1. Analizar un apunte de clase
# ---------------------------------------------------------------------------

class ReviewItem(BaseModel):
    title: str = Field(description="Qué repasar, en una frase corta y accionable")
    detail: str = Field(description="Cómo repasarlo o qué mirar puntualmente (1-2 frases)")


class NoteAnalysis(BaseModel):
    subject_name: str = Field(description="Materia del apunte")
    class_date: str | None = Field(description="Fecha de la clase en formato YYYY-MM-DD, o null si no aparece")
    title: str = Field(description="Título breve del tema de la clase")
    transcription: str = Field(description="Transcripción del apunte si vino como imagen o PDF; vacío si vino como texto")
    summary: str = Field(description="Resumen de la clase en 3 a 6 oraciones")
    review_items: list[ReviewItem] = Field(description="Entre 2 y 6 cosas para repasar antes de la próxima clase")
    pending_topics: list[str] = Field(description="Temas que el estudiante todavía no domina o quedaron pendientes")


NOTE_SYSTEM = """Sos un asistente de estudio para un estudiante. Analizás los apuntes de una clase y respondés en español rioplatense.

Tu trabajo:
1. Identificar la materia. Si coincide con una de las materias existentes del estudiante, usá EXACTAMENTE ese nombre. Solo proponé un nombre nuevo si claramente es otra materia.
2. Detectar la fecha de la clase si aparece escrita en el apunte.
3. Si el apunte vino como imagen o PDF, transcribirlo fielmente (texto plano, sin inventar lo que no se lee; marcá [ilegible] donde no se entienda). Si vino como texto, dejá la transcripción vacía.
4. Resumir la clase.
5. Proponer qué repasar antes de la próxima clase: cosas concretas y accionables basadas en el contenido del apunte, no consejos genéricos.
6. Listar temas pendientes: conceptos que el apunte menciona pero no explica, dudas que el estudiante anotó, o temas que se anuncian para la próxima clase. Si no hay, devolvé una lista vacía."""


def analyze_note(
    *,
    subjects: list[str],
    today: date,
    text: str | None = None,
    file: tuple[bytes, str] | None = None,
    subject_hint: str | None = None,
) -> NoteAnalysis:
    context = f"Fecha de hoy: {today.isoformat()}\n\nMaterias existentes del estudiante:\n{_subjects_list(subjects)}"
    if subject_hint:
        context += f"\n\nEl estudiante indicó que el apunte es de la materia: {subject_hint}. Usá ese nombre."
    content: Content = []
    if file:
        content.append(FileInput(*file))
    content.append(context)
    if text:
        content.append(f"<apunte>\n{text}\n</apunte>")
    return ask(NoteAnalysis, system=NOTE_SYSTEM, content=content)


# ---------------------------------------------------------------------------
# 2. Leer el calendario / horario institucional desde una foto
# ---------------------------------------------------------------------------

class ExtractedSession(BaseModel):
    weekday: int = Field(description=f"Día de la semana: {WEEKDAYS}")
    start_time: str = Field(description="Hora de inicio HH:MM (24 h)")
    end_time: str = Field(description="Hora de fin HH:MM (24 h)")
    location: str | None = Field(description="Aula o lugar físico, o null")
    modality: Literal["in_person", "virtual", "unknown"] = Field(
        description="in_person = presencial (aula, sede, edificio), virtual = online (Zoom, Meet, Teams, link, 'virtual', "
        "'remoto', 'online'), unknown = no se indica"
    )
    meeting_url: str | None = Field(description="Link de la videollamada tal como aparece (https://...), o null si no figura")


class ExtractedSubject(BaseModel):
    name: str
    sessions: list[ExtractedSession]


class ExtractedDate(BaseModel):
    date: str = Field(description="Fecha YYYY-MM-DD")
    kind: Literal["exam", "holiday", "deadline", "other"] = Field(
        description="exam = examen/parcial/final, holiday = feriado o día sin clases, deadline = entrega, other = otro"
    )
    title: str
    subject_name: str | None = Field(description="Materia a la que corresponde, o null si es general")


class CalendarExtraction(BaseModel):
    subjects: list[ExtractedSubject]
    important_dates: list[ExtractedDate]
    period_start: str | None = Field(description="Fecha YYYY-MM-DD en que empiezan las clases de este horario (inicio del cuatrimestre/semestre/año), o null si no figura")
    period_end: str | None = Field(description="Fecha YYYY-MM-DD en que terminan las clases de este horario (fin del cuatrimestre/semestre/año), o null si no figura")
    warnings: list[str] = Field(description="Partes dudosas o ilegibles que el estudiante debería revisar")


CALENDAR_SYSTEM = f"""Sos un asistente que lee horarios y calendarios académicos a partir de fotos o PDFs, y respondés en español.

Extraé:
1. Las materias con sus clases semanales (día y horario de cada clase). Días: {WEEKDAYS}. Horarios en formato 24 h HH:MM.
2. Para cada clase, si es presencial o virtual, y el link de la videollamada si aparece.
3. Las fechas importantes que aparezcan: exámenes, parciales, finales, feriados, recesos, entregas.

Reglas:
- No inventes datos. Si algo no se lee bien, no lo incluyas y explicalo en "warnings".
- Modalidad: "virtual" si dice virtual/online/remoto/a distancia o menciona Zoom, Meet, Teams, etc.; "in_person" si indica
  aula, sede, edificio o dice presencial; "unknown" si no hay ninguna pista. Una misma materia puede tener días presenciales
  y días virtuales: decidilo clase por clase.
- Link de videollamada: copialo EXACTAMENTE como aparece. NUNCA inventes ni completes un link. Si se menciona la plataforma
  (por ejemplo "por Zoom") pero el link no figura, dejá meeting_url en null y agregá un aviso en "warnings" para que el
  estudiante lo cargue.
- Si una fecha no tiene año, usá el año que corresponda según la fecha de hoy (el próximo que caiga en o después de hoy).
- Usá los nombres de materia tal como aparecen, pero si coinciden con materias existentes del estudiante, usá el nombre existente.
- Un receso de varios días va como una fecha "holiday" por cada día.
- Vigencia: si el calendario dice cuándo empiezan y terminan las clases (ej: "2º cuatrimestre: 10/08 al 28/11", "inicio de
  clases", "fin de cursada"), ponelo en period_start / period_end. Si no figura, dejalos en null: NO lo adivines.
  Las fechas de exámenes finales posteriores al fin de cursada no cambian el fin de las clases."""


def extract_calendar(*, data: bytes, media_type: str, subjects: list[str], today: date) -> CalendarExtraction:
    content: Content = [
        FileInput(data, media_type),
        f"Fecha de hoy: {today.isoformat()}\n\nMaterias existentes del estudiante:\n{_subjects_list(subjects)}",
    ]
    return ask(CalendarExtraction, system=CALENDAR_SYSTEM, content=content)


# ---------------------------------------------------------------------------
# 3. Clasificar una pregunta al aire
# ---------------------------------------------------------------------------

class QuestionClassification(BaseModel):
    subject_name: str | None = Field(description="Nombre EXACTO de una de las materias existentes, o null si no corresponde a ninguna")


QUESTION_SYSTEM = """Clasificás preguntas rápidas de un estudiante según la materia a la que pertenecen.
Respondé con el nombre EXACTO de una de las materias de la lista. Si la pregunta no corresponde claramente a ninguna, respondé null."""


def classify_question(*, text: str, subjects: list[str]) -> QuestionClassification:
    content: Content = [f"Materias del estudiante:\n{_subjects_list(subjects)}\n\n<pregunta>\n{text}\n</pregunta>"]
    return ask(QuestionClassification, system=QUESTION_SYSTEM, content=content, max_tokens=2000)
