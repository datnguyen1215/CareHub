/** Call status values representing the lifecycle of a WebRTC call */
export type CallStatus =
  | 'initiating'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'failed'

/** Reasons why a call ended */
export type CallEndReason =
  | 'completed'
  | 'declined'
  | 'missed'
  | 'cancelled'
  | 'failed'
  | 'timeout'

/** A call session record matching the database schema */
export interface CallSession {
  id: string
  callerUserId: string
  calleeDeviceId: string
  calleeProfileId: string | null
  status: CallStatus
  initiatedAt: string
  answeredAt: string | null
  endedAt: string | null
  endReason: CallEndReason | null
  durationSeconds: number | null
  iceConnectionState: string | null
}

/** ICE candidate for peer connection establishment */
export interface IceCandidate {
  candidate: string
  sdpMid: string | null
  sdpMLineIndex: number | null
}

/** Caller information displayed on kiosk during incoming call */
export interface CallParticipant {
  userId: string
  name: string
  avatarUrl: string | null
}
