"""Generador de archivos .ics (RFC 5545), el formato estándar de calendarios.

Sirve para Google Calendar, Apple Calendar y Outlook. Escrito a mano (es texto simple)
para no sumar dependencias.
"""
import hashlib
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.modules.calendar.events import KIND_LABEL, CalEvent

PRODID = "-//Super Calendar//ES"


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n")


def _fold(line: str) -> str:
    """Las líneas no pueden superar 75 bytes: se cortan y continúan con un espacio."""
    raw = line.encode()
    if len(raw) <= 75:
        return line
    parts, current = [], b""
    for ch in line:
        b = ch.encode()
        if len(current) + len(b) > (75 if not parts else 74):
            parts.append(current.decode())
            current = b""
        current += b
    parts.append(current.decode())
    return "\r\n ".join(parts)


def _fmt_date(d: date) -> str:
    return d.strftime("%Y%m%d")


def _fmt_local(d: date, t) -> str:
    return f"{_fmt_date(d)}T{t.strftime('%H%M%S')}"


def _vtimezone(tz_name: str) -> list[str]:
    """Zona horaria simple (offset actual, sin horario de verano). Alcanza para Argentina (UTC-3 fijo)."""
    offset = datetime.now(ZoneInfo(tz_name)).utcoffset() or timedelta(0)
    minutes = int(offset.total_seconds() // 60)
    sign = "+" if minutes >= 0 else "-"
    hh, mm = divmod(abs(minutes), 60)
    tzoff = f"{sign}{hh:02d}{mm:02d}"
    return [
        "BEGIN:VTIMEZONE",
        f"TZID:{tz_name}",
        "BEGIN:STANDARD",
        "DTSTART:19700101T000000",
        f"TZOFFSETFROM:{tzoff}",
        f"TZOFFSETTO:{tzoff}",
        "END:STANDARD",
        "END:VTIMEZONE",
    ]


def weekly_rule(e: CalEvent, tz_name: str) -> str:
    """RRULE semanal. Con fin de vigencia lleva UNTIL (en UTC, como pide el estándar cuando DTSTART tiene zona)."""
    if e.until is None:
        return "FREQ=WEEKLY"
    last = datetime.combine(e.until, time(23, 59, 59), ZoneInfo(tz_name)).astimezone(UTC)
    return f"FREQ=WEEKLY;UNTIL={last:%Y%m%dT%H%M%SZ}"


def uid_for(owner_id: str, key: str) -> str:
    return f"{hashlib.sha1(f'{owner_id}:{key}'.encode()).hexdigest()}@supercalendar"


def summary_for(e: CalEvent) -> str:
    if e.kind == "class":
        return f"Clase de {e.title}" + (" (virtual)" if e.modality == "virtual" else "")
    if e.kind == "task":
        return f"Repaso: {e.title}"
    if e.kind == "question":
        return f"Pregunta: {e.title}"
    return e.title


def description_for(e: CalEvent) -> str:
    lines = [KIND_LABEL.get(e.kind, "")]
    if e.subject_name and e.kind != "class":
        lines.append(f"Materia: {e.subject_name}")
    if e.meeting_url:
        lines.append(f"Link de la clase: {e.meeting_url}")
    if e.description:
        lines.append(e.description)
    lines.append("Creado por Super Calendar")
    return "\n".join(x for x in lines if x)


def build_ics(events: list[CalEvent], *, owner_id: str, tz_name: str, holidays: set[date], name: str = "Super Calendar") -> str:
    now = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape(name)}",
        f"X-WR-TIMEZONE:{tz_name}",
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
        "X-PUBLISHED-TTL:PT1H",
        *_vtimezone(tz_name),
    ]
    for e in events:
        lines += ["BEGIN:VEVENT", f"UID:{uid_for(owner_id, e.key)}", f"DTSTAMP:{now}"]
        if e.all_day:
            lines += [f"DTSTART;VALUE=DATE:{_fmt_date(e.date)}", f"DTEND;VALUE=DATE:{_fmt_date(e.date + timedelta(days=1))}"]
        else:
            lines += [
                f"DTSTART;TZID={tz_name}:{_fmt_local(e.date, e.start_time)}",
                f"DTEND;TZID={tz_name}:{_fmt_local(e.date, e.end_time or e.start_time)}",
            ]
        if e.weekday is not None:  # clase semanal: se repite hasta el fin de la vigencia, salteando feriados
            lines.append(f"RRULE:{weekly_rule(e, tz_name)}")
            for h in sorted(holidays):
                if h.weekday() == e.weekday and h >= e.date and (e.until is None or h <= e.until):
                    lines.append(f"EXDATE;TZID={tz_name}:{_fmt_local(h, e.start_time)}")
        lines.append(f"SUMMARY:{_escape(summary_for(e))}")
        lines.append(f"DESCRIPTION:{_escape(description_for(e))}")
        location = e.meeting_url if e.modality == "virtual" and e.meeting_url else e.location
        if location:
            lines.append(f"LOCATION:{_escape(location)}")
        if e.meeting_url:
            lines.append(f"URL:{e.meeting_url}")
        if e.kind in ("holiday",):
            lines.append("TRANSP:TRANSPARENT")
        if e.kind == "exam":  # recordatorios: el día anterior a las 18 h y 3 días antes
            for trigger in ("-PT6H", "-P2DT6H"):
                lines += ["BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{_escape(e.title)}", f"TRIGGER:{trigger}", "END:VALARM"]
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"
