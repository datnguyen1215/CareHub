/**
 * Shared call state machine configuration for WebRTC calls.
 * Used by both Portal (caller) and Kiosk (callee).
 *
 * State flow:
 * idle -> initiating -> signaling -> connecting -> connected -> ending -> idle
 *                                                            \-> failed
 *
 * Signaling sub-states:
 * - Caller: waitingForAccept -> creatingOffer -> exchangingIce
 * - Callee: incoming -> waitingForOffer -> creatingAnswer -> exchangingIce
 */

import { createMachine, assign } from '@datnguyen1215/hsmjs'
import type { CallParticipant, CallEndReason, IceCandidate } from './types.js'

/** Call state names - top level */
export type CallStateName =
  | 'idle'
  | 'initiating'
  | 'signaling'
  | 'connecting'
  | 'connected'
  | 'ending'
  | 'failed'

/** Signaling sub-states for caller */
export type CallerSignalingState = 'waitingForAccept' | 'creatingOffer' | 'exchangingIce'

/** Signaling sub-states for callee */
export type CalleeSignalingState =
  | 'incoming'
  | 'waitingForOffer'
  | 'creatingAnswer'
  | 'exchangingIce'

/** Call event names */
export const CALL_EVENTS = {
  // User actions
  INITIATE: 'INITIATE',
  ACCEPT: 'ACCEPT',
  DECLINE: 'DECLINE',
  END: 'END',
  CANCEL: 'CANCEL',

  // Signaling events
  INCOMING_CALL: 'INCOMING_CALL',
  CALL_ACCEPTED: 'CALL_ACCEPTED',
  CALL_DECLINED: 'CALL_DECLINED',
  CALL_ENDED: 'CALL_ENDED',
  CALL_ERROR: 'CALL_ERROR',

  // SDP events
  OFFER_CREATED: 'OFFER_CREATED',
  OFFER_RECEIVED: 'OFFER_RECEIVED',
  ANSWER_CREATED: 'ANSWER_CREATED',
  ANSWER_RECEIVED: 'ANSWER_RECEIVED',

  // ICE events
  ICE_CANDIDATE: 'ICE_CANDIDATE',
  ICE_CONNECTED: 'ICE_CONNECTED',
  ICE_DISCONNECTED: 'ICE_DISCONNECTED',
  ICE_FAILED: 'ICE_FAILED',

  // Media events
  LOCAL_STREAM_READY: 'LOCAL_STREAM_READY',
  REMOTE_STREAM_READY: 'REMOTE_STREAM_READY',
  MEDIA_ERROR: 'MEDIA_ERROR',

  // Internal
  CLEANUP_COMPLETE: 'CLEANUP_COMPLETE',
} as const

/** Context shared by both caller and callee state machines */
export interface CallContext {
  callId: string | null
  targetDeviceId: string | null
  targetDeviceName: string | null
  caller: CallParticipant | null
  profileId: string | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  startedAt: Date | null
  duration: number
  error: string | null
  endReason: CallEndReason | null
  isMuted: boolean
  isVideoOff: boolean
  pendingIceCandidates: IceCandidate[]
}

/** Initial context for call state machine */
export const initialCallContext: CallContext = {
  callId: null,
  targetDeviceId: null,
  targetDeviceName: null,
  caller: null,
  profileId: null,
  localStream: null,
  remoteStream: null,
  startedAt: null,
  duration: 0,
  error: null,
  endReason: null,
  isMuted: false,
  isVideoOff: false,
  pendingIceCandidates: [],
}

/**
 * Logs state transitions with timestamp.
 * Format: [Call:STATE] oldState -> newState (trigger: eventName)
 */
export function logTransition(oldState: string, newState: string, event: string): void {
  const timestamp = new Date().toISOString()
  console.log(`[Call:${timestamp}] ${oldState} -> ${newState} (trigger: ${event})`)
}

/**
 * Logs WebRTC events.
 */
