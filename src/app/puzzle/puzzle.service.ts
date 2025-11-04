import { Injectable } from '@angular/core';
import { State, GOAL, getNeighbors, manhattan, euclidean } from './puzzle.model';

export interface SolutionStats {
  timeMs: number;
  nodesExpanded: number;
  maxDepth: number;
}
export interface SolutionResult {
  path: State[] | null;
  stats: SolutionStats;
}

@Injectable({ providedIn: 'root' })
export class PuzzleService {

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
    if (start === GOAL) {
      return { path: [start], stats: { timeMs: performance.now() - t0, nodesExpanded: 0, maxDepth: 0 } };
    }
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

  // --- DFS (iterativa, con visited) ---
  solveDFS(start: State): SolutionResult {
    const t0 = performance.now();
    if (start === GOAL) {
      return { path: [start], stats: { timeMs: performance.now() - t0, nodesExpanded: 0, maxDepth: 0 } };
    }

    const stack: {state: State, depth: number, parent: State | null}[] = [{ state: start, depth: 0, parent: null }];
    const parent = new Map<State, State | null>();
    parent.set(start, null);
    const visited = new Set<State>();

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

      // push neighbors (order arbitrary) - push next with depth+1
      for (const nb of getNeighbors(cur)) {
        if (!visited.has(nb.state)) {
          if (!parent.has(nb.state)) parent.set(nb.state, cur);
          stack.push({ state: nb.state, depth: depth + 1, parent: cur });
        }
      }
    }

    return { path: null, stats: { timeMs: performance.now() - t0, nodesExpanded, maxDepth } };
  }

  // --- IDS (Iterative Deepening Search) ---
  solveIDS(start: State, maxDepthLimit = 50): SolutionResult {
    const t0 = performance.now();
    if (start === GOAL) {
      return { path: [start], stats: { timeMs: performance.now() - t0, nodesExpanded: 0, maxDepth: 0 } };
    }

    let nodesExpandedTotal = 0;
    let reachedMaxDepth = 0;

    const parent = new Map<State, State | null>();

    const dls = (cur: State, depth: number, limit: number, visitedLocal: Set<State>): boolean => {
      nodesExpandedTotal++;
      if (depth > reachedMaxDepth) reachedMaxDepth = depth;
      if (cur === GOAL) return true;
      if (depth === limit) return false;

      const neighbors = getNeighbors(cur);
      for (const nb of neighbors) {
        if (visitedLocal.has(nb.state)) continue;
        visitedLocal.add(nb.state);
        parent.set(nb.state, cur);
        if (dls(nb.state, depth + 1, limit, visitedLocal)) return true;
        visitedLocal.delete(nb.state);
        // parent left as is for successful path only
      }
      return false;
    };

    for (let limit = 0; limit <= maxDepthLimit; limit++) {
      parent.clear();
      parent.set(start, null);
      const visitedLocal = new Set<State>();
      visitedLocal.add(start);
      if (dls(start, 0, limit, visitedLocal)) {
        // find goal in parent map
        // need to locate goal key: reconstruct by searching for GOAL in parent keys
        if (!parent.has(GOAL)) {
          // If parent map doesn't contain GOAL, try reconstruct by following visited: but DLS sets parent when exploring
          // Fallback: attempt to reconstruct by scanning visitedLocal (not ideal), but usually parent has GOAL
        }
        const path = this.reconstruct(GOAL, parent);
        return { path, stats: { timeMs: performance.now() - t0, nodesExpanded: nodesExpandedTotal, maxDepth: reachedMaxDepth } };
      }
    }

    return { path: null, stats: { timeMs: performance.now() - t0, nodesExpanded: nodesExpandedTotal, maxDepth: reachedMaxDepth } };
  }

  // --- A* con scelta euristica ('manhattan'|'euclidean') ---
  solveAStar(start: State, heuristic: 'manhattan'|'euclidean' = 'manhattan'): SolutionResult {
    const t0 = performance.now();
    if (start === GOAL) {
      return { path: [start], stats: { timeMs: performance.now() - t0, nodesExpanded: 0, maxDepth: 0 } };
    }

    const h = (s: State) => heuristic === 'manhattan' ? manhattan(s) : euclidean(s);

    const open = new Set<State>();
    const g = new Map<State, number>();
    const f = new Map<State, number>();
    const parent = new Map<State, State | null>();

    const pq: State[] = [];
    const push = (s: State) => { pq.push(s); pq.sort((a, b) => (f.get(a)! - f.get(b)!)); };

    g.set(start, 0);
    f.set(start, h(start));
    parent.set(start, null);
    open.add(start);
    push(start);

    let nodesExpanded = 0;
    let maxDepth = 0;

    while (pq.length) {
      const cur = pq.shift()!;
      open.delete(cur);
      nodesExpanded++;
      const curG = g.get(cur) ?? 0;
      if (curG > maxDepth) maxDepth = curG;

      if (cur === GOAL) {
        const path = this.reconstruct(cur, parent);
        return { path, stats: { timeMs: performance.now() - t0, nodesExpanded, maxDepth } };
      }

      for (const nb of getNeighbors(cur)) {
        const tentative = curG + 1;
        if (!g.has(nb.state) || tentative < g.get(nb.state)!) {
          parent.set(nb.state, cur);
          g.set(nb.state, tentative);
          f.set(nb.state, tentative + h(nb.state));
          if (!open.has(nb.state)) { open.add(nb.state); push(nb.state); }
        }
      }
    }

    return { path: null, stats: { timeMs: performance.now() - t0, nodesExpanded, maxDepth } };
  }
}
