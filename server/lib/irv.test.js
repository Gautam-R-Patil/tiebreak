import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInstantRunoff, condorcetWinner, computeResults, pairwiseMatrix } from './irv.js';

const OPTS = ['sushi', 'pizza', 'tacos'];

test('majority in the first round wins immediately', () => {
  const ballots = [['pizza', 'sushi'], ['pizza'], ['sushi', 'pizza']];
  const r = runInstantRunoff(OPTS, ballots);
  assert.equal(r.winner, 'pizza');
  assert.equal(r.rounds.length, 1);
});

test('eliminates the lowest option and transfers votes', () => {
  // tacos has 1 first choice, gets eliminated, its vote flows to sushi.
  const ballots = [
    ['sushi', 'pizza'],
    ['sushi', 'tacos'],
    ['pizza', 'sushi'],
    ['pizza', 'tacos'],
    ['tacos', 'sushi'],
  ];
  const r = runInstantRunoff(OPTS, ballots);
  assert.equal(r.rounds.length, 2);
  assert.deepEqual(r.rounds[0].eliminated, ['tacos']);
  assert.equal(r.winner, 'sushi');
  assert.equal(r.rounds[1].tallies.sushi, 3);
});

test('partial ballots become exhausted', () => {
  const ballots = [['tacos'], ['sushi', 'pizza'], ['pizza', 'sushi'], ['pizza']];
  const r = runInstantRunoff(OPTS, ballots);
  assert.equal(r.winner, 'pizza');
  const last = r.rounds[r.rounds.length - 1];
  assert.equal(last.exhausted, 1);
});

test('ignores unknown and duplicate option ids', () => {
  const ballots = [['pizza', 'pizza', 'ghost'], ['pizza']];
  const r = runInstantRunoff(OPTS, ballots);
  assert.equal(r.winner, 'pizza');
  assert.equal(r.totalBallots, 2);
});

test('breaks elimination ties with Borda score', () => {
  // sushi and tacos tie on first choices (1 each); pizza leads with 2.
  // tacos is ranked higher on more ballots, so sushi is eliminated.
  const ballots = [['pizza', 'tacos', 'sushi'], ['pizza', 'tacos'], ['sushi', 'tacos'], ['tacos', 'pizza']];
  const r = runInstantRunoff(OPTS, ballots);
  assert.deepEqual(r.rounds[0].eliminated, ['sushi']);
  assert.equal(r.rounds[0].tieBreak, 'borda');
});

test('flags a perfect tie', () => {
  const r = runInstantRunoff(['a', 'b'], [['a'], ['b']]);
  assert.equal(r.tie, true);
});

test('empty inputs are handled', () => {
  assert.equal(runInstantRunoff([], []).winner, null);
  assert.equal(runInstantRunoff(OPTS, []).winner, null);
  assert.equal(condorcetWinner(OPTS, []), null);
});

test('condorcet winner can differ from IRV winner', () => {
  // Classic centre-squeeze: "centre" is everyone's second choice.
  const opts = ['left', 'centre', 'right'];
  const ballots = [
    ...Array(4).fill(['left', 'centre', 'right']),
    ...Array(3).fill(['centre', 'left', 'right']),
    ...Array(5).fill(['right', 'centre', 'left']),
  ];
  const res = computeResults(opts, ballots);
  assert.equal(res.condorcetWinner, 'centre');
  assert.equal(res.winner, 'left');
  assert.equal(res.condorcetAgrees, false);
  assert.deepEqual(res.finalRanking, ['left', 'right', 'centre']);
});

test('pairwise matrix counts preferences including unranked options', () => {
  const m = pairwiseMatrix(['a', 'b'], [['a'], ['b', 'a'], ['a', 'b']]);
  assert.equal(m.a.b, 2);
  assert.equal(m.b.a, 1);
});
