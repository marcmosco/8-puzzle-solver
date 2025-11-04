import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { PuzzleService, SolutionResult } from './puzzle.service';
import { isSolvable, GOAL } from './puzzle.model';
import {DecimalPipe, NgClass, NgForOf, NgIf, NgStyle} from '@angular/common';
import {FormsModule} from '@angular/forms';

type Tile = { value: number; pos: number; dragging?: boolean; dx?: number; dy?: number; };

@Component({
  selector: 'app-puzzle',
  templateUrl: './puzzle.component.html',
  imports: [
    NgStyle,
    NgClass,
    DecimalPipe,
    FormsModule,
    NgIf,
    NgForOf
  ],
  styleUrls: ['./puzzle.component.css']
})
export class PuzzleComponent implements AfterViewInit, OnDestroy {
  @ViewChild('board', { static: true }) boardEl!: ElementRef<HTMLDivElement>;

  // input / algorithm
  start = '123405678';
  algorithm: 'bfs' | 'dfs' | 'ids' | 'astar' = 'astar';
  heuristic: 'manhattan' | 'euclidean' = 'manhattan';

  // UI / tiles / playback
  tiles: Tile[] = [];
  solution: string[] | null = null;
  playing = false;
  speedMs = 360;
  message = '';
  boardSolved = false;

  // metrics
  lastStats: { timeMs: number; nodesExpanded: number; maxDepth: number } | null = null;

  // internals
  private timer: any = null;
  private currentStep = 0;

  // drag
  private draggingTile: Tile | null = null;
  private startPointer = { x: 0, y: 0 };
  private cellSize = { w: 0, h: 0 };

  constructor(private svc: PuzzleService) {
    this.tiles = this.tilesFromState(this.start);
  }

