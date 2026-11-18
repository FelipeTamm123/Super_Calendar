from datetime import datetime, timezone
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app.main import app
from app.shared import security
from app.shared.security import CurrentUser, get_current_user, get_db

USER = CurrentUser(id=uuid4(), email="test@supercalendar.dev", role="authenticated", token="t")
NOW = datetime.now(timezone.utc).isoformat()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def authed(client):
    app.dependency_overrides[get_current_user] = lambda: USER
    app.dependency_overrides[get_db] = lambda: object()
    return client


def question(**kw):
    return {"id": 1, "text": "¿Qué es una derivada?", "subject_id": 3, "subject_name": "Análisis",
            "subject_color": "#10b981", "scheduled_for": "2026-11-18", "resolved": False, "answer": None,
            "created_at": NOW, **kw}


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_status_informa_si_hay_ia(client, monkeypatch):
    from app import main
    monkeypatch.setattr(main, "ai_enabled", lambda: False)
    assert client.get("/api/v1/status").json() == {"ai_enabled": False}


@pytest.mark.parametrize("path", ["/api/v1/agenda", "/api/v1/subjects", "/api/v1/notes", "/api/v1/questions", "/api/v1/schedule"])
def test_sin_token_da_401_problem_json(client, path):
    r = client.get(path)
    assert r.status_code == 401
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json()["status"] == 401


def test_validacion_da_422_con_pointer(authed):
    r = authed.post("/api/v1/questions", json={"text": ""})
    assert r.status_code == 422
    assert r.json()["errors"][0]["pointer"] == "/text"


def test_campos_extra_rechazados(authed):
    r = authed.post("/api/v1/questions", json={"text": "x", "owner_id": str(uuid4())})
    assert r.status_code == 422


def test_limite_maximo_de_paginacion(authed):
    assert authed.get("/api/v1/notes?limit=1000").status_code == 422


def test_crear_pregunta_usa_el_usuario_del_token(authed, monkeypatch):
    from app.modules.questions import service as questions_service
    seen = {}

    def fake_create(db, owner, data):
        seen["owner"], seen["text"] = owner, data.text
        return question(text=data.text)

    monkeypatch.setattr(questions_service, "create_question", fake_create)
    r = authed.post("/api/v1/questions", json={"text": "  ¿Qué es un límite?  "})
    assert r.status_code == 201
    assert seen == {"owner": str(USER.id), "text": "¿Qué es un límite?"}


def test_horario_rechaza_hora_fin_antes_de_inicio(authed):
    body = {"subjects": [{"name": "Física", "sessions": [{"weekday": 0, "start_time": "10:00", "end_time": "09:00"}]}]}
    assert authed.put("/api/v1/schedule", json=body).status_code == 422


def test_horario_rechaza_dia_invalido(authed):
    body = {"subjects": [{"name": "Física", "sessions": [{"weekday": 7, "start_time": "08:00", "end_time": "10:00"}]}]}
    r = authed.put("/api/v1/schedule", json=body)
    assert r.status_code == 422 and "weekday" in r.json()["errors"][0]["pointer"]


def test_apunte_vacio_da_422(authed):
    r = authed.post("/api/v1/notes", data={"text": "   "})
    assert r.status_code == 422


def test_archivo_no_permitido_da_415(authed):
    r = authed.post("/api/v1/notes", files={"file": ("virus.exe", b"MZ\x90\x00\x03\xff\xfe", "image/png")})
    assert r.status_code == 415


def test_importar_calendario_sin_ia_da_503(authed, monkeypatch):
    from app.ai import client as ai_client
    from app.config import get_settings
    from app.modules.schedule import service as schedule_service
    monkeypatch.setattr(get_settings(), "gemini_api_key", None)
    ai_client.get_ai_client.cache_clear()
    monkeypatch.setattr(schedule_service, "list_subjects", lambda db: [])
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 20
    r = authed.post("/api/v1/schedule/import", files={"file": ("cal.png", png, "image/png")})
    assert r.status_code == 503 and "GEMINI_API_KEY" in r.json()["detail"]


