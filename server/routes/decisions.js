import { Router } from 'express';
import mongoose from 'mongoose';
import Decision from '../models/Decision.js';
import Ballot from '../models/Ballot.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import {
  createDecisionSchema,
  updateDecisionSchema,
  addOptionSchema,
  ballotSchema,
  phaseSchema,
} from '../lib/validate.js';
import { computeResults } from '../lib/irv.js';

const router = Router();
router.use(requireAuth);

const MAX_NOMINATIONS_PER_USER = 5;

/** Load a decision by its share code, apply the deadline, and attach viewer flags. */
async function loadDecision(code, user) {
  const decision = await Decision.findOne({ code: code.toUpperCase() }).populate('host', 'name hue');
  if (!decision) throw notFound("We couldn't find a decision with that code.");
  await decision.applyDeadline();
  const userId = user._id.toString();
  const viewer = {
    isHost: decision.host._id.toString() === userId,
    hasJoined: decision.participants.some((p) => p.toString() === userId),
  };
  return { decision, viewer };
}

function canSeeResults(decision, viewer) {
  if (decision.phase === 'closed') return true;
  if (decision.phase === 'voting' && (decision.settings.liveResults || viewer.isHost)) return true;
  return false;
}

async function buildPayload(decision, viewer, user) {
  const userId = user._id.toString();
  const ballot = await Ballot.findOne({ decision: decision._id, voter: user._id });
  return {
    decision: decision.toClient(userId),
    viewer: {
      ...viewer,
      myBallot: ballot ? { ranking: ballot.ranking.map(String), updatedAt: ballot.updatedAt, revision: ballot.revision } : null,
      canSeeResults: canSeeResults(decision, viewer),
    },
  };
}

// ---------- List ----------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const decisions = await Decision.find({ $or: [{ host: userId }, { participants: userId }] })
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('host', 'name hue');

    // Apply deadlines lazily for everything we list.
    await Promise.all(decisions.map((d) => d.applyDeadline()));

    const ids = decisions.map((d) => d._id);
    const myBallots = await Ballot.find({ decision: { $in: ids }, voter: userId }).select('decision');
    const voted = new Set(myBallots.map((b) => b.decision.toString()));

    res.json({
      decisions: decisions.map((d) => ({
        ...d.toClient(userId.toString()),
        viewer: { isHost: d.host._id.equals(userId), hasVoted: voted.has(d._id.toString()) },
      })),
    });
  }),
);

// ---------- Create ----------
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createDecisionSchema.parse(req.body);
    const decision = new Decision({
      title: data.title,
      description: data.description,
      host: req.user._id,
      options: data.options.map((label) => ({ label, addedBy: req.user._id })),
      settings: data.settings,
      deadline: data.deadline,
      participants: [req.user._id],
      phase: data.startVoting ? 'voting' : 'nominating',
      votingOpenedAt: data.startVoting ? new Date() : null,
    });

    // The share code is random; retry on the astronomically rare collision.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await decision.save();
        break;
      } catch (err) {
        if (err.code === 11000 && attempt < 2) decision.code = undefined;
        else throw err;
      }
    }
    await decision.populate('host', 'name hue');
    res.status(201).json(await buildPayload(decision, { isHost: true, hasJoined: true }, req.user));
  }),
);

// ---------- Read ----------
router.get(
  '/:code',
  asyncHandler(async (req, res) => {
    const { decision, viewer } = await loadDecision(req.params.code, req.user);
    const payload = await buildPayload(decision, viewer, req.user);
    if (!decision.settings.anonymousBallots || viewer.isHost) {
      const voters = await Ballot.find({ decision: decision._id }).select('voter updatedAt').populate('voter', 'name hue');
      payload.voters = voters
        .filter((b) => b.voter)
        .map((b) => ({ id: b.voter._id.toString(), name: b.voter.name, hue: b.voter.hue, at: b.updatedAt }));
    }
    const participants = await User.find({ _id: { $in: decision.participants } }).select('name hue');
    payload.participants = participants.map((p) => ({ id: p._id.toString(), name: p.name, hue: p.hue }));
    res.json(payload);
  }),
);

