from datetime import date

import pytest
from pydantic import ValidationError

from app.modules.schedule.schemas import SessionIn
from app.modules.schedule.service import _clean_meeting_url
from app.shared.study_calendar import next_class_date, review_date
from app.shared.uploads import _sniff

MON, WED = 0, 2


def test_proxima_clase_es_estrictamente_posterior():
    # 2026-11-16 es lunes
    assert next_class_date({MON, WED}, date(2026, 11, 16)) == date(2026, 11, 18)


def test_proxima_clase_saltea_feriados():
    assert next_class_date({WED}, date(2026, 11, 16), {date(2026, 11, 18)}) == date(2026, 11, 25)


def test_sin_horario_no_hay_proxima_clase():
    assert next_class_date(set(), date(2026, 11, 16)) is None


def test_repaso_el_dia_anterior_a_la_clase():
    assert review_date(date(2026, 11, 20), today_=date(2026, 11, 17)) == date(2026, 11, 19)


def test_repaso_nunca_antes_de_hoy():
    assert review_date(date(2026, 11, 18), today_=date(2026, 11, 18)) == date(2026, 11, 18)


def test_repaso_sin_horario_es_manana():
    assert review_date(None, today_=date(2026, 11, 17)) == date(2026, 11, 18)


def test_detecta_tipos_por_contenido():
    assert _sniff(b"%PDF-1.7 ...") == "application/pdf"
    assert _sniff(b"\x89PNG\r\n\x1a\n....") == "image/png"
    assert _sniff(b"\xff\xd8\xff\xe0....") == "image/jpeg"
    assert _sniff(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp"
    assert _sniff("apunte de clase: derivadas".encode()) == "text/plain"
    assert _sniff(b"\x00\xff\xfe\x80\x81") is None


# --- Modalidad y link de videollamada ---------------------------------------

def _session(**kw):
    return SessionIn(weekday=0, start_time="08:00", end_time="10:00", **kw)


def test_link_valido_marca_la_clase_como_virtual():
    s = _session(meeting_url="https://meet.google.com/abc-defg-hij")
    assert s.modality == "virtual"


def test_presencial_por_defecto_es_desconocido():
    assert _session().modality == "unknown"


@pytest.mark.parametrize("bad", ["javascript:alert(1)", "ftp://x.com", "meet google com", "https://"])
def test_link_invalido_se_rechaza(bad):
    with pytest.raises(ValidationError):
        _session(meeting_url=bad)


@pytest.mark.parametrize(
    ("raw", "clean"),
    [
        ("https://zoom.us/j/123456?pwd=abc", "https://zoom.us/j/123456?pwd=abc"),
        ("zoom.us/j/123456", "https://zoom.us/j/123456"),
        ("meet.google.com/abc-defg-hij.", "https://meet.google.com/abc-defg-hij"),
        ("javascript:alert(1)", None),
        ("por Zoom", None),
        (None, None),
    ],
)
def test_limpia_links_leidos_por_la_ia(raw, clean):
    assert _clean_meeting_url(raw) == clean


# --- Vigencia -----------------------------------------------------------------

def test_no_hay_proxima_clase_despues_del_fin():
    from app.shared.study_calendar import Period
    period = Period(ends_on=date(2026, 11, 18))
    assert next_class_date({MON, WED}, date(2026, 11, 16), period=period) == date(2026, 11, 18)
    assert next_class_date({MON, WED}, date(2026, 11, 18), period=period) is None


def test_horario_rechaza_fin_antes_del_inicio():
    from app.modules.schedule.schemas import ScheduleIn
    with pytest.raises(ValidationError):
        ScheduleIn(subjects=[], starts_on=date(2026, 12, 1), ends_on=date(2026, 11, 1))
    assert ScheduleIn(subjects=[], ends_on=date(2026, 12, 1)).starts_on is None
