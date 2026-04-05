/** WebSocket message types for CareHub signaling. */
import type { WebSocket } from 'ws'
import type {
  SignalingMessage,
  CallInitiateMessage,
  CallAcceptedMessage,
  CallDeclinedMessage,
  CallEndedMessage,
  CallOfferMessage,
  CallAnswerMessage,
  IceCandidateMessage,
  ScreenShareStateMessage,
} from '@carehub/shared'
import type { ClientType } from './clients'

/** Base WebSocket message structure */
export interface WsMessage {
  type: string
  payload?: unknown
}

/** Heartbeat message from device */
export interface HeartbeatMessage {
  type: 'heartbeat'
  payload: {
    batteryLevel?: number
  }
}

/** Status update from device */
export interface StatusMessage {
  type: 'status_update'
  payload: {
    status: 'online' | 'offline'
  }
}

/** Device-originated messages */
export type DeviceMessage =
  | HeartbeatMessage
  | StatusMessage
  | CallAcceptedMessage
  | CallDeclinedMessage
  | CallEndedMessage
  | CallAnswerMessage
  | IceCandidateMessage

/** Ping message from user (keep-alive heartbeat) */
export interface PingMessage {
  type: 'ping'
}

/** User-originated messages */
export type UserMessage =
  | PingMessage
  | CallInitiateMessage
  | CallEndedMessage
  | CallOfferMessage
  | IceCandidateMessage

/** Authenticated WebSocket message wrapper — includes sender info */
export interface AuthenticatedWsMessage<T extends SignalingMessage = SignalingMessage> {
  message: T
  senderId: string
  senderType: ClientType
}

/** WebSocket handler function signature */
export type WsMessageHandler<T = unknown> = (
  ws: WebSocket,
  senderId: string,
  payload: T
) => Promise<void>

/** Call handler function signature */
export type CallMessageHandler<T extends SignalingMessage = SignalingMessage> = (
  ws: WebSocket,
  senderId: string,
  senderType: ClientType,
  message: T
) => Promise<void>

// Re-export shared types for convenience
export type {
  SignalingMessage,
  CallInitiateMessage,
  CallAcceptedMessage,
  CallDeclinedMessage,
  CallEndedMessage,
  CallOfferMessage,
  CallAnswerMessage,
  IceCandidateMessage,
  ScreenShareStateMessage,
}
