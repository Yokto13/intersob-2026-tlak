#!/usr/bin/env python3
"""Delete all team data files (*.csv and *.json) from the data/ directory."""

from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

files = sorted(DATA_DIR.glob("*"))
if not files:
    print("data/ is already empty.")
    raise SystemExit(0)

print(f"Files to delete ({len(files)}):")
for f in files:
    print(f"  {f.name}")

answer = input("\nDelete all? [y/N] ").strip().lower()
if answer != "y":
    print("Aborted.")
    raise SystemExit(1)

for f in files:
    f.unlink()

print(f"Deleted {len(files)} file(s).")
