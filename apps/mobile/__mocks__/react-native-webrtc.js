// Mock file for react-native-webrtc to avoid native module issues in tests

const mockMediaStream = {
  id: 'mock-stream-id',
  active: true,
  getTracks: jest.fn(() => []),
  getVideoTracks: jest.fn(() => []),
  getAudioTracks: jest.fn(() => []),
  addTrack: jest.fn(),
  removeTrack: jest.fn(),
  clone: jest.fn(),
  stop: jest.fn(),
};

const mockPeerConnection = {
  localDescription: null,
  remoteDescription: null,
  connectionState: 'new',
  iceConnectionState: 'new',
  iceGatheringState: 'new',
  signalingState: 'stable',
  
  createOffer: jest.fn(() => Promise.resolve({ sdp: 'mock-offer-sdp', type: 'offer' })),
  createAnswer: jest.fn(() => Promise.resolve({ sdp: 'mock-answer-sdp', type: 'answer' })),
  setLocalDescription: jest.fn(() => Promise.resolve()),
  setRemoteDescription: jest.fn(() => Promise.resolve()),
  addIceCandidate: jest.fn(() => Promise.resolve()),
  getStats: jest.fn(() => Promise.resolve({})),
  close: jest.fn(),
  
  addStream: jest.fn(),
  removeStream: jest.fn(),
  getLocalStreams: jest.fn(() => []),
  getRemoteStreams: jest.fn(() => []),
  
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  
  onicecandidate: null,
  oniceconnectionstatechange: null,
  onaddstream: null,
  onremovestream: null,
  ondatachannel: null,
  onnegotiationneeded: null,
  onsignalingstatechange: null,
};

module.exports = {
  mediaDevices: {
    getUserMedia: jest.fn(() => Promise.resolve(mockMediaStream)),
    enumerateDevices: jest.fn(() => Promise.resolve([])),
    getSupportedConstraints: jest.fn(() => ({})),
  },
  
  RTCPeerConnection: jest.fn(() => mockPeerConnection),
  
  RTCSessionDescription: jest.fn((init) => ({
    sdp: init?.sdp || '',
    type: init?.type || 'offer',
    toJSON: jest.fn(),
  })),
  
  RTCIceCandidate: jest.fn((init) => ({
    candidate: init?.candidate || '',
    sdpMLineIndex: init?.sdpMLineIndex || 0,
    sdpMid: init?.sdpMid || '',
    toJSON: jest.fn(),
  })),
  
  MediaStream: jest.fn(() => mockMediaStream),
  
  // Additional exports that might be needed
  RTCDataChannel: jest.fn(),
  RTCStatsReport: jest.fn(),
  permissions: {
    request: jest.fn(() => Promise.resolve(true)),
    check: jest.fn(() => Promise.resolve(true)),
  },
};