# --- Verificación de JWT con una clave ES256 propia (sin red) ---------------

class _FakeJWKS:
    def __init__(self, public_key):
        self.public_key = public_key

    def get_signing_key_from_jwt(self, token):
        return type("K", (), {"key": self.public_key})()


@pytest.fixture
def keys(monkeypatch):
    private = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setattr(security, "get_jwks_client", lambda: _FakeJWKS(private.public_key()))
    return private


def _token(private, **claims):
    base = {"sub": str(USER.id), "aud": "authenticated", "iss": "https://test.supabase.co/auth/v1",
            "exp": int(datetime.now(timezone.utc).timestamp()) + 300, "role": "authenticated"}
    return jwt.encode({**base, **claims}, private, algorithm="ES256")


def test_token_valido(client, keys):
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {_token(keys)}"})
    assert r.status_code == 200 and r.json()["id"] == str(USER.id)


@pytest.mark.parametrize("claims", [{"exp": 1}, {"aud": "otro"}, {"iss": "https://malo.com/auth/v1"}])
def test_token_invalido(client, keys, claims):
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {_token(keys, **claims)}"})
    assert r.status_code == 401


def test_token_con_reloj_levemente_adelantado_se_acepta(client, keys):
    # Regresión: con el reloj de la PC unos segundos atrasado, el iat queda "en el futuro"
    now = int(datetime.now(timezone.utc).timestamp())
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {_token(keys, iat=now + 5, nbf=now + 5)}"})
    assert r.status_code == 200


def test_token_muy_en_el_futuro_se_rechaza(client, keys):
    now = int(datetime.now(timezone.utc).timestamp())
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {_token(keys, iat=now + 600, nbf=now + 600)}"})
    assert r.status_code == 401


def test_token_firmado_con_otra_clave(client, keys):
    other = ec.generate_private_key(ec.SECP256R1())
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {_token(other)}"})
    assert r.status_code == 401


# --- Refresh token en cookie HttpOnly ---------------------------------------

def _fake_session(user_id):
    from app.modules.auth.schemas import SessionOut, UserOut
    out = SessionOut(access_token="acc", expires_in=3600, user=UserOut(id=user_id, email="a@b.com"))
    return out, "refresh-123"


def test_login_pone_refresh_en_cookie_httponly(client, monkeypatch):
    from app.modules.auth import service as auth_service
    monkeypatch.setattr(auth_service, "login", lambda data: _fake_session(USER.id))
    r = client.post("/api/v1/auth/login", json={"email": "a@b.com", "password": "x"})
    assert r.status_code == 200
    assert "refresh_token" not in r.json()
    cookie = r.headers["set-cookie"].lower()
    assert "super_calendar_refresh=refresh-123" in cookie and "httponly" in cookie and "samesite=strict" in cookie


def test_refresh_sin_cookie_da_401(client):
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_refresh_con_cookie_rota_el_token(client, monkeypatch):
    from app.modules.auth import service as auth_service
    seen = {}

    def fake_refresh(token):
        seen["token"] = token
        return _fake_session(USER.id)

    monkeypatch.setattr(auth_service, "refresh", fake_refresh)
    client.cookies.set("super_calendar_refresh", "viejo", path="/api/v1/auth")
    r = client.post("/api/v1/auth/refresh")
    assert r.status_code == 200 and r.json()["access_token"] == "acc"
    assert seen["token"] == "viejo"
    assert "super_calendar_refresh=refresh-123" in r.headers["set-cookie"]


def test_get_db_no_cierra_el_pool_http_compartido():
    # Regresión: usar `with user_db(...)` cerraba el httpx.Client compartido
    from app.db.supabase import get_http_client
    get_db(USER)
    get_db(USER)
    assert not get_http_client().is_closed
