import csv
import json
import re
import unicodedata
from pathlib import Path

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

COLUMNS = ["systolický", "diastolický", "střední", "poznámka"]

TEAMS = [
    "BigB's",
    "Bořiči v Krytu",
    "DELTA FORCE",
    "dementní ksíčkaři",
    "int(e) = r/S*o+0b",
    "MAMA",
    "Martinkova Kryptografická Četa vol. III",
    "Mňamáci III",
    "Morek Dvorek",
    "Olomoucká delegace",
    "Prestižní Górale!",
    "RZT - RoZjedeme To",
    "Śmigus-dyngus",
    "Sob Ota",
    "sp3",
    "Squadra Porcellino al Jaguaro Mozzarell Pažitkini",
    "Stodola pumpa",
    "Strážničtí draci",
    "Škrabaňi",
    "Teče nám do bot",
    "Ti, kteří neví",
    "Úhlopříčky a Vašek",
]


def slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s


def team_path(team: str) -> Path | None:
    slug = slugify(team)
    if not slug:
        return None
    return DATA_DIR / f"{slug}.csv"


@app.get("/")
def index():
    return render_template("index.html", columns=COLUMNS, teams=TEAMS)


@app.post("/api/save")
def save():
    payload = request.get_json(force=True) or {}
    team = (payload.get("team") or "").strip()
    rows = payload.get("rows") or []
    flags = payload.get("flags") or {}

    path = team_path(team)
    if path is None:
        return jsonify({"error": "Chybí název týmu"}), 400

    tmp = path.with_suffix(".csv.tmp")
    with tmp.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["tým", *COLUMNS])
        for row in rows:
            if not any((str(row.get(c) or "")).strip() for c in COLUMNS):
                continue
            w.writerow([team, *(row.get(c, "") for c in COLUMNS)])
    tmp.replace(path)

    json_path = path.with_suffix(".json")
    tmp_json = json_path.with_suffix(".json.tmp")
    tmp_json.write_text(
        json.dumps({
            "prisli": bool(flags.get("prisli")),
            "zmerili": bool(flags.get("zmerili")),
        }),
        encoding="utf-8",
    )
    tmp_json.replace(json_path)

    return jsonify({"ok": True, "file": path.name})


@app.get("/api/load")
def load():
    team = (request.args.get("team") or "").strip()
    path = team_path(team)
    empty_flags = {"prisli": False, "zmerili": False}
    if path is None or not path.exists():
        return jsonify({"rows": [], "flags": empty_flags})

    rows = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            rows.append({c: row.get(c, "") for c in COLUMNS})

    flags = empty_flags
    json_path = path.with_suffix(".json")
    if json_path.exists():
        flags = json.loads(json_path.read_text(encoding="utf-8"))

    return jsonify({"rows": rows, "flags": flags})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
