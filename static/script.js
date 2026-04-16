const teamInput = document.getElementById('team');
const statusEl = document.getElementById('status');
const tbody = document.getElementById('rows');
const tableFieldset = document.getElementById('table-fieldset');
const diffValue = document.getElementById('diff-value');
const checkPrisli = document.getElementById('check-prisli');
const checkZmerili = document.getElementById('check-zmerili');
const pointsEl = document.getElementById('points');

const COMPUTED = new Set(['střední']);
const TEXT_COLS = new Set(['poznámka']);
const rowInputs = new WeakMap(); // row object → { colName: HTMLInputElement }

let rows = [];
let saveTimer = null;
let currentDiff = NaN;

function emptyRow() {
    const r = {};
    for (const c of COLUMNS) r[c] = '';
    return r;
}

function rowHasData(r) {
    return COLUMNS.some(c => !COMPUTED.has(c) && String(r[c] ?? '').trim() !== '');
}

function calcRow(row) {
    const sys = parseFloat(row['systolický']);
    const dia = parseFloat(row['diastolický']);
    row['střední'] = (!isNaN(sys) && !isNaN(dia))
        ? String(Math.round((2 * dia + sys) / 3))
        : '';
}

function updateDiff() {
    const vals = rows
        .map(r => parseFloat(r['střední']))
        .filter(v => !isNaN(v) && v > 0);
    if (vals.length >= 2) {
        currentDiff = Math.max(...vals) - Math.min(...vals);
        diffValue.textContent = String(currentDiff);
    } else {
        currentDiff = NaN;
        diffValue.textContent = '—';
    }
    updatePoints();
}

function diffToPoints(diff) {
    if (diff >= 70) return 8;
    if (diff >= 60) return 7;
    if (diff >= 50) return 6;
    if (diff >= 40) return 5;
    if (diff >= 30) return 4;
    if (diff >= 20) return 3;
    if (diff >= 15) return 2;
    if (diff >= 10) return 1;
    return 0;
}

function updatePoints() {
    let pts = 0;
    if (checkPrisli.checked) pts += 1;
    if (checkZmerili.checked) pts += 1;
    if (!isNaN(currentDiff)) pts += diffToPoints(currentDiff);
    pointsEl.textContent = String(pts);
}

function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
}

function updateTableEnabled() {
    tableFieldset.disabled = !teamInput.value;
}

function createRowElement(row) {
    const tr = document.createElement('tr');

    const num = document.createElement('td');
    num.className = 'num';
    tr.appendChild(num);

    const inputs = {};

    for (const c of COLUMNS) {
        const td = document.createElement('td');
        const inp = document.createElement('input');
        if (TEXT_COLS.has(c)) {
            inp.type = 'text';
        } else {
            inp.type = 'number';
            inp.inputMode = 'numeric';
        }
        inp.value = row[c];

        if (COMPUTED.has(c)) {
            inp.readOnly = true;
        } else {
            inp.addEventListener('input', (e) => {
                row[c] = e.target.value;
                calcRow(row);
                const ri = rowInputs.get(row);
                if (ri) {
                    for (const cc of COMPUTED) {
                        if (ri[cc]) ri[cc].value = row[cc];
                    }
                }
                updateDiff();
                ensureTrailingEmptyRow();
                scheduleSave();
            });
        }

        inputs[c] = inp;
        td.appendChild(inp);
        tr.appendChild(td);
    }

    rowInputs.set(row, inputs);

    const actions = document.createElement('td');
    actions.className = 'actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'del';
    btn.textContent = '✕';
    btn.title = 'Smazat řádek';
    btn.addEventListener('click', () => {
        const idx = rows.indexOf(row);
        if (idx === -1) return;
        rows.splice(idx, 1);
        render();
        ensureTrailingEmptyRow();
        scheduleSave();
    });
    actions.appendChild(btn);
    tr.appendChild(actions);

    return tr;
}

function renumber() {
    const cells = tbody.querySelectorAll('td.num');
    cells.forEach((td, i) => { td.textContent = i + 1; });
}

function render() {
    tbody.innerHTML = '';
    for (const row of rows) {
        tbody.appendChild(createRowElement(row));
    }
    renumber();
    updateDiff();
}

function ensureTrailingEmptyRow() {
    if (rows.length === 0 || rowHasData(rows[rows.length - 1])) {
        const row = emptyRow();
        rows.push(row);
        tbody.appendChild(createRowElement(row));
        renumber();
    }
}

function scheduleSave() {
    if (!teamInput.value) {
        setStatus('Zadejte název týmu', 'error');
        return;
    }
    clearTimeout(saveTimer);
    setStatus('Ukládám…', 'pending');
    saveTimer = setTimeout(save, 400);
}

async function save() {
    const team = teamInput.value;
    if (!team) {
        setStatus('Zadejte název týmu', 'error');
        return;
    }
    try {
        const payload = {
            team,
            rows: rows.filter(rowHasData),
            flags: { prisli: checkPrisli.checked, zmerili: checkZmerili.checked },
        };
        const r = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(await r.text());
        setStatus('Uloženo ✓', 'ok');
    } catch (e) {
        console.error(e);
        setStatus('Chyba ukládání', 'error');
    }
}

async function load(team) {
    if (!team) {
        rows = [];
        checkPrisli.checked = false;
        checkZmerili.checked = false;
        render();
        ensureTrailingEmptyRow();
        setStatus('', '');
        return;
    }
    try {
        const r = await fetch('/api/load?team=' + encodeURIComponent(team));
        const data = await r.json();
        rows = (data.rows || []).map(row => { calcRow(row); return row; });
        checkPrisli.checked = !!(data.flags && data.flags.prisli);
        checkZmerili.checked = !!(data.flags && data.flags.zmerili);
        render();
        ensureTrailingEmptyRow();
        setStatus(rows.length > 1 ? 'Načteno' : '', rows.length > 1 ? 'ok' : '');
    } catch (e) {
        console.error(e);
        setStatus('Chyba načítání', 'error');
    }
}

teamInput.addEventListener('change', () => {
    updateTableEnabled();
    load(teamInput.value);
});

checkPrisli.addEventListener('change', () => { updatePoints(); scheduleSave(); });
checkZmerili.addEventListener('change', () => { updatePoints(); scheduleSave(); });

rows = [emptyRow()];
render();