  ngAfterViewInit() {
    this.computeCellSize();
    window.addEventListener('resize', this.computeCellSizeBound);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.computeCellSizeBound);
    this.stop();
  }

  private computeCellSizeBound = () => this.computeCellSize();
  computeCellSize() {
    if (!this.boardEl) return;
    const rect = this.boardEl.nativeElement.getBoundingClientRect();
    this.cellSize.w = rect.width / 3;
    this.cellSize.h = rect.height / 3;
  }

  // --- solving (uses PuzzleService) ---
  solve() {
    this.stop();
    this.message = '';
    this.lastStats = null;
    this.boardSolved = false;

    if (!isSolvable(this.start)) {
      this.message = 'Configurazione non risolvibile';
      this.tiles = this.tilesFromState(this.start);
      this.solution = null;
      return;
    }

    let result: SolutionResult;
    if (this.algorithm === 'bfs') result = this.svc.solveBFS(this.start);
    else if (this.algorithm === 'dfs') result = this.svc.solveDFS(this.start);
    else if (this.algorithm === 'ids') result = this.svc.solveIDS(this.start, 40);
    else result = this.svc.solveAStar(this.start, this.heuristic);

    this.solution = result.path;
    this.lastStats = result.stats;

    if (!this.solution) {
      this.message = 'Nessuna soluzione trovata';
      this.tiles = this.tilesFromState(this.start);
    } else {
      this.message = `Trovata soluzione in ${this.solution.length - 1} mosse`;
      this.tiles = this.tilesFromState(this.solution[0]);
      this.currentStep = 0;
    }
  }

  // --- playback controls ---
  play() {
    if (!this.solution || this.solution.length === 0) return;
    if (this.playing) return;
    this.playing = true;
    this.currentStep = 0;
    this.tiles = this.tilesFromState(this.solution[0]);
    this.boardSolved = false;
    this.timer = setInterval(() => {
      this.currentStep++;
      if (this.currentStep >= (this.solution?.length ?? 0)) { this.stop(); return; }
      this.updateTiles(this.solution![this.currentStep]);
      if (this.currentStep >= (this.solution!.length - 1)) this.boardSolved = true;
    }, this.speedMs);
  }

  pause() { this.stop(); }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.playing = false;
  }

  stepForward() {
    if (!this.solution) return;
    this.stop();
    if (this.currentStep < this.solution.length - 1) {
      this.currentStep++;
      this.updateTiles(this.solution[this.currentStep]);
      this.boardSolved = this.currentStep >= (this.solution.length - 1);
    }
  }

  stepBack() {
    if (!this.solution) return;
    this.stop();
    if (this.currentStep > 0) {
      this.currentStep--;
      this.updateTiles(this.solution[this.currentStep]);
      this.boardSolved = false;
    }
  }

  resetToStart() {
    if (!this.solution) return;
    this.stop();
    this.currentStep = 0;
    this.updateTiles(this.solution[0]);
    this.boardSolved = false;
  }

  // --- tile helpers and rendering ---
  tilesFromState(state: string): Tile[] {
    const res: Tile[] = [];
    for (let pos = 0; pos < 9; pos++) {
      const v = Number(state[pos]);
      if (v !== 0) res.push({ value: v, pos, dragging: false, dx: 0, dy: 0 });
    }
    return res;
  }

  updateTiles(state: string) {
    for (const t of this.tiles) {
      const newPos = state.indexOf(String(t.value));
      if (newPos >= 0) t.pos = newPos;
      t.dx = 0; t.dy = 0; t.dragging = false;
    }
  }

  getTileStyle(t: Tile) {
    if (t.dragging) {
      const baseX = (t.pos % 3) * this.cellSize.w;
      const baseY = Math.floor(t.pos / 3) * this.cellSize.h;
      const dx = t.dx ?? 0; const dy = t.dy ?? 0;
      return {
        transform: `translate(${baseX + dx}px, ${baseY + dy}px)`,
        transition: 'none',
        zIndex: 40
      } as any;
    } else {
      const row = Math.floor(t.pos / 3); const col = t.pos % 3;
      return {
        transform: `translate(${col * 100}%, ${row * 100}%)`,
        transition: 'transform 320ms cubic-bezier(.22,.9,.25,1)',
        zIndex: 2
      } as any;
    }
  }

  // --- drag handlers (pointer events) ---
  onPointerDown(ev: PointerEvent, tile: Tile) {
    ev.preventDefault();
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    this.computeCellSize();
    this.draggingTile = tile;
    tile.dragging = true;
    tile.dx = 0; tile.dy = 0;
    this.startPointer = { x: ev.clientX, y: ev.clientY };
  }

  onPointerMove(ev: PointerEvent) {
    if (!this.draggingTile) return;
    const dx = ev.clientX - this.startPointer.x;
    const dy = ev.clientY - this.startPointer.y;
    this.draggingTile.dx = dx; this.draggingTile.dy = dy;
  }

  onPointerUp(ev: PointerEvent, tile: Tile) {
    if (!this.draggingTile) return;
    (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId);

    const rect = this.boardEl.nativeElement.getBoundingClientRect();
    const relX = ev.clientX - rect.left;
    const relY = ev.clientY - rect.top;
    const dropCol = Math.min(2, Math.max(0, Math.floor(relX / this.cellSize.w)));
    const dropRow = Math.min(2, Math.max(0, Math.floor(relY / this.cellSize.h)));
    const dropPos = dropRow * 3 + dropCol;

    const curState = this.stateFromTiles();
    const emptyPos = curState.indexOf('0');

    const isAdjacent = (a: number, b: number) => {
      const ra = Math.floor(a / 3), ca = a % 3;
      const rb = Math.floor(b / 3), cb = b % 3;
      return (Math.abs(ra - rb) + Math.abs(ca - cb)) === 1;
    };

    if (dropPos === emptyPos && isAdjacent(tile.pos, emptyPos)) {
      const arr = curState.split('');
      arr[emptyPos] = String(tile.value);
      arr[tile.pos] = '0';
      this.start = arr.join('');
      this.tiles = this.tilesFromState(this.start);
      this.message = 'Mossa manuale eseguita';
    } else {
      tile.dx = 0; tile.dy = 0; tile.dragging = false;
    }

    this.draggingTile = null;
  }

  stateFromTiles(): string {
    const arr = new Array(9).fill('0');
    for (const t of this.tiles) arr[t.pos] = String(t.value);
    const built = arr.join('');
    if (!built.includes('0')) return this.start;
    return built;
  }
}
