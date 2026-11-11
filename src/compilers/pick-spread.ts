/**
 * `k` indices spread over `n` items: round(i * (n - 1) / (k - 1)) for i from 0 to k - 1, without
 * repeats, ascending. `k` of 1 gives index 0. No items or no picks give none.
 */
export function pickSpread(n: number, k: number): number[] {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n <= 0 || k <= 0) return [];
  const picked: number[] = [];
  for (let i = 0; i < k; i++) {
    const index = k === 1 ? 0 : Math.round((i * (n - 1)) / (k - 1));
    if (!picked.includes(index)) picked.push(index);
  }
  return picked;
}
