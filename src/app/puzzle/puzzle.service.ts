// src/app/puzzle/puzzle.service.ts
import { Injectable } from '@angular/core';
import { State, GOAL, getNeighbors, manhattan, euclidean, linearConflict } from './puzzle.model';
import {PriorityQueue} from '../utils/priority-queue';

export interface SolutionStats {
  timeMs: number;
  nodesExpanded: number;
  maxDepth: number;
  // campi diagnostici opzionali
  hCalls?: number;
  maxPqSize?: number;
}
export interface SolutionResult {
  path: State[] | null;
  stats: SolutionStats;
}

@Injectable({ providedIn: 'root' })
export class PuzzleService {

  // ricostruisce il percorso dalla map parent
  private reconstruct(goal: State, parent: Map<State, State | null>): State[] {
    const path: State[] = [];
    let cur: State | null = goal;
    while (cur !== null) {
      path.push(cur);
      cur = parent.get(cur) ?? null;
    }
    return path.reverse();
  }

  // --- BFS ---
  solveBFS(start: State): SolutionResult {
    const t0 = performance.now();
    if (start === GOAL) return { path: [start], stats: { timeMs: performance.now() - t0, nodesExpanded: 0, maxDepth: 0 } };

    const q: State[] = [start];
    const parent = new Map<State, State | null>();
    const g = new Map<State, number>();
    parent.set(start, null);
    g.set(start, 0);

    let nodesExpanded = 0;
    let maxDepth = 0;

    while (q.length) {
      const cur = q.shift()!;
      nodesExpanded++;
      const curDepth = g.get(cur) ?? 0;
      if (curDepth > maxDepth) maxDepth = curDepth;

      for (const nb of getNeighbors(cur)) {
        if (!parent.has(nb.state)) {
          parent.set(nb.state, cur);
          g.set(nb.state, curDepth + 1);
          if (nb.state === GOAL) {
            const path = this.reconstruct(nb.state, parent);
            return { path, stats: { timeMs: performance.now() - t0, nodesExpanded, maxDepth: Math.max(maxDepth, curDepth + 1) } };
          }
          q.push(nb.state);
        }
      }
    }

    return { path: null, stats: { timeMs: performance.now() - t0, nodesExpanded, maxDepth } };
  }

  // --- DFS iterativa (con visited) ---
  solveDFS(start: State, maxDepthLimit = 1000): SolutionResult {
    const t0 = performance.now();
    if (start === GOAL) return { path: [start], stats: { timeMs: performance.now() - t0, nodesExpanded: 0, maxDepth: 0 } };

    const stack: { state: State; depth: number }[] = [{ state: start, depth: 0 }];
    const parent = new Map<State, State | null>();
    const visited = new Set<State>();
    parent.set(start, null);

    let nodesExpanded = 0;
    let maxDepth = 0;

    while (stack.length) {
      const item = stack.pop()!;
      const cur = item.state;
      const depth = item.depth;

      if (visited.has(cur)) continue;
      visited.add(cur);

      nodesExpanded++;
      if (depth > maxDepth) maxDepth = depth;

      if (cur === GOAL) {
        const path = this.reconstruct(cur, parent);
        return { path, stats: { timeMs: performance.now() - t0, nodesExpanded, maxDepth } };
      }

      if (depth >= maxDepthLimit) continue;

      for (const nb of getNeighbors(cur)) {
        if (!visited.has(nb.state)) {
          if (!parent.has(nb.state)) parent.set(nb.state, cur);
          stack.push({ state: nb.state, depth: depth + 1 });
        }
      }
    }

    return { path: null, stats: { timeMs: performance.now() - t0, nodesExpanded, maxDepth } };
  }

  // --- IDS (Iterative Deepening Search) ---
  solveIDS(start: State, maxLimit = 50): SolutionResult {
    const t0 = performance.now();
    if (start === GOAL) return { path: [start], stats: { timeMs: performance.now() - t0, nodesExpanded: 0, maxDepth: 0 } };

    let totalExpanded = 0;
    let reachedDepth = 0;
    const parent = new Map<State, State | null>();

    const dls = (cur: State, depth: number, limit: number, visitedLocal: Set<State>): boolean => {
      totalExpanded++;
      if (depth > reachedDepth) reachedDepth = depth;
      if (cur === GOAL) return true;
      if (depth === limit) return false;
      for (const nb of getNeighbors(cur)) {
        if (visitedLocal.has(nb.state)) continue;
        visitedLocal.add(nb.state);
        parent.set(nb.state, cur);
        if (dls(nb.state, depth + 1, limit, visitedLocal)) return true;
        visitedLocal.delete(nb.state);
      }
      return false;
    };

    for (let limit = 0; limit <= maxLimit; limit++) {
      parent.clear();
      parent.set(start, null);
      const visitedLocal = new Set<State>();
      visitedLocal.add(start);
      if (dls(start, 0, limit, visitedLocal)) {
        const path = this.reconstruct(GOAL, parent);
        return { path, stats: { timeMs: performance.now() - t0, nodesExpanded: totalExpanded, maxDepth: reachedDepth } };
      }
    }

    return { path: null, stats: { timeMs: performance.now() - t0, nodesExpanded: totalExpanded, maxDepth: reachedDepth } };
  }

