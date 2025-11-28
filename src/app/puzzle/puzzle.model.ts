// src/app/puzzle/puzzle.model.ts

export type State = string; // es: "123405678", '0' = vuoto
export const GOAL: State = "123456780";

/*
  Precomputed coordinates per indice per evitare calcoli ripetuti.
  POS[i] = [row, col] per l'indice lineare i (0..8)
*/
const POS: [number, number][] = [
  [0, 0], [0, 1], [0, 2],
  [1, 0], [1, 1], [1, 2],
  [2, 0], [2, 1], [2, 2],
];

/* ---------- Validazione semplice dello stato ---------- */
export function isValidState(state: State): boolean {
  if (!state || state.length !== 9) return false;
  const seen = new Array<boolean>(9).fill(false);
  for (let i = 0; i < 9; i++) {
    const c = state.charCodeAt(i) - 48;
    if (c < 0 || c > 8) return false;
    if (seen[c]) return false;
    seen[c] = true;
  }
  return true;
}

/* ---------- isSolvable: parità delle inversioni (3x3) ---------- */
export function isSolvable(state: State): boolean {
  if (!isValidState(state)) return false;
  // rimuovo lo zero e conto inversioni
  const arr: number[] = [];
  for (let i = 0; i < 9; i++) {
    const v = state.charCodeAt(i) - 48;
    if (v !== 0) arr.push(v);
  }
  let inversions = 0;
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] > arr[j]) inversions++;
    }
  }
  return (inversions % 2) === 0;
}

/* ---------- getNeighbors: stati ottenuti scambiando lo zero ---------- */
export function getNeighbors(s: State): { state: State; move: string }[] {
  // adiacenze per indice 0..8 su griglia 3x3
  const moves: { [k: number]: number[] } = {
    0: [1, 3], 1: [0, 2, 4], 2: [1, 5],
    3: [0, 4, 6], 4: [1, 3, 5, 7], 5: [2, 4, 8],
    6: [3, 7], 7: [4, 6, 8], 8: [5, 7]
  };

  const i = s.indexOf('0');
  if (i < 0) return [];
  const res: { state: State; move: string }[] = [];
  const arr = s.split(''); // piccolo overhead ma chiaro; si può ottimizzare se necessario

  for (const j of moves[i] || []) {
    // swap arr[i] e arr[j]
    const copy = arr.slice();
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
    res.push({ state: copy.join(''), move: `${i}->${j}` });
  }
  return res;
}

/* ---------- Manhattan heuristic (ottimizzata) ---------- */
export function manhattan(s: State): number {
  // assume s.length === 9 e contiene '0'..'8'
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const ch = s.charCodeAt(i) - 48;
    if (ch === 0) continue;
    const goalIdx = ch - 1;
    const dr = Math.abs(POS[i][0] - POS[goalIdx][0]);
    const dc = Math.abs(POS[i][1] - POS[goalIdx][1]);
    sum += dr + dc;
  }
  return sum;
}

/* ---------- Euclidean heuristic (meno comune per 8-puzzle) ---------- */
export function euclidean(s: State): number {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const ch = s.charCodeAt(i) - 48;
    if (ch === 0) continue;
    const goalIdx = ch - 1;
    const dr = POS[i][0] - POS[goalIdx][0];
    const dc = POS[i][1] - POS[goalIdx][1];
    sum += Math.hypot(dr, dc);
  }
  return sum;
}

/* ---------- Linear Conflict (Manhattan + linear conflicts) ----------
   Restituisce manhattan + 2 * #conflicti lineari.
   E' ancora ammissibile e migliora notevolmente A* per 8-puzzle.
*/
export function linearConflict(s: State): number {
  // base manhattan
  const man = manhattan(s);
  let conflicts = 0;

  // Rows: controlla coppie nella stessa riga il cui goal è nella stessa riga
  for (let r = 0; r < 3; r++) {
    // raccogli tiles nella riga che hanno goalRow == r
    const tilesInRow: { val: number; goalCol: number; col: number }[] = [];
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const v = s.charCodeAt(idx) - 48;
      if (v === 0) continue;
      const goalIdx = v - 1;
      const goalR = Math.floor(goalIdx / 3);
      const goalC = goalIdx % 3;
      if (goalR === r) tilesInRow.push({ val: v, goalCol: goalC, col: c });
    }
    // conta inversioni tra goalCol
    for (let i = 0; i < tilesInRow.length; i++) {
      for (let j = i + 1; j < tilesInRow.length; j++) {
        if (tilesInRow[i].goalCol > tilesInRow[j].goalCol) conflicts++;
      }
    }
  }

  // Columns: analogamente per colonne
  for (let c = 0; c < 3; c++) {
    const tilesInCol: { val: number; goalRow: number; row: number }[] = [];
    for (let r = 0; r < 3; r++) {
      const idx = r * 3 + c;
      const v = s.charCodeAt(idx) - 48;
      if (v === 0) continue;
      const goalIdx = v - 1;
      const goalR = Math.floor(goalIdx / 3);
      const goalC = goalIdx % 3;
      if (goalC === c) tilesInCol.push({ val: v, goalRow: goalR, row: r });
    }
    for (let i = 0; i < tilesInCol.length; i++) {
      for (let j = i + 1; j < tilesInCol.length; j++) {
        if (tilesInCol[i].goalRow > tilesInCol[j].goalRow) conflicts++;
      }
    }
  }

  // ogni conflitto lineare aggiunge 2 al valore euristico
  return man + 2 * conflicts;
}
