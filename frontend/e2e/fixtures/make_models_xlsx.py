"""Generate the deterministic Excel fixture used by the Playwright golden-path E2E.

Run from anywhere with the repo's system Python (openpyxl is a backend dep):

    python frontend/e2e/fixtures/make_models_xlsx.py

The sheet has a header row ("Model") followed by two model names. Both the
frontend parser (`lib/workflow/excelPreview.ts`) and the backend reader
(`services/workflow_runner.py::_read_model_names_from_excel`) drop a physical
row 0 when it matches a known header (`filename/name/model/model_name/model name`),
so the run yields exactly two models -> two `.chain` files. Keeping a real header
means the E2E also proves the header-skip parity locked in PC-704, not just the
happy path. Regenerate only if the expected models in golden-path.spec.ts change.
"""

from pathlib import Path

from openpyxl import Workbook

MODELS = ["E2E-Alpha", "E2E-Bravo"]
OUT = Path(__file__).with_name("e2e-models.xlsx")


def main() -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Models"
    ws.append(["Model"])  # header row — skipped by both parsers
    for name in MODELS:
        ws.append([name])
    wb.save(OUT)
    print(f"wrote {OUT} with header 'Model' + {len(MODELS)} models: {MODELS}")


if __name__ == "__main__":
    main()
