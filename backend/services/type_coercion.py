"""
PC-401 — typed-variable coercion.

A single pure function turns a raw value + declared type into a typed value, or
raises VariableCoercionError. Kept separate from workflow_runner so it has one
responsibility and is exhaustively table-testable. resolve_variable still returns
str; this is the opt-in layer that nodes call when they need a real bool/number.

Accept-lists are intentionally lenient but well-defined (see PC-401 spec §4) and
MUST stay in parity with the frontend mirror in frontend/lib/workflow/coerce.ts.
"""
import math
from typing import Any

VariableType = str  # 'string' | 'number' | 'boolean' (others treated as string)

_BOOL_TRUE = {"true", "1", "yes", "on"}
_BOOL_FALSE = {"false", "0", "no", "off"}


class VariableCoercionError(ValueError):
    """A value could not be coerced to its declared type.

    Carries enough context for a per-model error message like
    `variable 'depth' (number): can't parse "abc"`.
    """

    def __init__(self, var_name: str, declared_type: str, raw_value: Any):
        self.var_name = var_name
        self.declared_type = declared_type
        self.raw_value = raw_value
        name_part = f" '{var_name}'" if var_name else ""
        super().__init__(
            f"variable{name_part} ({declared_type}): can't parse {raw_value!r}"
        )


def coerce_value(raw: Any, declared_type: str, *, var_name: str = "") -> Any:
    """Coerce ``raw`` to ``declared_type`` (string/number/boolean).

    Unknown types are treated as 'string' (forward-compatible with a future
    path/list). Raises VariableCoercionError on an uncoercible value.
    """
    if declared_type == "boolean":
        return _coerce_bool(raw, var_name)
    if declared_type == "number":
        return _coerce_number(raw, var_name)
    # 'string' and any unrecognised type
    return str(raw)


def _coerce_bool(raw: Any, var_name: str) -> bool:
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        # Only the canonical 0/1 are meaningful; defer to the string table.
        raw = str(int(raw)) if float(raw).is_integer() else str(raw)
    text = str(raw).strip().lower()
    if text in _BOOL_TRUE:
        return True
    if text in _BOOL_FALSE:
        return False
    raise VariableCoercionError(var_name, "boolean", raw)


def _coerce_number(raw: Any, var_name: str):
    # bool is an int subclass — reject it explicitly so True/False can't become 1/0.
    if isinstance(raw, bool):
        raise VariableCoercionError(var_name, "number", raw)
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        if math.isnan(raw) or math.isinf(raw):
            raise VariableCoercionError(var_name, "number", raw)
        return int(raw) if raw.is_integer() else raw
    text = str(raw).strip()
    try:
        f = float(text)
    except (ValueError, OverflowError):
        raise VariableCoercionError(var_name, "number", raw)
    if math.isnan(f) or math.isinf(f):
        raise VariableCoercionError(var_name, "number", raw)
    return int(f) if f.is_integer() else f
