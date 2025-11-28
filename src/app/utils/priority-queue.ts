export class PriorityQueue<T> {
  private heap: T[] = [];
  private idx = new Map<T, number>();

  constructor(private cmp: (a: T, b: T) => number) {}

  size(): number { return this.heap.length; }
  isEmpty(): boolean { return this.heap.length === 0; }
  has(item: T): boolean { return this.idx.has(item); }
  peek(): T | undefined { return this.heap[0]; }

  push(item: T): void {
    if (this.idx.has(item)) { this.update(item); return; }
    const i = this.heap.length;
    this.heap.push(item);
    this.idx.set(item, i);
    this.bubbleUp(i);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const root = this.heap[0];
    const last = this.heap.pop()!;
    this.idx.delete(root);
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.idx.set(last, 0);
      this.bubbleDown(0);
    }
    return root;
  }

  update(item: T): void {
    const i = this.idx.get(item);
    if (i === undefined) return;
    if (!this.bubbleUp(i)) this.bubbleDown(i);
  }

  private swap(i: number, j: number) {
    const hi = this.heap[i], hj = this.heap[j];
    this.heap[i] = hj; this.heap[j] = hi;
    this.idx.set(hj, i); this.idx.set(hi, j);
  }

  private bubbleUp(i: number): boolean {
    let cur = i;
    const item = this.heap[cur];
    while (cur > 0) {
      const p = Math.floor((cur - 1) / 2);
      if (this.cmp(this.heap[p], item) <= 0) break;
      this.swap(cur, p);
      cur = p;
    }
    return cur !== i;
  }

  private bubbleDown(i: number): boolean {
    let cur = i;
    const len = this.heap.length;
    while (true) {
      const l = cur * 2 + 1, r = cur * 2 + 2;
      let best = cur;
      if (l < len && this.cmp(this.heap[l], this.heap[best]) < 0) best = l;
      if (r < len && this.cmp(this.heap[r], this.heap[best]) < 0) best = r;
      if (best === cur) break;
      this.swap(cur, best);
      cur = best;
    }
    return cur !== i;
  }
}
