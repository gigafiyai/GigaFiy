// Call-compliance attestation. AI-voice calls are subject to the TCPA (the FCC
// treats AI/cloned voices as "artificial" voices requiring the called party's
// consent). We don't block calling, but we require the artist to attest a
// lawful basis each time they initiate calls, and we record it for audit.

import { prisma } from "@gigify/db";

export const CALL_ATTESTATION =
  "I confirm I have a lawful basis to place these calls — e.g. the venue's published booking line, a contact who has replied or expressed interest, or prior consent. I understand AI-voice calls are subject to the TCPA and that I am responsible for compliance.";

// Records the artist's attestation timestamp (audit trail).
export async function recordCallAck(artistId: string): Promise<void> {
  await prisma.artist.update({ where: { id: artistId }, data: { callComplianceAckAt: new Date() } });
}

// Standard 403 body when a call action arrives without the attestation.
export const ACK_REQUIRED = {
  error: "compliance_ack_required",
  attestation: CALL_ATTESTATION,
} as const;
