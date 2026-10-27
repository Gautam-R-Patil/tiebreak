/**
 * Tiebreak voting engine — pure functions, no database access.
 *
 * A ballot is an ordered array of option ids (most preferred first). Partial
 * rankings are allowed: once every option on a ballot has been eliminated the
 * ballot is "exhausted" and stops counting.
 *
 * Instant-runoff voting (IRV):
 *   1. Count each ballot's highest-ranked option that is still active.
 *   2. If an option has a strict majority of the non-exhausted ballots, it wins.
 *   3. Otherwise eliminate the option with the fewest votes and repeat.
 *
 * Elimination tie-break (deterministic, documented in the README):
 *   a. fewest first-choice votes this round
 *   b. lowest Borda score across all ballots
 *   c. fewest ballots mentioning the option at all
 *   d. latest nominated option (last in the option order) is eliminated
 */

export function firstActiveChoice(ballot, active) {
  for (const id of ballot) if (active.has(id)) return id;
  return null;
}

export function bordaScores(optionIds, ballots) {
  const n = optionIds.length;
  const score = Object.fromEntries(optionIds.map((id) => [id, 0]));
  for (const ballot of ballots) {
    ballot.forEach((id, idx) => {
      if (id in score) score[id] += n - idx;
    });
  }
  return score;
}

export function mentionCounts(optionIds, ballots) {
  const count = Object.fromEntries(optionIds.map((id) => [id, 0]));
  for (const ballot of ballots) for (const id of new Set(ballot)) if (id in count) count[id] += 1;
  return count;
}

/** Head-to-head wins matrix: matrix[a][b] = number of ballots preferring a over b. */
export function pairwiseMatrix(optionIds, ballots) {
  const matrix = {};
  for (const a of optionIds) {
    matrix[a] = {};
    for (const b of optionIds) if (a !== b) matrix[a][b] = 0;
  }
  for (const ballot of ballots) {
    const pos = new Map(ballot.map((id, i) => [id, i]));
    for (const a of optionIds) {
      for (const b of optionIds) {
        if (a === b) continue;
        const pa = pos.has(a) ? pos.get(a) : Infinity;
        const pb = pos.has(b) ? pos.get(b) : Infinity;
        if (pa < pb) matrix[a][b] += 1; // ranked a but not b (or a above b)
      }
    }
  }
  return matrix;
}

/** The option that beats every other option head-to-head, or null. */
export function condorcetWinner(optionIds, ballots) {
  if (optionIds.length < 2 || ballots.length === 0) return null;
  const m = pairwiseMatrix(optionIds, ballots);
  for (const a of optionIds) {
    const beatsAll = optionIds.every((b) => a === b || m[a][b] > m[b][a]);
    if (beatsAll) return a;
  }
  return null;
}

export function runInstantRunoff(optionIds, ballots) {
  const order = new Map(optionIds.map((id, i) => [id, i]));
  const validBallots = ballots
    .map((b) => b.filter((id, i, arr) => order.has(id) && arr.indexOf(id) === i))
    .filter((b) => b.length > 0);

  const borda = bordaScores(optionIds, validBallots);
  const mentions = mentionCounts(optionIds, validBallots);

  let active = new Set(optionIds);
  const rounds = [];
  let winner = null;
  let tie = false;

  if (optionIds.length === 0) {
    return { winner: null, rounds, tie: false, totalBallots: validBallots.length };
  }

  for (let safety = 0; safety < optionIds.length + 1; safety += 1) {
    const tallies = Object.fromEntries([...active].map((id) => [id, 0]));
    let exhausted = 0;
    for (const ballot of validBallots) {
      const choice = firstActiveChoice(ballot, active);
      if (choice) tallies[choice] += 1;
      else exhausted += 1;
    }
    const live = validBallots.length - exhausted;
    const round = {
      round: rounds.length + 1,
      tallies,
      exhausted,
      live,
      eliminated: [],
      majority: live > 0 ? Math.floor(live / 2) + 1 : 0,
    };

    const activeIds = [...active];
    const leader = activeIds.reduce((best, id) => (tallies[id] > tallies[best] ? id : best), activeIds[0]);

    if (live > 0 && tallies[leader] >= round.majority) {
      winner = leader;
      round.winner = leader;
      rounds.push(round);
      break;
    }

    if (activeIds.length === 1) {
      winner = activeIds[0];
      round.winner = winner;
      rounds.push(round);
      break;
    }

    if (live === 0) {
      rounds.push(round);
      tie = true;
      break;
    }

    // Choose who to eliminate: lowest tally → lowest Borda → fewest mentions → latest nominated.
    const sorted = [...activeIds].sort((a, b) => {
      if (tallies[a] !== tallies[b]) return tallies[a] - tallies[b];
      if (borda[a] !== borda[b]) return borda[a] - borda[b];
      if (mentions[a] !== mentions[b]) return mentions[a] - mentions[b];
      return order.get(b) - order.get(a);
    });
    const loser = sorted[0];

    // If every remaining option is perfectly tied on all criteria, flag it.
    const allTied = activeIds.every(
      (id) => tallies[id] === tallies[loser] && borda[id] === borda[loser] && mentions[id] === mentions[loser],
    );
    if (allTied && activeIds.length === 2) {
      tie = true;
    }

    round.eliminated = [loser];
    round.tieBreak = tallies[loser] === tallies[sorted[1]]
      ? borda[loser] !== borda[sorted[1]]
        ? 'borda'
        : mentions[loser] !== mentions[sorted[1]]
          ? 'mentions'
          : 'order'
      : null;
    rounds.push(round);
    active.delete(loser);
  }

  return { winner, rounds, tie, totalBallots: validBallots.length, borda, mentions };
}

/** Full results package used by the API and the results page. */
export function computeResults(optionIds, ballots) {
  const irv = runInstantRunoff(optionIds, ballots);
  const condorcet = condorcetWinner(optionIds, ballots);
  const pairwise = pairwiseMatrix(optionIds, ballots);
  const firstChoice = Object.fromEntries(optionIds.map((id) => [id, 0]));
  for (const b of ballots) if (b[0] && b[0] in firstChoice) firstChoice[b[0]] += 1;

  // Final ranking: winner first, then in reverse order of elimination.
  const eliminatedOrder = irv.rounds.flatMap((r) => r.eliminated);
  const finalRanking = [
    ...(irv.winner ? [irv.winner] : []),
    ...optionIds.filter((id) => id !== irv.winner && !eliminatedOrder.includes(id)),
    ...[...eliminatedOrder].reverse(),
  ];

  return {
    method: 'instant-runoff',
    winner: irv.winner,
    tie: irv.tie,
    rounds: irv.rounds,
    totalBallots: irv.totalBallots,
    condorcetWinner: condorcet,
    condorcetAgrees: condorcet ? condorcet === irv.winner : null,
    borda: irv.borda,
    firstChoice,
    pairwise,
    finalRanking,
  };
}
