from datetime import date, time

import pytest

from app.modules.calendar import service as calendar_service
from app.modules.calendar.events import CalendarData
from app.modules.calendar.ics import build_ics
from app.modules.google import client as google
from app.modules.google import sync
from app.shared import crypto
from tests.fakes import FakeDB

A, B = "aaaaaaaa-0000-0000-0000-000000000001", "bbbbbbbb-0000-0000-0000-000000000002"

TABLES = {
    "subjects": [
        {"id": 1, "owner_id": A, "name": "Física", "color": "#3b82f6"},
        {"id": 2, "owner_id": B, "name": "Secreto de B", "color": "#ef4444"},
    ],
    "class_sessions": [
        # Lunes 08-10 presencial, jueves 18-20 virtual con link
        {"id": 1, "owner_id": A, "subject_id": 1, "weekday": 0, "start_time": "08:00:00", "end_time": "10:00:00",
         "location": "Aula 3", "modality": "in_person", "meeting_url": None},
        {"id": 2, "owner_id": A, "subject_id": 1, "weekday": 3, "start_time": "18:00:00", "end_time": "20:00:00",
         "location": None, "modality": "virtual", "meeting_url": "https://meet.google.com/abc-defg-hij"},
        {"id": 3, "owner_id": B, "subject_id": 2, "weekday": 0, "start_time": "08:00:00", "end_time": "10:00:00",
         "location": None, "modality": "unknown", "meeting_url": None},
    ],
    "important_dates": [
        {"id": 1, "owner_id": A, "subject_id": 1, "date": "2026-11-26", "kind": "exam", "title": "Parcial de Física, tema 1"},
        {"id": 2, "owner_id": A, "subject_id": None, "date": "2026-11-23", "kind": "holiday", "title": "Feriado"},
        {"id": 3, "owner_id": B, "subject_id": 2, "date": "2026-11-26", "kind": "exam", "title": "Examen privado de B"},
    ],
    "study_tasks": [
        {"id": 7, "owner_id": A, "subject_id": 1, "due_date": "2026-11-25", "title": "Repasar Newton", "detail": None, "done": False},
    ],
    "questions": [
        {"id": 9, "owner_id": A, "subject_id": 1, "text": "¿Qué es la inercia?", "scheduled_for": "2026-11-25", "resolved": False, "answer": None},
    ],
}

START, END = date(2026, 11, 16), date(2026, 11, 29)


def load(owner=A, **kw):
    return CalendarData.load(FakeDB(TABLES), owner, start=START, end=END, **kw)


# --- Eventos ------------------------------------------------------------------

def test_clases_dia_por_dia_salteando_feriados():
    days = [e.date for e in load().class_occurrences(START, END)]
    assert date(2026, 11, 16) in days  # lunes
    assert date(2026, 11, 19) in days  # jueves
    assert date(2026, 11, 23) not in days  # lunes feriado
    assert date(2026, 11, 26) in days


def test_solo_ve_sus_propios_datos():
    titles = [e.title for e in load().single_events() + load().class_occurrences(START, END)]
    assert "Examen privado de B" not in titles and "Secreto de B" not in titles


def test_keys_estables_entre_cargas():
    assert [e.key for e in load().single_events()] == [e.key for e in load().single_events()]


def test_clase_semanal_arranca_en_la_primera_ocurrencia():
    classes = load().weekly_classes(anchor=date(2026, 11, 18))  # miércoles
    by_day = {e.weekday: e.date for e in classes}
    assert by_day[0] == date(2026, 11, 23) and by_day[3] == date(2026, 11, 19)


# --- .ics ---------------------------------------------------------------------

def test_ics_valido():
    data = load()
    events = data.single_events() + data.weekly_classes(anchor=date(2026, 11, 16))
    ics = build_ics(events, owner_id=A, tz_name="America/Argentina/Buenos_Aires", holidays=data.holidays)
    assert ics.startswith("BEGIN:VCALENDAR\r\n") and ics.endswith("END:VCALENDAR\r\n")
    assert ics.count("BEGIN:VEVENT") == len(events)
    assert "DTSTART;VALUE=DATE:20261126" in ics  # examen de día completo
    assert "Parcial de Física\\, tema 1" in ics  # coma escapada
    assert "RRULE:FREQ=WEEKLY" in ics
    assert "EXDATE;TZID=America/Argentina/Buenos_Aires:20261123T080000" in ics  # feriado salteado
    assert "LOCATION:https://meet.google.com/abc-defg-hij" in ics
    assert "TRIGGER:-PT6H" in ics  # recordatorio del examen
    assert all(len(line.encode()) <= 75 for line in ics.split("\r\n"))


