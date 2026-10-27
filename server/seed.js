/**
 * Seeds a demo account and a few decisions so evaluators can explore the app
 * without creating data from scratch.  Safe to re-run: it wipes only the demo
 * user's data.
 *
 *   npm run seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from './lib/db.js';
import User from './models/User.js';
import Decision from './models/Decision.js';
import Ballot from './models/Ballot.js';

const DEMO = { name: 'Demo Host', email: 'demo@tiebreak.app', password: 'demo1234' };
const FRIENDS = ['Aarav', 'Mia', 'Kenji', 'Zara', 'Leo', 'Priya', 'Noah'];

async function upsertUser(name, email, password, hue) {
  const passwordHash = await bcrypt.hash(password, 10);
  return User.findOneAndUpdate(
    { email },
    { name, email, passwordHash, hue },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function main() {
  await connectDB();
  const host = await upsertUser(DEMO.name, DEMO.email, DEMO.password, 265);
  const friends = [];
  for (const [i, name] of FRIENDS.entries()) {
    friends.push(await upsertUser(name, `${name.toLowerCase()}@tiebreak.app`, 'friend1234', (i * 47) % 360));
  }

  const old = await Decision.find({ host: host._id }).select('_id');
  await Ballot.deleteMany({ decision: { $in: old.map((d) => d._id) } });
  await Decision.deleteMany({ host: host._id });

  // 1. Closed decision with a juicy multi-round result.
  const trip = await Decision.create({
    code: 'DEMO01',
    title: 'Where should the team offsite be?',
    description: 'Five days, late November. Budget is roughly the same for every option.',
    host: host._id,
    phase: 'closed',
    closedAt: new Date(Date.now() - 36e5),
    closedBy: 'host',
    votingOpenedAt: new Date(Date.now() - 864e5 * 2),
    settings: { allowNominations: true, anonymousBallots: false, liveResults: false, minBallots: 5 },
    options: ['Goa', 'Manali', 'Jaipur', 'Pondicherry', 'Rishikesh'].map((label, i) => ({
      label,
      addedBy: i < 3 ? host._id : friends[i % friends.length]._id,
    })),
    participants: [host._id, ...friends.map((f) => f._id)],
  });
  const o = Object.fromEntries(trip.options.map((x) => [x.label, x._id]));
  const tripBallots = [
    [host, ['Goa', 'Pondicherry', 'Jaipur']],
    [friends[0], ['Manali', 'Rishikesh', 'Jaipur', 'Goa']],
    [friends[1], ['Rishikesh', 'Manali', 'Goa']],
    [friends[2], ['Jaipur', 'Goa', 'Pondicherry']],
    [friends[3], ['Goa', 'Pondicherry']],
    [friends[4], ['Pondicherry', 'Goa', 'Jaipur', 'Manali']],
    [friends[5], ['Manali', 'Rishikesh']],
    [friends[6], ['Jaipur', 'Manali', 'Goa']],
  ];
  await Ballot.insertMany(
    tripBallots.map(([u, r]) => ({ decision: trip._id, voter: u._id, ranking: r.map((l) => o[l]) })),
  );
  trip.ballotCount = tripBallots.length;
  await trip.save();

  // 2. Live voting with a deadline tomorrow and live results on.
  const movie = await Decision.create({
    code: 'DEMO02',
    title: 'Friday movie night 🍿',
    description: 'Pick the film. Ranked so nobody gets stuck with a spoiler vote.',
    host: host._id,
    phase: 'voting',
    votingOpenedAt: new Date(),
    deadline: new Date(Date.now() + 864e5),
    settings: { allowNominations: true, anonymousBallots: true, liveResults: true, minBallots: 0 },
    options: ['Dune: Part Two', 'Everything Everywhere All at Once', 'Spirited Away', 'The Grand Budapest Hotel'].map(
      (label) => ({ label, addedBy: host._id }),
    ),
    participants: [host._id, ...friends.slice(0, 4).map((f) => f._id)],
  });
  const m = Object.fromEntries(movie.options.map((x) => [x.label, x._id]));
  const movieBallots = [
    [friends[0], ['Spirited Away', 'Dune: Part Two']],
    [friends[1], ['Dune: Part Two', 'The Grand Budapest Hotel', 'Spirited Away']],
    [friends[2], ['Everything Everywhere All at Once', 'Spirited Away']],
  ];
  await Ballot.insertMany(
    movieBallots.map(([u, r]) => ({ decision: movie._id, voter: u._id, ranking: r.map((l) => m[l]) })),
  );
  movie.ballotCount = movieBallots.length;
  await movie.save();

  // 3. Still collecting nominations.
  await Decision.create({
    code: 'DEMO03',
    title: 'Name for the hackathon project',
    description: 'Drop your best names. Voting opens once we have a handful.',
    host: host._id,
    phase: 'nominating',
    settings: { allowNominations: true, anonymousBallots: false, liveResults: false, minBallots: 0 },
    options: ['Nimbus', 'Forge'].map((label) => ({ label, addedBy: host._id })),
    participants: [host._id, friends[0]._id, friends[1]._id],
  });

  console.log('Seeded demo data.');
  console.log(`  Sign in as ${DEMO.email} / ${DEMO.password}`);
  console.log('  Decision codes: DEMO01 (closed), DEMO02 (voting), DEMO03 (nominating)');
  await disconnectDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
