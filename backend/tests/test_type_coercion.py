"""Tests for services/type_coercion — PC-401 typed-variable coercion."""
import math

import pytest

from services.type_coercion import coerce_value, VariableCoercionError


class TestString:
    def test_passthrough(self):
        assert coerce_value("hello", "string") == "hello"

    def test_stringifies_non_string(self):
        assert coerce_value(13, "string") == "13"
        assert coerce_value(True, "string") == "True"  # str() of a bool; string type never coerces casing

    def test_unknown_type_treated_as_string(self):
        assert coerce_value("x", "path") == "x"
        assert coerce_value("a,b", "list") == "a,b"


class TestBoolean:
    @pytest.mark.parametrize("raw", ["true", "True", "TRUE", " true ", "1", "yes", "YES", "on", True])
    def test_truthy(self, raw):
        assert coerce_value(raw, "boolean") is True

    @pytest.mark.parametrize("raw", ["false", "False", "FALSE", " false ", "0", "no", "NO", "off", False])
    def test_falsy(self, raw):
        assert coerce_value(raw, "boolean") is False

    @pytest.mark.parametrize("raw", ["maybe", "", "2", "tru", "yo"])
    def test_invalid_raises(self, raw):
        with pytest.raises(VariableCoercionError):
            coerce_value(raw, "boolean")

    def test_error_carries_context(self):
        with pytest.raises(VariableCoercionError) as exc:
            coerce_value("maybe", "boolean", var_name="keep")
        err = exc.value
        assert err.var_name == "keep"
        assert err.declared_type == "boolean"
        assert err.raw_value == "maybe"


class TestNumber:
    def test_int(self):
        assert coerce_value("13", "number") == 13

    def test_float_with_trailing_zero_becomes_int(self):
        assert coerce_value("13.0", "number") == 13

    def test_real_float(self):
        assert coerce_value("1.5", "number") == 1.5

    def test_negative(self):
        assert coerce_value("-4", "number") == -4

    def test_whitespace_trimmed(self):
        assert coerce_value(" 7 ", "number") == 7

    def test_passthrough_numeric(self):
        assert coerce_value(13, "number") == 13
        assert coerce_value(1.5, "number") == 1.5

    @pytest.mark.parametrize("raw", ["abc", "", "1,000", "nan", "inf", "-inf"])
    def test_invalid_raises(self, raw):
        with pytest.raises(VariableCoercionError):
            coerce_value(raw, "number")

    def test_bool_is_not_a_number(self):
        # bool is an int subclass in Python; a boolean must not silently become 1/0.
        with pytest.raises(VariableCoercionError):
            coerce_value(True, "number")
