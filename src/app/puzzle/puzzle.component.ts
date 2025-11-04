import { Component, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { PuzzleService, SolutionResult } from './puzzle/puzzle.service';
import { isSolvable } from './puzzle/puzzle.model';

type Tile = { value: number; pos: number; };

@Component({
  selector: 'app-puzzle',
  templateUrl: './puzzle/puzzle.component.html',
  styleUrls: ['./puzzle/puzzle.component.css']
})
export class PuzzleComponent implements AfterViewInit, OnDestroy {
  @ViewChild('board', { static: true }) boardEl!: ElementRef<HTMLDivElement>;

  start = '123405678';
  algorithm: 'bfs'|'dfs'|'ids'|'astar' = 'astar';
  heuristic: 'manhattan'|'euclidean' = 'manhattan';
  solution: string[] | null = null;
  message = '';
  tiles: Tile[] = [];
  playing = false;
  speedMs = 400;

  // metrics
  lastStats: { timeMs: number; nodesExpanded: number; maxDepth: number } | null = null;

  private timer: any = null;
  private currentStep = 0;

  constructor(private svc: PuzzleService) {
    this.tiles = this.tilesFromState(this.start);
  }

  ngAfterViewInit() {
    // nothing specific for now
  }

  ngOnDestroy() {
    this.stopAnimation();
  }

  // --- solving ---
  solve() {
    this.stopAnimation();
    this.message = '';
    this.lastStats = null;

    if (!isSolvable(this.start)) {
      this.message = 'Configurazione non risolvibile';
      this.solution = null;
      this.tiles = this.tilesFromState(this.start);
      return;
    }

    let result: SolutionResult;
    if (this.algorithm === 'bfs') result = this.svc.solveBFS(this.start);
    else if (this.algorithm === 'dfs') result = this.svc.solveDFS(this.start);
    else if (this.algorithm === 'ids') result = this.svc.solveIDS(this.start, 40);
    else result = this.svc.solveAStar(this.start, this.heuristic);

    this.solution = result.path;
    this.lastStats = result.stats;

    if (!this.solution) this.message = 'Nessuna soluzione trovata';
    else {
      this.message = `Trovata soluzione in ${this.solution.length - 1} mosse`;
      this.tiles = this.tilesFromState(this.solution[0]);
      this.currentStep = 0;
    }
  }

  // --- playback ---
  play() {
    if (!this.solution || this.solution.length === 0) return;
    if (this.playing) return;
    this.playing = true;
    this.currentStep = 0;
    this.tiles = this.tilesFromState(this.solution[0]);
    this.timer = setInterval(() => {
      this.currentStep++;
      if (this.currentStep >= (this.solution?.length ?? 0)) { this.stopAnimation(); return; }
      const state = this.solution![this.currentStep];
      this.updateTiles(state);
    }, this.speedMs);
  }

  pause() { this.stopAnimation(); }
  stepForward() { if (!this.solution) return; this.stopAnimation(); if (this.currentStep < this.solution.length - 1) { this.currentStep++; this.updateTiles(this.solution[this.currentStep]); } }
  stepBack() { if (!this.solution) return; this.stopAnimation(); if (this.currentStep > 0) { this.currentStep--; this.updateTiles(this.solution[this.currentStep]); } }
  resetToStart() { if (!this.solution) return; this.stopAnimation(); this.currentStep = 0; this.updateTiles(this.solution[0]); }

  stopAnimation() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.playing = false;
  }

  // --- tiles helpers ---
  tilesFromState(state: string): Tile[] {
    const res: Tile[] = [];
    for (let pos = 0; pos < 9; pos++) {
      const v = Number(state[pos]);
      if (v !== 0) res.push({ value: v, pos });
    }
    return res;
  }

  updateTiles(state: string) {
    for (const t of this.tiles) {
      const newPos = state.indexOf(String(t.value));
      if (newPos >= 0) t.pos = newPos;
    }
  }

  getTransform(pos: number): string {
    const row = Math.floor(pos / 3);
    const col = pos % 3;
    const tx = (col * 100 / 3);
    const ty = (row * 100 / 3);
    return `translate(${tx}%, ${ty}%)`;
  }
}
