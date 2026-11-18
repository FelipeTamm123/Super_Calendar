"""Base de datos falsa en memoria que imita lo mínimo del cliente de PostgREST (para tests)."""
from types import SimpleNamespace
from typing import Any


class _Query:
    def __init__(self, db: "FakeDB", table: str):
        self.db, self.table, self.filters = db, table, []
        self.mode, self.payload, self.conflict, self._limit = "select", None, None, None

    # --- construcción de la consulta (como postgrest) ---
    def select(self, *_a, **_k):
        self.mode = "select"
        return self

    def insert(self, payload):
        self.mode, self.payload = "insert", payload
        return self

    def upsert(self, payload, on_conflict=""):
        self.mode, self.payload, self.conflict = "upsert", payload, [c.strip() for c in on_conflict.split(",")]
        return self

    def update(self, payload):
        self.mode, self.payload = "update", payload
        return self

    def delete(self):
        self.mode = "delete"
        return self

    def eq(self, col, val):
        self.filters.append(lambda r: str(r.get(col)) == str(val))
        return self

    def gte(self, col, val):
        self.filters.append(lambda r: r.get(col) is not None and str(r.get(col)) >= str(val))
        return self

    def lte(self, col, val):
        self.filters.append(lambda r: r.get(col) is not None and str(r.get(col)) <= str(val))
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, n):
        self._limit = n
        return self

    def _match(self, r):
        return all(f(r) for f in self.filters)

    def execute(self):
        rows = self.db.tables.setdefault(self.table, [])
        if self.mode == "select":
            data = [dict(r) for r in rows if self._match(r)]
            return SimpleNamespace(data=data[: self._limit] if self._limit else data, count=len(data))
        if self.mode == "insert":
            items = self.payload if isinstance(self.payload, list) else [self.payload]
            for it in items:
                it = dict(it)
                it.setdefault("id", len(rows) + 1)
                rows.append(it)
            return SimpleNamespace(data=[dict(i) for i in items])
        if self.mode == "upsert":
            items = self.payload if isinstance(self.payload, list) else [self.payload]
            out = []
            for it in items:
                existing = next((r for r in rows if all(str(r.get(c)) == str(it.get(c)) for c in self.conflict)), None)
                if existing:
                    existing.update(it)
                    out.append(dict(existing))
                else:
                    rows.append(dict(it))
                    out.append(dict(it))
            return SimpleNamespace(data=out)
        if self.mode == "update":
            hit = [r for r in rows if self._match(r)]
            for r in hit:
                r.update(self.payload)
            return SimpleNamespace(data=[dict(r) for r in hit])
        if self.mode == "delete":
            hit = [r for r in rows if self._match(r)]
            self.db.tables[self.table] = [r for r in rows if not self._match(r)]
            return SimpleNamespace(data=hit)
        raise AssertionError(self.mode)


class FakeDB:
    def __init__(self, tables: dict[str, list[dict[str, Any]]] | None = None):
        self.tables = {k: [dict(r) for r in v] for k, v in (tables or {}).items()}

    def table(self, name: str) -> _Query:
        return _Query(self, name)
