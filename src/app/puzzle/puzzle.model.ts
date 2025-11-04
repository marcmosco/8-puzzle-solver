export type State = string; // es: "123405678", '0' = vuoto

export const GOAL: State = "123456780";

export function isSolvable(state: State): boolean {
  const arr = state.replace("0","").split("").map(Number);
  let inv = 0;
  for (let i = 0; i < arr.length; i++) {
    for (let j = i+1; j < arr.length; j++) {
      if (arr[i] > arr[j]) inv++;
    }
  }
  return inv % 2 === 0;
}

export function getNeighbors(s: State): {state: State, move: string}[] {
  const moves: {[k:number]: number[]} = {
    0: [1,3], 1:[0,2,4], 2:[1,5],
    3:[0,4,6],4:[1,3,5,7],5:[2,4,8],
    6:[3,7],7:[4,6,8],8:[5,7]
  };
  const i = s.indexOf("0");
  const res: {state: State, move: string}[] = [];
  for (const j of moves[i]) {
    const arr = s.split("");
    [arr[i], arr[j]] = [arr[j], arr[i]];
    res.push({state: arr.join(""), move: `${i}->${j}`});
  }
  return res;
}

export function manhattan(s: State): number {
  let sum = 0;
  for (let i=0;i<9;i++){
    const v = Number(s[i]);
    if (v===0) continue;
    const goalPos = v-1;
    sum += Math.abs(Math.floor(i/3)-Math.floor(goalPos/3)) + Math.abs((i%3)-(goalPos%3));
  }
  return sum;
}

export function euclidean(s: State): number {
  let sum = 0;
  for (let i=0;i<9;i++){
    const v = Number(s[i]);
    if (v===0) continue;
    const goalPos = v-1;
    const r1 = Math.floor(i/3), c1 = i%3;
    const r2 = Math.floor(goalPos/3), c2 = goalPos%3;
    sum += Math.hypot(r1 - r2, c1 - c2);
  }
  return sum;
}
