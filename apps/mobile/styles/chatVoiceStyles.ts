import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const chatVoiceStyles = StyleSheet.create({
  // Voice control container (in input bar)
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Voice status container
  voiceStatusContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'center',
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Voice status text
  voiceStatusText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
    flex: 1,
  },

  // Inline stop button
  inlineStopButton: {
    backgroundColor: Colors.themeGreenMedium,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },

  inlineStopButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Microphone button
  micButton: {
    backgroundColor: Colors.themeGreenMedium,
    borderRadius: 24,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  
  // Active recording state
  micButtonActive: {
    backgroundColor: Colors.timerRed,
    transform: [{ scale: 1.1 }],
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  
  // Connecting state
  micButtonConnecting: {
    backgroundColor: Colors.timerOrange,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  
  // Disabled state
  micButtonDisabled: {
    backgroundColor: Colors.grayDisabled,
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },

  // Error state
  micButtonError: {
    backgroundColor: Colors.timerRed,
    borderWidth: 2,
    borderColor: '#FFAAAA',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  
  // Microphone icon text
  micIcon: {
    fontSize: 18,
    color: Colors.themeYellow,
    fontWeight: 'bold',
  },
  
  // Recording indicator (pulsing effect container)
  recordingIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.timerRed,
  },
  
  // Voice status overlay
  voiceStatusOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: Colors.themeBrownDark,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  
  // Status text (for overlay)
  voiceOverlayStatusText: {
    color: Colors.themeYellow,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  
  // Voice status icon
  voiceStatusIcon: {
    fontSize: 16,
    color: Colors.themeYellow,
  },
  
  // Error state styling
  voiceError: {
    backgroundColor: Colors.timerRed,
  },
  
  voiceErrorText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Connection status indicators
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  
  connectionDotConnected: {
    backgroundColor: Colors.timerGreen,
  },
  
  connectionDotConnecting: {
    backgroundColor: Colors.timerOrange,
  },
  
  connectionDotDisconnected: {
    backgroundColor: Colors.timerRed,
  },
  
  // Press and hold instruction
  holdInstructionOverlay: {
    position: 'absolute',
    bottom: 160,
    left: 16,
    right: 16,
    backgroundColor: Colors.themeBrownDark,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  
  holdInstructionText: {
    color: Colors.themeYellow,
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
  },
  
  // Voice wave animation container
  voiceWaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  
  // Individual wave bars
  voiceWaveBar: {
    width: 3,
    backgroundColor: Colors.themeYellow,
    marginHorizontal: 1,
    borderRadius: 1.5,
  },
  
  // Dismiss button for status overlay
  dismissButton: {
    backgroundColor: Colors.themeGreenMedium,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  
  dismissButtonText: {
    color: Colors.themeYellow,
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Voice permission request overlay
  permissionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  
  permissionModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    margin: 32,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textDark,
    marginBottom: 12,
    textAlign: 'center',
  },
  
  permissionMessage: {
    fontSize: 16,
    color: Colors.grayDark,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  
  permissionButton: {
    backgroundColor: Colors.themeGreen,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginVertical: 6,
    minWidth: 120,
  },
  
  permissionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  permissionCancelButton: {
    backgroundColor: Colors.grayLight,
  },
  
  permissionCancelText: {
    color: Colors.textDark,
  },

  // Simulator-specific styles for development
  simulatorBanner: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFEAA7',
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  simulatorText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '600',
    textAlign: 'center',
  },
  micButtonSimulator: {
    borderWidth: 2,
    borderColor: '#FFEAA7',
    borderStyle: 'dashed',
  },

  // Foundry Voice Toggle
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },

  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textDark,
    flex: 1,
  },
});