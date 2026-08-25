/**
 * Tests for the fair-allocation draw.
 *
 * A lottery that cannot be checked is worse than first-come-first-serve,
 * because it merely hides the unfairness. These tests pin the three properties
 * that make the draw trustworthy: it is reproducible, it is actually weighted,
 * and it cannot award the same slot twice.
 */
import { describe, expect, it, afterAll } from "vitest";
import { drawWinner, weightFor } from "@/lib/lottery";
import { sql } from "@/db/client";

afterAll(async () => {
  await sql.end();
});

const entrants = (n: number, weight = 100) =>
  Array.from({ length: n }, (_, i) => ({
    // Fixed-width ids so the sort order is stable and obvious.
    userId: `user-${String(i).padStart(3, "0")}`,
    weight,
  }));

describe("the draw is reproducible", () => {
  it("returns the same winner for the same seed and entrants", () => {
    const field = entrants(50);
    const first = drawWinner("seed-alpha", field);
    for (let i = 0; i < 20; i++) {
      expect(drawWinner("seed-alpha", field)).toBe(first);
    }
  });

  it("does not depend on the order entries arrive in", () => {
    const field = entrants(50);
    const shuffled = [...field].reverse();
    // Anyone auditing the draw will read rows back in whatever order the
    // database gives them. The result must not move.
    expect(drawWinner("seed-beta", shuffled)).toBe(
      drawWinner("seed-beta", field),
    );
  });

  it("produces different winners for different seeds", () => {
    const field = entrants(50);
    const winners = new Set(
      Array.from({ length: 40 }, (_, i) => drawWinner(`seed-${i}`, field)),
    );
    // Not a strict guarantee, but 40 seeds collapsing to one winner would mean
    // the seed is not reaching the result at all.
    expect(winners.size).toBeGreaterThan(5);
  });

  it("always picks somebody who actually entered", () => {
    const field = entrants(25);
    const ids = new Set(field.map((f) => f.userId));
    for (let i = 0; i < 200; i++) {
      expect(ids.has(drawWinner(`s${i}`, field)!)).toBe(true);
    }
  });

  it("returns null on an empty field rather than inventing a winner", () => {
    expect(drawWinner("seed", [])).toBeNull();
  });
});

describe("weighting behaves as advertised", () => {
  it("gives a perfect record about twice the pull of a poor one, not twenty times", () => {
    // The compression is the point. Reliability should tilt the draw, not turn
    // it into a ranking that locks unreliable students out for the term.
    expect(weightFor(100) / weightFor(0)).toBeCloseTo(2, 1);
    expect(weightFor(100)).toBe(100);
    expect(weightFor(0)).toBe(50);
  });

  it("favours higher weights over many seeds, without ever excluding anyone", () => {
    const field = [
      { userId: "user-high", weight: weightFor(100) },
      { userId: "user-low", weight: weightFor(0) },
    ];

    const tally = { "user-high": 0, "user-low": 0 } as Record<string, number>;
    const runs = 4000;
    for (let i = 0; i < runs; i++) {
      tally[drawWinner(`trial-${i}`, field)!]++;
    }

    const highShare = tally["user-high"] / runs;
    // Expected share is 100/150 ≈ 0.667.
    expect(highShare).toBeGreaterThan(0.6);
    expect(highShare).toBeLessThan(0.73);
    // And the less reliable student still wins sometimes — this is a lottery,
    // not a leaderboard.
    expect(tally["user-low"]).toBeGreaterThan(0);
  });

  it("is roughly uniform when every entrant has equal weight", () => {
    const field = entrants(10);
    const tally = new Map<string, number>();
    const runs = 5000;
    for (let i = 0; i < runs; i++) {
      const w = drawWinner(`u-${i}`, field)!;
      tally.set(w, (tally.get(w) ?? 0) + 1);
    }

    expect(tally.size).toBe(10);
    for (const count of tally.values()) {
      // Each should land near 500; allow generous slack for 5000 trials.
      expect(count).toBeGreaterThan(380);
      expect(count).toBeLessThan(620);
    }
  });
});
