import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

// Unambiguous alphabet: no 0/O or 1/I so codes are easy to read aloud.
const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export const PHASES = ['nominating', 'voting', 'closed'];

const optionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const decisionSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true, default: () => makeCode() },
    title: { type: String, required: true, trim: true, maxlength: 90 },
    description: { type: String, trim: true, maxlength: 600, default: '' },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phase: { type: String, enum: PHASES, default: 'nominating' },
    options: { type: [optionSchema], default: [] },
    settings: {
      allowNominations: { type: Boolean, default: true },
      anonymousBallots: { type: Boolean, default: false },
      liveResults: { type: Boolean, default: false },
      minBallots: { type: Number, default: 0, min: 0 },
    },
    deadline: { type: Date, default: null },
    votingOpenedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    closedBy: { type: String, enum: ['host', 'deadline', null], default: null },
    participants: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [], index: true },
    ballotCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/**
 * Deadlines are enforced lazily: whenever a decision is loaded we check whether
 * its deadline has passed and close it. This avoids needing a cron job, which
 * serverless hosting does not give us for free.
 */
decisionSchema.methods.applyDeadline = async function applyDeadline() {
  if (this.phase === 'voting' && this.deadline && this.deadline.getTime() <= Date.now()) {
    this.phase = 'closed';
    this.closedAt = this.deadline;
    this.closedBy = 'deadline';
    await this.save();
    return true;
  }
  return false;
};

decisionSchema.methods.toClient = function toClient(viewerId) {
  const host = this.populated('host') ? this.host : null;
  return {
    id: this._id.toString(),
    code: this.code,
    title: this.title,
    description: this.description,
    phase: this.phase,
    host: host
      ? { id: host._id.toString(), name: host.name, hue: host.hue }
      : { id: this.host.toString() },
    options: this.options.map((o) => ({
      id: o._id.toString(),
      label: o.label,
      addedBy: o.addedBy.toString(),
      mine: viewerId ? o.addedBy.toString() === viewerId : false,
      createdAt: o.createdAt,
    })),
    settings: this.settings,
    deadline: this.deadline,
    votingOpenedAt: this.votingOpenedAt,
    closedAt: this.closedAt,
    closedBy: this.closedBy,
    participantCount: this.participants.length,
    ballotCount: this.ballotCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.models.Decision || mongoose.model('Decision', decisionSchema);
