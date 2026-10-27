import mongoose from 'mongoose';

const ballotSchema = new mongoose.Schema(
  {
    decision: { type: mongoose.Schema.Types.ObjectId, ref: 'Decision', required: true, index: true },
    voter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ranking: { type: [mongoose.Schema.Types.ObjectId], required: true },
    revision: { type: Number, default: 1 },
  },
  { timestamps: true },
);

// One ballot per voter per decision. Re-submitting updates the same document.
ballotSchema.index({ decision: 1, voter: 1 }, { unique: true });

export default mongoose.models.Ballot || mongoose.model('Ballot', ballotSchema);