// ---------- Join ----------
router.post(
  '/:code/join',
  asyncHandler(async (req, res) => {
    const { decision, viewer } = await loadDecision(req.params.code, req.user);
    if (!viewer.hasJoined) {
      if (decision.phase === 'closed') throw conflict('This decision is already closed, so new members cannot join.');
      decision.participants.push(req.user._id);
      await decision.save();
      viewer.hasJoined = true;
    }
    res.json(await buildPayload(decision, viewer, req.user));
  }),
);

// ---------- Update (host) ----------
router.patch(
  '/:code',
  asyncHandler(async (req, res) => {
    const { decision, viewer } = await loadDecision(req.params.code, req.user);
    if (!viewer.isHost) throw forbidden('Only the host can edit this decision.');
    if (decision.phase === 'closed') throw conflict('Closed decisions cannot be edited.');
    const data = updateDecisionSchema.parse(req.body);
    if (data.title !== undefined) decision.title = data.title;
    if (data.description !== undefined) decision.description = data.description;
    if (data.deadline !== undefined) {
      if (data.deadline && data.deadline.getTime() < Date.now() + 60_000) {
        throw badRequest('Deadline must be in the future.', { deadline: 'Deadline must be in the future' });
      }
      decision.deadline = data.deadline;
    }
    if (data.settings) Object.assign(decision.settings, data.settings);
    await decision.save();
    res.json(await buildPayload(decision, viewer, req.user));
  }),
);

// ---------- Options ----------
router.post(
  '/:code/options',
  asyncHandler(async (req, res) => {
    const { decision, viewer } = await loadDecision(req.params.code, req.user);
    const { label } = addOptionSchema.parse(req.body);
    if (!viewer.hasJoined) throw forbidden('Join the decision before adding options.');
    if (decision.phase === 'closed') throw conflict('This decision is closed.');
    if (decision.phase === 'voting') throw conflict('Voting has started, so the option list is locked.');
    if (!viewer.isHost && !decision.settings.allowNominations) {
      throw forbidden('The host has turned off nominations for this decision.');
    }
    const mine = decision.options.filter((o) => o.addedBy.equals(req.user._id)).length;
    if (!viewer.isHost && mine >= MAX_NOMINATIONS_PER_USER) {
      throw conflict(`You can nominate up to ${MAX_NOMINATIONS_PER_USER} options.`);
    }
    if (decision.options.length >= 30) throw conflict('This decision already has the maximum of 30 options.');
    if (decision.options.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
      throw conflict('That option is already on the list.');
    }
    decision.options.push({ label, addedBy: req.user._id });
    await decision.save();
    res.status(201).json(await buildPayload(decision, viewer, req.user));
  }),
);

router.delete(
  '/:code/options/:optionId',
  asyncHandler(async (req, res) => {
    const { decision, viewer } = await loadDecision(req.params.code, req.user);
    const option = decision.options.id(req.params.optionId);
    if (!option) throw notFound('That option no longer exists.');
    if (decision.phase !== 'nominating') throw conflict('Options are locked once voting starts.');
    if (!viewer.isHost && !option.addedBy.equals(req.user._id)) {
      throw forbidden('You can only remove options you added.');
    }
    option.deleteOne();
    await decision.save();
    res.json(await buildPayload(decision, viewer, req.user));
  }),
);

// ---------- Phase transitions (host) ----------
router.post(
  '/:code/phase',
  asyncHandler(async (req, res) => {
    const { decision, viewer } = await loadDecision(req.params.code, req.user);
    if (!viewer.isHost) throw forbidden('Only the host can change the phase.');
    const { action } = phaseSchema.parse(req.body);

    if (action === 'open_voting') {
      if (decision.phase !== 'nominating') throw conflict('Voting is already open or the decision is closed.');
      if (decision.options.length < 2) throw conflict('Add at least two options before opening voting.');
      if (decision.deadline && decision.deadline.getTime() <= Date.now()) {
        throw conflict('The deadline has already passed. Extend it before opening voting.');
      }
      decision.phase = 'voting';
      decision.votingOpenedAt = new Date();
    } else if (action === 'close') {
      if (decision.phase !== 'voting') throw conflict('Only an open vote can be closed.');
      decision.phase = 'closed';
      decision.closedAt = new Date();
      decision.closedBy = 'host';
    } else if (action === 'reopen_voting') {
      if (decision.phase !== 'closed') throw conflict('Only a closed decision can be reopened.');
      if (decision.deadline && decision.deadline.getTime() <= Date.now()) decision.deadline = null;
      decision.phase = 'voting';
      decision.closedAt = null;
      decision.closedBy = null;
    }
    await decision.save();
    res.json(await buildPayload(decision, viewer, req.user));
  }),
);

