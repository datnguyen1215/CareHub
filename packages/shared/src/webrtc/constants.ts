/** Public STUN servers for ICE candidate gathering */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

/** Time to wait for device to answer before marking as missed (30 seconds) */
export const RING_TIMEOUT_MS = 30_000

/** Time to wait for ICE gathering to complete (10 seconds) */
export const ICE_GATHERING_TIMEOUT_MS = 10_000

/** Time to wait for peer connection establishment (15 seconds) */
export const CALL_SETUP_TIMEOUT_MS = 15_000