  // --- A* migliorata (supporta 'manhattan' | 'euclidean' | 'manhattan_lc') ---
  solveAStar(start: State, heuristic: 'manhattan' | 'euclidean' | 'manhattan_lc' = 'manhattan'): SolutionResult {
    const t0 = performance.now();
    if (start === GOAL) {
      return { path: [start], stats: { timeMs: performance.now() - t0, nodesExpanded: 0, maxDepth: 0 } };
    }

    // h memo + counter
    const hCache = new Map<State, number>();
    let hCalls = 0;
    const h = (s: State) => {
      const cached = hCache.get(s);
      if (cached !== undefined) return cached;
      hCalls++;
      let hv: number;
      if (heuristic === 'manhattan') hv = manhattan(s);
      else if (heuristic === 'manhattan_lc') hv = linearConflict(s);
      else hv = euclidean(s);
      hCache.set(s, hv);
      return hv;
    };

    const g = new Map<State, number>();
    const f = new Map<State, number>();
    const parent = new Map<State, State | null>();
    const open = new Set<State>();
    const closed = new Set<State>();

    // comparator: prima f, poi preferisci g maggiore (tie-break)
    const cmp = (a: State, b: State) => {
      const fa = f.get(a) ?? Infinity;
      const fb = f.get(b) ?? Infinity;
      if (fa !== fb) return fa - fb;
      return (g.get(b) ?? 0) - (g.get(a) ?? 0);
    };

    const pq = new PriorityQueue<State>(cmp);

    g.set(start, 0);
    f.set(start, h(start));
    parent.set(start, null);
    open.add(start);
    pq.push(start);

    let nodesExpanded = 0;
    let maxDepth = 0;
    let maxPqSize = 0;

    while (!pq.isEmpty()) {
      const cur = pq.pop()!;
      // ignore if already expanded (closed)
      if (closed.has(cur)) continue;

      // mark expanded
      open.delete(cur);
      closed.add(cur);

      nodesExpanded++;
      const curG = g.get(cur) ?? 0;
      if (curG > maxDepth) maxDepth = curG;

      const nowPq = pq.size();
      if (nowPq > maxPqSize) maxPqSize = nowPq;

      // periodic log for diagnostics (adjust or remove in production)
      if (nodesExpanded % 5000 === 0) {
        console.log(`[A*] pop #${nodesExpanded} cur=${cur} g=${curG} f=${f.get(cur)} pq=${nowPq} hCalls=${hCalls}`);
      }

      if (cur === GOAL) {
        const path = this.reconstruct(cur, parent);
        const timeMs = performance.now() - t0;
        console.log(`[A*] done nodesExpanded=${nodesExpanded} maxDepth=${maxDepth} timeMs=${Math.round(timeMs)}ms hCalls=${hCalls} maxPqSize=${maxPqSize}`);
        return { path, stats: { timeMs, nodesExpanded, maxDepth, hCalls, maxPqSize } as any };
      }

      for (const nb of getNeighbors(cur)) {
        if (closed.has(nb.state)) continue;

        const tentative = curG + 1;
        const prevG = g.get(nb.state);
        if (prevG === undefined || tentative < prevG) {
          parent.set(nb.state, cur);
          g.set(nb.state, tentative);
          f.set(nb.state, tentative + h(nb.state));

          if (!open.has(nb.state)) {
            open.add(nb.state);
            pq.push(nb.state);
          } else {
            pq.update(nb.state);
          }
        }
      }
    }

    const timeMs = performance.now() - t0;
    console.log(`[A*] failed nodesExpanded=${nodesExpanded} timeMs=${Math.round(timeMs)} hCalls=${hCalls} maxPqSize=${maxPqSize}`);
    return { path: null, stats: { timeMs, nodesExpanded, maxDepth, hCalls, maxPqSize } as any };
  }
}