export function logWebRTCEvent(eventType: string, details?: string): void {
  const timestamp = new Date().toISOString()
  const message = details ? `${eventType}: ${details}` : eventType
  console.log(`[Call:WebRTC:${timestamp}] ${message}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MachineConfigAny = any

/**
 * Creates the caller (Portal) state machine configuration.
 */
export function createCallerMachineConfig(): MachineConfigAny {
  return {
    id: 'callerCall',
    initial: 'idle',
    context: { ...initialCallContext },
    states: {
      idle: {
        entry: ['logEnterIdle'],
        on: {
          INITIATE: {
            target: 'initiating',
            actions: ['assignCallInfo', 'logTransition'],
          },
        },
      },
      initiating: {
        entry: ['logEnterInitiating', 'acquireLocalMedia'],
        on: {
          LOCAL_STREAM_READY: {
            target: 'signaling',
            actions: [
              'assignLocalStream',
              'createPeerConnection',
              'sendCallInitiate',
              'logTransition',
            ],
          },
          MEDIA_ERROR: {
            target: 'failed',
            actions: ['assignError', 'logTransition'],
          },
          CANCEL: {
            target: 'ending',
            actions: ['logTransition'],
          },
        },
      },
      signaling: {
        initial: 'waitingForAccept',
        states: {
          waitingForAccept: {
            entry: ['logEnterWaitingForAccept'],
            on: {
              CALL_ACCEPTED: {
                target: 'creatingOffer',
                actions: ['logTransition'],
              },
              CALL_DECLINED: {
                target: '#callerCall.ending',
                actions: ['assignDeclined', 'logTransition'],
              },
              CALL_ERROR: {
                target: '#callerCall.failed',
                actions: ['assignError', 'logTransition'],
              },
            },
          },
          creatingOffer: {
            entry: ['logEnterCreatingOffer', 'createAndSendOffer'],
            on: {
              OFFER_CREATED: {
                target: 'exchangingIce',
                actions: ['logTransition'],
              },
              CALL_ERROR: {
                target: '#callerCall.failed',
                actions: ['assignError', 'logTransition'],
              },
            },
          },
          exchangingIce: {
            entry: ['logEnterExchangingIce', 'flushPendingIceCandidates'],
            on: {
              ICE_CANDIDATE: {
                target: 'exchangingIce',
                actions: ['sendIceCandidate'],
              },
              ANSWER_RECEIVED: {
                target: '#callerCall.connecting',
                actions: ['handleAnswer', 'logTransition'],
              },
              CALL_ERROR: {
                target: '#callerCall.failed',
                actions: ['assignError', 'logTransition'],
              },
            },
          },
        },
        on: {
          CANCEL: {
            target: 'ending',
            actions: ['sendCallEnded', 'logTransition'],
          },
          CALL_ENDED: {
            target: 'ending',
            actions: ['assignEndReason', 'logTransition'],
          },
          ICE_CANDIDATE: {
            target: 'signaling',
            actions: ['queueIceCandidate'],
          },
        },
      },
      connecting: {
        entry: ['logEnterConnecting'],
        on: {
          ICE_CONNECTED: {
            target: 'connected',
            actions: ['assignConnectedTime', 'logTransition'],
          },
          ICE_FAILED: {
            target: 'failed',
            actions: ['assignIceFailedError', 'logTransition'],
          },
          ICE_CANDIDATE: {
            target: 'connecting',
            actions: ['addRemoteIceCandidate'],
          },
          REMOTE_STREAM_READY: {
            target: 'connecting',
            actions: ['assignRemoteStream'],
          },
          END: {
            target: 'ending',
            actions: ['sendCallEnded', 'logTransition'],
          },
          CALL_ENDED: {
            target: 'ending',
            actions: ['assignEndReason', 'logTransition'],
          },
        },
      },
      connected: {
        entry: ['logEnterConnected', 'startDurationTimer'],
        on: {
          END: {
            target: 'ending',
            actions: ['sendCallEnded', 'logTransition'],
          },
          CALL_ENDED: {
            target: 'ending',
            actions: ['assignEndReason', 'logTransition'],
          },
          ICE_DISCONNECTED: {
            target: 'failed',
            actions: ['assignDisconnectedError', 'logTransition'],
          },
          ICE_FAILED: {
            target: 'failed',
            actions: ['assignIceFailedError', 'logTransition'],
          },
          REMOTE_STREAM_READY: {
            target: 'connected',
            actions: ['assignRemoteStream'],
          },
          ICE_CANDIDATE: {
            target: 'connected',
            actions: ['addRemoteIceCandidate'],
          },
        },
      },
      ending: {
        entry: ['logEnterEnding', 'stopDurationTimer', 'cleanup'],
        on: {
          CLEANUP_COMPLETE: {
            target: 'idle',
            actions: ['resetContext', 'logTransition'],
          },
        },
      },
      failed: {
        entry: ['logEnterFailed', 'stopDurationTimer', 'cleanup'],
        on: {
          CLEANUP_COMPLETE: {
            target: 'idle',
            actions: ['resetContext', 'logTransition'],
          },
        },
      },
    },
  }
}

/**
 * Creates the callee (Kiosk) state machine configuration.
 */
export function createCalleeMachineConfig(): MachineConfigAny {
  return {
    id: 'calleeCall',
    initial: 'idle',
    context: { ...initialCallContext },
    states: {
      idle: {
        entry: ['logEnterIdle'],
        on: {
          INCOMING_CALL: {
            target: 'signaling',
            actions: ['assignIncomingCallInfo', 'logTransition'],
          },
        },
      },
      signaling: {
        initial: 'incoming',
        states: {
          incoming: {
            entry: ['logEnterIncoming'],
            on: {
              ACCEPT: {
                target: 'waitingForOffer',
                actions: [
                  'acquireLocalMedia',
                  'createPeerConnection',
                  'sendCallAccepted',
                  'logTransition',
                ],
              },
              DECLINE: {
                target: '#calleeCall.ending',
                actions: ['sendCallDeclined', 'assignDeclined', 'logTransition'],
              },
            },
          },
          waitingForOffer: {
            entry: ['logEnterWaitingForOffer'],
            on: {
              LOCAL_STREAM_READY: {
                target: 'waitingForOffer',
                actions: ['assignLocalStream'],
              },
              MEDIA_ERROR: {
                target: '#calleeCall.failed',
                actions: ['assignError', 'sendCallEnded', 'logTransition'],
              },
              OFFER_RECEIVED: {
                target: 'creatingAnswer',
                actions: ['handleOffer', 'logTransition'],
              },
              CALL_ERROR: {
                target: '#calleeCall.failed',
                actions: ['assignError', 'logTransition'],
              },
            },
          },
          creatingAnswer: {
            entry: ['logEnterCreatingAnswer', 'createAndSendAnswer'],
            on: {
              ANSWER_CREATED: {
                target: '#calleeCall.connecting',
                actions: ['logTransition'],
              },
              CALL_ERROR: {
                target: '#calleeCall.failed',
                actions: ['assignError', 'logTransition'],
              },
            },
          },
        },
        on: {
          END: {
            target: 'ending',
            actions: ['sendCallEnded', 'logTransition'],
          },
          CALL_ENDED: {
            target: 'ending',
            actions: ['assignEndReason', 'logTransition'],
          },
          ICE_CANDIDATE: {
            target: 'signaling',
            actions: ['queueIceCandidate'],
          },
        },
      },
      connecting: {
        entry: ['logEnterConnecting', 'flushPendingIceCandidates'],
        on: {
          ICE_CONNECTED: {
            target: 'connected',
            actions: ['assignConnectedTime', 'logTransition'],
          },
          ICE_FAILED: {
            target: 'failed',
            actions: ['assignIceFailedError', 'logTransition'],
          },
          ICE_CANDIDATE: {
            target: 'connecting',
            actions: ['addRemoteIceCandidate'],
          },
          REMOTE_STREAM_READY: {
            target: 'connecting',
            actions: ['assignRemoteStream'],
          },
          END: {
            target: 'ending',
            actions: ['sendCallEnded', 'logTransition'],
          },
          CALL_ENDED: {
            target: 'ending',
            actions: ['assignEndReason', 'logTransition'],
          },
        },
      },
      connected: {
        entry: ['logEnterConnected', 'startDurationTimer'],
        on: {
          END: {
            target: 'ending',
            actions: ['sendCallEnded', 'logTransition'],
          },
          CALL_ENDED: {
            target: 'ending',
            actions: ['assignEndReason', 'logTransition'],
          },
          ICE_DISCONNECTED: {
            target: 'failed',
            actions: ['assignDisconnectedError', 'logTransition'],
          },
          ICE_FAILED: {
            target: 'failed',
            actions: ['assignIceFailedError', 'logTransition'],
          },
          REMOTE_STREAM_READY: {
            target: 'connected',
            actions: ['assignRemoteStream'],
          },
          ICE_CANDIDATE: {
            target: 'connected',
            actions: ['addRemoteIceCandidate'],
          },
        },
      },
      ending: {
        entry: ['logEnterEnding', 'stopDurationTimer', 'cleanup'],
        on: {
          CLEANUP_COMPLETE: {
            target: 'idle',
            actions: ['resetContext', 'logTransition'],
          },
        },
      },
      failed: {
        entry: ['logEnterFailed', 'stopDurationTimer', 'cleanup'],
        on: {
          CLEANUP_COMPLETE: {
            target: 'idle',
            actions: ['resetContext', 'logTransition'],
          },
        },
      },
    },
  }
}

/**
 * Shared assign actions for context updates.
 */
export const sharedAssignActions = {
  assignLocalStream: assign({
    localStream: ({ event }: { event: { stream: MediaStream } }) => event.stream,
  }),
  assignRemoteStream: assign({
    remoteStream: ({ event }: { event: { stream: MediaStream } }) => event.stream,
  }),
  assignError: assign({
    error: ({ event }: { event: { error: string } }) => event.error,
  }),
  assignEndReason: assign({
    endReason: ({ event }: { event: { reason: CallEndReason } }) => event.reason,
  }),
  assignDeclined: assign({
    endReason: () => 'declined' as CallEndReason,
  }),
  assignIceFailedError: assign({
    error: () => 'Connection failed. Please check your network and try again.',
  }),
  assignDisconnectedError: assign({
    error: () => 'Connection lost',
  }),
  assignConnectedTime: assign({
    startedAt: () => new Date(),
  }),
  resetContext: assign({
    callId: () => null,
    targetDeviceId: () => null,
    targetDeviceName: () => null,
    caller: () => null,
    profileId: () => null,
    localStream: () => null,
    remoteStream: () => null,
    startedAt: () => null,
    duration: () => 0,
    error: () => null,
    endReason: () => null,
    isMuted: () => false,
    isVideoOff: () => false,
    pendingIceCandidates: () => [],
  }),
  queueIceCandidate: assign({
    pendingIceCandidates: ({
      context,
      event,
    }: {
      context: CallContext
      event: { candidate: IceCandidate }
    }) => [...context.pendingIceCandidates, event.candidate],
  }),
}

/**
 * Caller-specific assign actions.
 */
export const callerAssignActions = {
  assignCallInfo: assign({
    callId: () => crypto.randomUUID(),
    targetDeviceId: ({ event }: { event: { deviceId: string } }) => event.deviceId,
    targetDeviceName: ({ event }: { event: { deviceName: string } }) => event.deviceName,
  }),
}

/**
 * Callee-specific assign actions.
 */
export const calleeAssignActions = {
  assignIncomingCallInfo: assign({
    callId: ({ event }: { event: { callId: string } }) => event.callId,
    caller: ({ event }: { event: { caller: CallParticipant } }) => event.caller,
    profileId: ({ event }: { event: { profileId: string | null } }) => event.profileId,
  }),
}

export { createMachine, assign }
