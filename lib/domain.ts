import { z } from 'zod';
export const roles = ['admin', 'officer', 'reviewer'] as const;
export type Role = (typeof roles)[number];
export const statuses = [
  'draft',
  'submitted',
  'changes_requested',
  'verified',
  'archived',
] as const;
export type Status = (typeof statuses)[number];
export const statusLabels: Record<Status, string> = {
  draft: 'In progress',
  submitted: 'Awaiting review',
  changes_requested: 'Changes requested',
  verified: 'Evidence verified',
  archived: 'Archived',
};
export const evidenceKinds = ['identity', 'income', 'property', 'photo', 'other'] as const;
export const caseDataSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d ()-]{8,20}$/, 'Enter a valid phone number'),
  location: z.string().trim().min(2).max(180),
  purpose: z.enum(['Home construction', 'Home purchase', 'Home improvement']),
  amount: z.number().int().min(10000).max(100000000),
  income: z.number().int().min(0).max(10000000),
  notes: z.string().max(3000),
  consent: z.boolean(),
  consentAt: z.string().nullable(),
});
export type CaseData = z.infer<typeof caseDataSchema>;
export const visitSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const parsed = new Date(value + 'T00:00:00Z');
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }, 'Enter a valid calendar date'),
  occupancy: z.enum(['Owner occupied', 'Under construction', 'Vacant', 'Other']),
  condition: z.enum(['Good', 'Needs repair', 'Under construction']),
  addressConfirmed: z.boolean(),
  applicantMet: z.boolean(),
  notes: z.string().trim().min(10).max(5000),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
});
export type VisitData = z.infer<typeof visitSchema>;
export type CaseRecord = {
  id: string;
  workspaceId: string;
  ref: string;
  data: CaseData;
  status: Status;
  version: number;
  assignedTo: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  reviewNote: string;
  lastOperation: string | null;
};
export type VisitRecord = VisitData & {
  id: string;
  caseId: string;
  actor: string;
  createdAt: string;
};
export type FileRecord = {
  id: string;
  caseId: string;
  name: string;
  kind: (typeof evidenceKinds)[number];
  mime: string;
  size: number;
  actor: string;
  createdAt: string;
};
export type AuditRecord = {
  id: string;
  caseId: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
};
export type Member = {
  userId: string;
  workspaceId: string;
  email: string;
  name: string;
  role: Role;
};
export type Workspace = { id: string; name: string; createdAt: string };
export type Bootstrap = {
  user: Member;
  workspace: Workspace;
  members: Member[];
  cases: CaseRecord[];
  visits: VisitRecord[];
  files: FileRecord[];
  audit: AuditRecord[];
  aiEnabled: boolean;
};
export const opSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  baseVersion: z.number().int().min(0),
  type: z.enum(['create', 'update', 'visit', 'submit', 'review', 'archive', 'assign', 'upload']),
  payload: z.unknown(),
});
export type Operation = z.infer<typeof opSchema>;
export type QueuedOperation = Operation & {
  scope: string;
  createdAt: string;
  state: 'pending' | 'conflict' | 'failed';
  error?: string;
  server?: CaseRecord;
  blob?: Blob;
  file?: { name: string; kind: (typeof evidenceKinds)[number]; mime: string; size: number };
  attempts: number;
};
export type ChecklistItem = { label: string; complete: boolean };
export function checklist(
  c: CaseRecord,
  visits: VisitRecord[],
  files: FileRecord[],
): ChecklistItem[] {
  return [
    { label: 'Applicant consent recorded', complete: c.data.consent },
    { label: 'Income information recorded', complete: c.data.income > 0 },
    {
      label: 'Identity evidence attached',
      complete: files.some((f) => f.caseId === c.id && f.kind === 'identity'),
    },
    {
      label: 'Income evidence attached',
      complete: files.some((f) => f.caseId === c.id && f.kind === 'income'),
    },
    {
      label: 'Property evidence attached',
      complete: files.some((f) => f.caseId === c.id && f.kind === 'property'),
    },
    {
      label: 'Property photograph attached',
      complete: files.some((f) => f.caseId === c.id && f.kind === 'photo'),
    },
    {
      label: 'Field visit completed',
      complete: visits.some((v) => v.caseId === c.id && v.applicantMet && v.addressConfirmed),
    },
  ];
}
export function canAccess(member: Member, c: CaseRecord) {
  return (
    member.workspaceId === c.workspaceId &&
    (member.role !== 'officer' || c.assignedTo === member.userId)
  );
}
export function transition(
  status: Status,
  action: Operation['type'],
  role: Role,
  note = '',
): Status {
  if (action === 'review') {
    if (role === 'officer') throw new Error('Only reviewers can review evidence.');
    if (status !== 'submitted') throw new Error('Only submitted cases can be reviewed.');
    if (!note.trim()) throw new Error('A review explanation is required.');
    return 'verified';
  }
  if (action === 'submit') {
    if (!['draft', 'changes_requested'].includes(status))
      throw new Error('This case cannot be submitted in its current state.');
    return 'submitted';
  }
  if (action === 'archive') {
    if (role !== 'admin') throw new Error('Only administrators can archive cases.');
    if (status === 'submitted') throw new Error('Complete the review before archiving this case.');
    return 'archived';
  }
  if (action === 'assign') {
    if (role !== 'admin') throw new Error('Only administrators can assign cases.');
    if (status === 'archived') throw new Error('Archived cases cannot be assigned.');
    return status;
  }
  if (!['draft', 'changes_requested'].includes(status))
    throw new Error('Return this case for changes before editing its evidence.');
  if (role === 'reviewer') throw new Error('Reviewers cannot change field evidence.');
  return status;
}
export function formatMoney(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}
export function dateLabel(s: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(
    new Date(s),
  );
}
export function optimisticCases(
  cases: CaseRecord[],
  queue: QueuedOperation[],
  user: Member,
): CaseRecord[] {
  const map = new Map(cases.map((c) => [c.id, { ...c }]));
  for (const op of queue) {
    if (op.type === 'create' && !map.has(op.caseId)) {
      map.set(op.caseId, {
        id: op.caseId,
        workspaceId: user.workspaceId,
        ref: 'FP-' + op.caseId.slice(0, 8).toUpperCase(),
        data: op.payload as CaseData,
        status: 'draft',
        version: 1,
        assignedTo: user.userId,
        createdBy: user.userId,
        createdAt: op.createdAt,
        updatedAt: op.createdAt,
        reviewNote: '',
        lastOperation: op.id,
      });
      continue;
    }
    const c = map.get(op.caseId);
    if (!c) continue;
    if (op.type === 'update') c.data = op.payload as CaseData;
    if (op.type === 'submit') c.status = 'submitted';
    if (op.type === 'archive') c.status = 'archived';
    if (op.type === 'assign') c.assignedTo = (op.payload as { assignedTo: string }).assignedTo;
    if (op.type === 'review') {
      const p = op.payload as { decision: Status; note: string };
      c.status = p.decision;
      c.reviewNote = p.note;
    }
    c.version++;
    c.updatedAt = op.createdAt;
  }
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
