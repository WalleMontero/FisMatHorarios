#!/usr/bin/env python3
import argparse
import importlib.util
import json
import os
import sys
from types import ModuleType
from typing import Any


def load_module_from_path(path: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location("merged_data_module", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No pude cargar el módulo desde: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def guess_data_object(module: ModuleType) -> Any:
    if hasattr(module, "MERGED_DATA"):
        return getattr(module, "MERGED_DATA")
    if hasattr(module, "merged_data"):
        return getattr(module, "merged_data")
    if hasattr(module, "DATA"):
        return getattr(module, "DATA")

    for _, value in vars(module).items():
        if isinstance(value, dict) and value:
            first_value = next(iter(value.values()))
            if isinstance(first_value, dict) and ("Secciones" in first_value or "secciones" in first_value):
                return value
    raise RuntimeError(
        "No encontré una variable con los datos. Define `MERGED_DATA = {...}` en merged_data.py."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Exporta merged_data.py a JSON para FastWeb.")
    parser.add_argument(
        "--input",
        default=os.path.join(os.path.dirname(__file__), "..", "data", "merged_data.py"),
        help="Ruta a merged_data.py (default: FastWeb/data/merged_data.py)",
    )
    parser.add_argument(
        "--output",
        default=os.path.join(os.path.dirname(__file__), "..", "data", "merged_data.json"),
        help="Ruta del JSON de salida (default: FastWeb/data/merged_data.json)",
    )
    args = parser.parse_args()

    in_path = os.path.abspath(args.input)
    out_path = os.path.abspath(args.output)

    if not os.path.exists(in_path):
        print(f"ERROR: No existe: {in_path}", file=sys.stderr)
        return 2

    module = load_module_from_path(in_path)
    data = guess_data_object(module)

    if not isinstance(data, dict):
        print("ERROR: Los datos no son un dict.", file=sys.stderr)
        return 2

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"OK: {out_path} ({os.path.getsize(out_path)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

