"""La integración con Gemini se prueba con un cliente simulado: no hay llamadas reales."""
from types import SimpleNamespace

import pytest
from google.genai import errors, types
from pydantic import SecretStr

from app.ai import client as ai_client
from app.ai.tasks import QuestionClassification, analyze_note, classify_question
from app.config import get_settings
from app.shared.errors import AppError


def _response(parsed=None, text="", finish=types.FinishReason.STOP, block_reason=None):
    return SimpleNamespace(
        parsed=parsed,
        text=text,
        candidates=[SimpleNamespace(finish_reason=finish)],
        prompt_feedback=SimpleNamespace(block_reason=block_reason) if block_reason else None,
    )


def _fake_client(monkeypatch, result):
    """result: una respuesta simulada, o una excepción para lanzar."""
    seen = {}

    def generate_content(*, model, contents, config):
        seen.update(model=model, contents=contents, config=config)
        if isinstance(result, Exception):
            raise result
        return result

    fake = SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))
    monkeypatch.setattr(ai_client, "get_ai_client", lambda: fake)
    return seen


def test_clasifica_y_arma_bien_el_pedido(monkeypatch):
    seen = _fake_client(monkeypatch, _response(parsed=QuestionClassification(subject_name="Física")))
    result = classify_question(text="¿Qué es la inercia?", subjects=["Física", "Historia"])
    assert result.subject_name == "Física"

    assert seen["model"] == get_settings().ai_model
    assert seen["config"].response_mime_type == "application/json"
    assert seen["config"].response_schema is QuestionClassification
    assert "Física" in seen["contents"][0].parts[0].text


def test_si_el_sdk_no_parsea_se_valida_el_texto(monkeypatch):
    _fake_client(monkeypatch, _response(parsed=None, text='{"subject_name": null}'))
    assert classify_question(text="x", subjects=["Física"]).subject_name is None


def test_manda_archivos_como_partes(monkeypatch):
    seen = _fake_client(monkeypatch, _response(parsed=None, text='{"subject_name":"Física","class_date":null,"title":"t",'
                                                                 '"transcription":"","summary":"s","review_items":[],"pending_topics":[]}'))
    from datetime import date
    analyze_note(subjects=[], today=date(2026, 11, 18), file=(b"%PDF-1.7", "application/pdf"))
    first = seen["contents"][0].parts[0]
    assert first.inline_data.mime_type == "application/pdf"


def test_contenido_bloqueado_da_422(monkeypatch):
    _fake_client(monkeypatch, _response(finish=types.FinishReason.SAFETY))
    with pytest.raises(AppError) as e:
        classify_question(text="x", subjects=["Física"])
    assert e.value.status == 422


def test_respuesta_cortada_da_422(monkeypatch):
    _fake_client(monkeypatch, _response(finish=types.FinishReason.MAX_TOKENS))
    with pytest.raises(AppError) as e:
        classify_question(text="x", subjects=["Física"])
    assert e.value.status == 422


def test_limite_de_uso_da_429(monkeypatch):
    _fake_client(monkeypatch, errors.ClientError(429, {"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED"}}))
    with pytest.raises(AppError) as e:
        classify_question(text="x", subjects=["Física"])
    assert e.value.status == 429


def test_servidor_saturado_reintenta_y_despues_da_503(monkeypatch):
    monkeypatch.setattr(ai_client, "RETRY_DELAYS", (0, 0))
    seen = _fake_client(monkeypatch, errors.ServerError(503, {"error": {"code": 503, "message": "overloaded", "status": "UNAVAILABLE"}}))
    calls = []
    original = ai_client.get_ai_client().models.generate_content
    ai_client.get_ai_client().models.generate_content = lambda **kw: (calls.append(1), original(**kw))[1]
    with pytest.raises(AppError) as e:
        classify_question(text="x", subjects=["Física"])
    assert e.value.status == 503 and len(calls) == 3  # 1 intento + 2 reintentos
    assert seen["model"]


def test_error_pasajero_se_recupera_con_un_reintento(monkeypatch):
    monkeypatch.setattr(ai_client, "RETRY_DELAYS", (0, 0))
    responses = [errors.ServerError(500, {"error": {"code": 500, "message": "x", "status": "INTERNAL"}}),
                 _response(parsed=QuestionClassification(subject_name="Física"))]

    def generate_content(**kw):
        r = responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r

    monkeypatch.setattr(ai_client, "get_ai_client", lambda: SimpleNamespace(models=SimpleNamespace(generate_content=generate_content)))
    assert classify_question(text="x", subjects=["Física"]).subject_name == "Física"


def test_sin_clave_da_503(monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", None)
    ai_client.get_ai_client.cache_clear()
    with pytest.raises(AppError) as e:
        ai_client.get_ai_client()
    assert e.value.status == 503
    monkeypatch.setattr(get_settings(), "gemini_api_key", SecretStr("x"))
    assert ai_client.ai_enabled()
    ai_client.get_ai_client.cache_clear()
