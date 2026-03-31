import type { CallEndReason, CallParticipant, IceCandidate } from './types.js'

/** Portal initiates a call to a device */
export interface CallInitiateMessage {
  type: 'call:initiate'
  callId: string
  deviceId: string
  profileId: string | null
}

/** Backend notifies device of an incoming call */
export interface CallIncomingMessage {
  type: 'call:incoming'
  callId: string
  caller: CallParticipant
  profileId: string | null
}

/** Device accepts the incoming call */
export interface CallAcceptedMessage {
  type: 'call:accepted'
  callId: string
}

/** Device declines the incoming call */
export interface CallDeclinedMessage {
  type: 'call:declined'
  callId: string
}

/** Either party ends the call */
export interface CallEndedMessage {
  type: 'call:ended'
  callId: string
  reason: CallEndReason
}

/** SDP offer from caller */
export interface CallOfferMessage {
  type: 'call:offer'
  callId: string
  sdp: string
}

/** SDP answer from callee */
export interface CallAnswerMessage {
  type: 'call:answer'
  callId: string
  sdp: string
}

/** ICE candidate trickle from either party */
export interface IceCandidateMessage {
  type: 'call:ice-candidate'
  callId: string
  candidate: IceCandidate
}

/** Error during call setup */
export interface CallErrorMessage {
  type: 'call:error'
  callId: string
  error: string
}

/** Union type for all signaling messages */
export type SignalingMessage =
  | CallInitiateMessage
  | CallIncomingMessage
  | CallAcceptedMessage
  | CallDeclinedMessage
  | CallEndedMessage
  | CallOfferMessage
  | CallAnswerMessage
  | IceCandidateMessage
  | CallErrorMessage