def test_link_publico_solo_muestra_datos_del_dueno(monkeypatch):
    token, token_hash = crypto.new_feed_token()
    db = FakeDB({**TABLES, "calendar_settings": [{"owner_id": A, "feed_token_hash": token_hash, "include_classes": True,
                                                  "include_tasks": True, "include_questions": True}]})
    monkeypatch.setattr(calendar_service, "admin_db", lambda: db)
    monkeypatch.setattr(calendar_service, "today", lambda: date(2026, 11, 18))
    ics = calendar_service.public_feed(token)
    assert "Parcial de Física" in ics and "Repaso: Repasar Newton" in ics
    assert "Examen privado de B" not in ics and "Secreto de B" not in ics


def test_link_publico_con_token_incorrecto_da_404(monkeypatch):
    monkeypatch.setattr(calendar_service, "admin_db", lambda: FakeDB({"calendar_settings": []}))
    with pytest.raises(Exception) as e:
        calendar_service.public_feed("token-que-no-existe-1234567890")
    assert getattr(e.value, "status", None) == 404


# --- Cifrado ------------------------------------------------------------------

def test_cifrado_y_state():
    assert crypto.decrypt(crypto.encrypt("refresh-token")) == "refresh-token"
    assert crypto.decrypt("basura") is None
    state = crypto.sign_state(A)
    assert crypto.verify_state(state, A) and not crypto.verify_state(state, B)
    assert not crypto.verify_state(state + "x", A)


# --- Google -------------------------------------------------------------------

class FakeGoogle:
    """Imita la Calendar API: guarda eventos en memoria."""

    def __init__(self):
        self.events: dict[str, dict] = {}
        self.calls: list[tuple[str, str]] = []
        self.n = 0

    def api(self, method, path, token, json=None, params=None):
        self.calls.append((method, path))
        if path == "/calendars" and method == "POST":
            return {"id": "cal-1"}
        if method == "GET":
            return {"id": "cal-1"}
        event_id = path.rsplit("/", 1)[-1]
        if method == "POST":
            self.n += 1
            self.events[f"ev{self.n}"] = json
            return {"id": f"ev{self.n}"}
        if event_id not in self.events:
            raise google.GoogleApiError(404, "not found")
        if method == "PUT":
            self.events[event_id] = json
            return {"id": event_id}
        if method == "DELETE":
            del self.events[event_id]
            return None


@pytest.fixture
def google_env(monkeypatch):
    fake = FakeGoogle()
    monkeypatch.setattr(google, "api", fake.api)
    monkeypatch.setattr(google, "access_token", lambda refresh: "access")
    monkeypatch.setattr(calendar_service, "today", lambda: date(2026, 11, 18))
    db = FakeDB({**TABLES, "calendar_settings": [{
        "owner_id": A, "include_classes": True, "include_tasks": True, "include_questions": False,
        "google_refresh_token_enc": crypto.encrypt("refresh"), "google_calendar_id": None,
    }], "google_event_links": []})
    return fake, db


def test_sincroniza_crea_actualiza_y_borra(google_env):
    fake, db = google_env
    first = sync.run_sync(db, A)
    # examen + feriado + repaso + 2 clases semanales
    assert first == {"created": 5, "updated": 0, "deleted": 0}
    assert len(fake.events) == 5

    assert sync.run_sync(db, A) == {"created": 0, "updated": 0, "deleted": 0}  # sin cambios, no toca nada

    db.tables["study_tasks"][0]["title"] = "Repasar las 3 leyes"
    assert sync.run_sync(db, A) == {"created": 0, "updated": 1, "deleted": 0}

    db.tables["important_dates"] = [d for d in db.tables["important_dates"] if d["kind"] != "exam" or d["owner_id"] != A]
    assert sync.run_sync(db, A) == {"created": 0, "updated": 0, "deleted": 1}
    assert len(fake.events) == 4
    assert not any("Examen privado de B" in e["summary"] for e in fake.events.values())


def test_si_borraste_el_evento_en_google_se_vuelve_a_crear(google_env):
    fake, db = google_env
    sync.run_sync(db, A)
    fake.events.clear()
    db.tables["study_tasks"][0]["title"] = "Otro título"
    stats = sync.run_sync(db, A)
    assert stats["created"] == 1 and len(fake.events) == 1


