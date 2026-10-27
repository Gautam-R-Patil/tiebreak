import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(40, 'Name is too long'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const optionLabel = z.string().trim().min(1, 'Option cannot be empty').max(80, 'Keep options under 80 characters');

export const settingsSchema = z.object({
  allowNominations: z.boolean().default(true),
  anonymousBallots: z.boolean().default(false),
  liveResults: z.boolean().default(false),
  minBallots: z.number().int().min(0).max(1000).default(0),
});

export const createDecisionSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(90, 'Title is too long'),
  description: z.string().trim().max(600, 'Description is too long').optional().default(''),
  options: z.array(optionLabel).max(30, 'Maximum 30 options').default([]),
  deadline: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
  settings: settingsSchema.default({}),
  startVoting: z.boolean().default(false),
}).superRefine((val, ctx) => {
  const seen = new Set();
  val.options.forEach((o, i) => {
    const k = o.toLowerCase();
    if (seen.has(k)) ctx.addIssue({ code: 'custom', path: ['options', i], message: 'Duplicate option' });
    seen.add(k);
  });
  if (val.startVoting && val.options.length < 2) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least 2 options to start voting right away' });
  }
  if (val.deadline && val.deadline.getTime() < Date.now() + 60_000) {
    ctx.addIssue({ code: 'custom', path: ['deadline'], message: 'Deadline must be in the future' });
  }
});

export const updateDecisionSchema = z.object({
  title: z.string().trim().min(3).max(90).optional(),
  description: z.string().trim().max(600).optional(),
  deadline: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v ? new Date(v) : null)),
  settings: settingsSchema.partial().optional(),
});

export const addOptionSchema = z.object({
  label: optionLabel,
});

export const ballotSchema = z.object({
  ranking: z.array(z.string().min(1)).min(1, 'Rank at least one option').max(30),
});

export const phaseSchema = z.object({
  action: z.enum(['open_voting', 'close', 'reopen_voting']),
});