// ---------- Ballots ----------
router.put(
  '/:code/ballot',
  asyncHandler(async (req, res) => {
    const { decision, viewer } = await loadDecision(req.params.code, req.user);
    if (!viewer.hasJoined) throw forbidden('Join the decision before voting.');
    if (decision.phase === 'nominating') throw conflict("Voting hasn't opened yet.");
    if (decision.phase === 'closed') throw conflict('Voting has closed.');

    const { ranking } = ballotSchema.parse(req.body);
    const valid = new Set(decision.options.map((o) => o._id.toString()));
    const unique = [...new Set(ranking)];
    if (unique.length !== ranking.length) throw badRequest('Each option can only appear once in your ranking.');
    if (!ranking.every((id) => valid.has(id))) {
      throw conflict('Your ballot references an option that no longer exists. Refresh and try again.');
    }

    const existing = await Ballot.findOne({ decision: decision._id, voter: req.user._id });
    let ballot;
    if (existing) {
      existing.ranking = ranking.map((id) => new mongoose.Types.ObjectId(id));
      existing.revision += 1;
      ballot = await existing.save();
    } else {
      ballot = await Ballot.create({ decision: decision._id, voter: req.user._id, ranking });
      decision.ballotCount = await Ballot.countDocuments({ decision: decision._id });
      await decision.save();
    }

    res.json({
      ...(await buildPayload(decision, viewer, req.user)),
      ballot: { ranking: ballot.ranking.map(String), updatedAt: ballot.updatedAt, revision: ballot.revision },
    });
  }),
);

router.delete(
  '/:code/ballot',
  asyncHandler(async (req, res) => {
    const { decision, viewer } = await loadDecision(req.params.code, req.user);
    if (decision.phase !== 'voting') throw conflict('Ballots can only be withdrawn while voting is open.');
    const deleted = await Ballot.findOneAndDelete({ decision: decision._id, voter: req.user._id });
    if (!deleted) throw notFound("You haven't submitted a ballot yet.");
    decision.ballotCount = await Ballot.countDocuments({ decision: decision._id });
    await decision.save();
    res.json(await buildPayload(decision, viewer, req.user));
  }),
);

// ---------- Results ----------
router.get(
  '/:code/results',
  asyncHandler(async (req, res) => {
    const { decision, viewer } = await loadDecision(req.params.code, req.user);
    if (!canSeeResults(decision, viewer)) {
      throw forbidden(
        decision.phase === 'nominating'
          ? 'Results will be available once voting opens.'
          : 'The host has hidden results until voting closes.',
      );
    }
    const ballots = await Ballot.find({ decision: decision._id }).populate('voter', 'name hue');
    const optionIds = decision.options.map((o) => o._id.toString());
    const results = computeResults(
      optionIds,
      ballots.map((b) => b.ranking.map(String)),
    );
    const quorumMet = decision.settings.minBallots === 0 || ballots.length >= decision.settings.minBallots;

    const payload = {
      decision: decision.toClient(req.user._id.toString()),
      results: { ...results, quorumMet, minBallots: decision.settings.minBallots, isFinal: decision.phase === 'closed' },
    };
    if (!decision.settings.anonymousBallots) {
      payload.ballots = ballots
        .filter((b) => b.voter)
        .map((b) => ({
          voter: { id: b.voter._id.toString(), name: b.voter.name, hue: b.voter.hue },
          ranking: b.ranking.map(String),
          updatedAt: b.updatedAt,
        }));
    }
    res.json(payload);
  }),
);

// ---------- Delete (host) ----------
router.delete(
  '/:code',
  asyncHandler(async (req, res) => {
    const { decision, viewer } = await loadDecision(req.params.code, req.user);
    if (!viewer.isHost) throw forbidden('Only the host can delete this decision.');
    await Ballot.deleteMany({ decision: decision._id });
    await decision.deleteOne();
    res.json({ ok: true });
  }),
);

export default router;