def test_clase_virtual_va_con_link_y_recurrencia(google_env):
    fake, db = google_env
    sync.run_sync(db, A)
    virtual = next(e for e in fake.events.values() if "virtual" in e["summary"])
    assert virtual["location"] == "https://meet.google.com/abc-defg-hij"
    assert virtual["recurrence"][0] == "RRULE:FREQ=WEEKLY"
    assert virtual["start"]["dateTime"] == "2026-11-19T18:00:00"
    exam = next(e for e in fake.events.values() if e["summary"].startswith("Parcial"))
    assert exam["start"] == {"date": "2026-11-26"} and exam["reminders"]["overrides"]


def test_token_vencido_desconecta_y_avisa(google_env, monkeypatch):
    _, db = google_env

    def expired(_):
        raise google.GoogleAuthExpired()

    monkeypatch.setattr(google, "access_token", expired)
    with pytest.raises(google.GoogleAuthExpired):
        sync.run_sync(db, A)
    row = db.tables["calendar_settings"][0]
    assert row["google_refresh_token_enc"] is None and "volvé a conectar" in row["google_last_error"]


def test_conectar_rechaza_state_de_otro_usuario(google_env):
    from app.shared.security import CurrentUser
    from uuid import UUID
    _, db = google_env
    user = CurrentUser(id=UUID(A), email=None, role="authenticated", token="t")
    with pytest.raises(Exception) as e:
        sync.connect(db, user, "code", crypto.sign_state(B))
    assert getattr(e.value, "status", None) == 400


def test_eventos_de_google_se_convierten(monkeypatch, google_env):
    _, db = google_env
    monkeypatch.setattr(google, "api", lambda *a, **k: {"items": [
        {"id": "x", "summary": "Dentista", "start": {"dateTime": "2026-11-19T15:00:00-03:00"}, "end": {"dateTime": "2026-11-19T16:00:00-03:00"}},
        {"id": "y", "summary": "Viaje", "start": {"date": "2026-11-20"}, "end": {"date": "2026-11-22"}},
        {"id": "z", "status": "cancelled", "start": {"date": "2026-11-20"}, "end": {"date": "2026-11-21"}},
    ]})
    out = sync.google_events(db, A, START, END)
    assert [e["title"] for e in out] == ["Dentista", "Viaje"]
    assert out[0]["start_time"] == time(15, 0) and out[1]["end_date"] == date(2026, 11, 21)


# --- Vigencia del horario -------------------------------------------------------

def with_period(starts_on, ends_on):
    return FakeDB({**TABLES, "schedule_periods": [{"owner_id": A, "starts_on": starts_on, "ends_on": ends_on}]})


def test_sin_vigencia_las_clases_no_tienen_fin():
    data = load()
    assert all(e.until is None for e in data.weekly_classes(anchor=date(2026, 11, 16)))
    ics = build_ics(data.weekly_classes(anchor=date(2026, 11, 16)), owner_id=A, tz_name="America/Argentina/Buenos_Aires", holidays=set())
    assert "RRULE:FREQ=WEEKLY\r\n" in ics


def test_clases_no_aparecen_fuera_de_la_vigencia():
    data = CalendarData.load(with_period("2026-11-17", "2026-11-25"), A, start=START, end=END)
    days = {e.date for e in data.class_occurrences(START, END)}
    assert date(2026, 11, 16) not in days  # antes de empezar
    assert date(2026, 11, 19) in days
    assert date(2026, 11, 26) not in days  # después de terminar


def test_ics_y_google_cortan_la_repeticion_en_el_fin():
    data = CalendarData.load(with_period(None, "2026-11-28"), A, start=START, end=END)
    weekly = data.weekly_classes(anchor=date(2026, 11, 16))
    ics = build_ics(weekly, owner_id=A, tz_name="America/Argentina/Buenos_Aires", holidays=data.holidays)
    # 28/11 23:59:59 en Argentina (UTC-3) = 29/11 02:59:59 UTC
    assert "RRULE:FREQ=WEEKLY;UNTIL=20261129T025959Z" in ics
    payload = sync.event_payload(weekly[0], data.holidays, "America/Argentina/Buenos_Aires")
    assert payload["recurrence"][0] == "RRULE:FREQ=WEEKLY;UNTIL=20261129T025959Z"


def test_la_clase_semanal_arranca_en_el_inicio_de_la_vigencia():
    data = CalendarData.load(with_period("2027-03-08", "2027-07-03"), A, start=START, end=END)
    by_day = {e.weekday: e.date for e in data.weekly_classes(anchor=date(2026, 11, 16))}
    assert by_day[0] == date(2027, 3, 8) and by_day[3] == date(2027, 3, 11)


def test_horario_terminado_no_se_manda():
    data = CalendarData.load(with_period("2026-03-01", "2026-07-01"), A, start=START, end=END)
    assert data.weekly_classes(anchor=date(2026, 11, 16)) == []
