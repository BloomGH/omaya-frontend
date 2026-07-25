export type Severity = 'crisis' | 'elevated' | 'monitor' | 'routine' | 'inactive';

// Whether the current escalation rung's clinician SMS page was delivered.
// Only "blocked" (an open L4 whose page was never delivered) surfaces in the UI.
export type PageStatus = 'paged' | 'blocked' | 'pending' | 'not_applicable';

export type CallStatus = 'completed' | 'in_progress' | 'upcoming' | 'missed';

export type DeliveryType = 'vaginal' | 'caesarean';
export type ConsentStatus = 'active' | 'withdrawn' | 'pending';

export interface EmergencyContact {
  name: string;
  phone: string;        // E.164, e.g. "+233564357975"
  relationship: string; // free-text label (never the literal "other")
}

export interface CheckIn {
  id: string;
  date: string;          // "03 Jun"
  day: number;           // day postpartum
  summary: string;       // one sentence summary
  severity: Severity;
  transcript?: string;   // transcript text if available
}

export interface Mother {
  id: string;
  name: string;
  phone: string;
  hospital: string;
  midwife: string;
  severity: Severity;
  consentStatus: ConsentStatus;
  consentRecording?: boolean;
  lastInteraction: string;
  note: string;
  currentFlag?: string;
  nextCallAt?: string; // ISO datetime of the soonest upcoming scheduled call
  checkIns: CheckIn[];
  // discharge info
  deliveryType: DeliveryType;
  deliveryDate?: string;
  dischargeDate: string;
  dayPostpartum: number;
  // clinical
  dateOfBirth?: string;
  gravida?: number;
  para?: number;
  language?: string;
  medications?: string[];
  risks?: string[];
  preferredCallWindow?: "morning" | "afternoon" | "evening" | "inbound";
  // 1–3 emergency contacts (index 0 = primary). Empty for older records.
  emergencyContacts?: EmergencyContact[];
  // DEPRECATED singular mirrors of emergencyContacts[0] — fallback for old data.
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
}

export interface CallTranscriptRow {
  speaker: 'omaya' | 'mother';
  text: string;
}

export interface Call {
  id: string;
  motherId: string;
  motherName: string;
  callType: string;
  status: CallStatus;
  scheduledAt: string;
  durationSeconds?: number;
  dayInCare?: number;
  deliveryType?: string;
  flagsRaised?: number;
  severity?: Severity;
  summary?: string;
  transcript?: CallTranscriptRow[];
  audioUrl?: string;
}

export interface EscalationItem {
  id: string;
  // Originating call — stable across the provisional→real-alert transition, so
  // the chime keys on this (not `id`, which changes when a provisional reconciles).
  callId: string;
  motherName: string;
  dayPostpartum: number;
  severity: Severity;
  timeLeftMinutes: number;
  createdAt: string;
  // Delivery state of the on-call clinician's SMS page for this escalation.
  pageStatus: PageStatus;
}

export type StaffRole = string;

export type StaffStatus = "active" | "invited" | "suspended";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  lastActiveAt: string | null;
  isCurrentUser?: boolean;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
  hospitalId: string;
  hospitalName: string;
  mustChangePassword: boolean;
  permissions: RolePermissions;
}

export interface RolePermissions {
  view_mothers: boolean;
  message_mothers: boolean;
  escalate: boolean;
  create_discharges: boolean;
  manage_staff: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: RolePermissions;
}
