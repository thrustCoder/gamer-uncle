import { PermissionChecker, PermissionStatus } from '../utils/permissionChecker';
import { mediaDevices } from 'react-native-webrtc';

// Mock Platform with a mutable OS property
let mockPlatformOS = 'ios';

// Mock react-native completely
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
    set OS(value) {
      mockPlatformOS = value;
    },
    select: jest.fn((obj) => obj[mockPlatformOS]),
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
      CAMERA: 'android.permission.CAMERA',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
    check: jest.fn(),
    request: jest.fn(),
  },
}));

// Re-export for test usage
const { PermissionsAndroid } = require('react-native');

// Mock react-native-webrtc
jest.mock('react-native-webrtc', () => ({
  mediaDevices: {
    getUserMedia: jest.fn(),
    enumerateDevices: jest.fn(),
  },
  RTCPeerConnection: jest.fn(),
}));

describe('PermissionChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkPermissions', () => {
    describe('on Android', () => {
      beforeEach(() => {
        mockPlatformOS = 'android';
      });

      it('should return granted status when permissions are granted', async () => {
        (PermissionsAndroid.check as jest.Mock)
          .mockResolvedValueOnce(true) // microphone
          .mockResolvedValueOnce(true); // camera

        const result = await PermissionChecker.checkPermissions();

        expect(result.microphone).toBe('granted');
        expect(result.camera).toBe('granted');
      });

      it('should return denied status when permissions are denied', async () => {
        (PermissionsAndroid.check as jest.Mock)
          .mockResolvedValueOnce(false) // microphone
          .mockResolvedValueOnce(false); // camera

        const result = await PermissionChecker.checkPermissions();

        expect(result.microphone).toBe('denied');
        expect(result.camera).toBe('denied');
      });

      it('should check correct Android permissions', async () => {
        (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

        await PermissionChecker.checkPermissions();

        expect(PermissionsAndroid.check).toHaveBeenCalledWith(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        expect(PermissionsAndroid.check).toHaveBeenCalledWith(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
      });

      it('should return error status on exception', async () => {
        (PermissionsAndroid.check as jest.Mock).mockRejectedValue(
          new Error('Permission check failed')
        );

        const result = await PermissionChecker.checkPermissions();

        expect(result.microphone).toBe('error');
        expect(result.camera).toBe('error');
      });
    });

    describe('on iOS', () => {
      beforeEach(() => {
        mockPlatformOS = 'ios';
      });

      it('should return granted when devices have labels', async () => {
        (mediaDevices.enumerateDevices as jest.Mock).mockResolvedValue([
          { kind: 'audioinput', label: 'Built-in Microphone' },
          { kind: 'videoinput', label: 'Built-in Camera' },
        ]);

        const result = await PermissionChecker.checkPermissions();

        expect(result.microphone).toBe('granted');
        expect(result.camera).toBe('granted');
      });

      it('should return undetermined when devices have no labels', async () => {
        (mediaDevices.enumerateDevices as jest.Mock).mockResolvedValue([
          { kind: 'audioinput', label: '' },
          { kind: 'videoinput', label: '' },
        ]);

        const result = await PermissionChecker.checkPermissions();

        expect(result.microphone).toBe('undetermined');
        expect(result.camera).toBe('undetermined');
      });

      it('should return undetermined when no devices found', async () => {
        (mediaDevices.enumerateDevices as jest.Mock).mockResolvedValue([]);

        const result = await PermissionChecker.checkPermissions();

        expect(result.microphone).toBe('undetermined');
        expect(result.camera).toBe('undetermined');
      });

      it('should handle enumeration errors gracefully', async () => {
        (mediaDevices.enumerateDevices as jest.Mock).mockRejectedValue(
          new Error('Enumeration failed')
        );

        const result = await PermissionChecker.checkPermissions();

        expect(result.microphone).toBe('undetermined');
        expect(result.camera).toBe('undetermined');
      });
    });
  });

  describe('requestMicrophonePermission', () => {
    describe('on Android', () => {
      beforeEach(() => {
        mockPlatformOS = 'android';
      });

      it('should return true when permission is granted', async () => {
        (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
          PermissionsAndroid.RESULTS.GRANTED
        );

        const result = await PermissionChecker.requestMicrophonePermission();

        expect(result).toBe(true);
        expect(PermissionsAndroid.request).toHaveBeenCalledWith(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          expect.objectContaining({
            title: 'Microphone Permission',
            message: expect.stringContaining('microphone'),
          })
        );
      });

      it('should return false when permission is denied', async () => {
        (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
          PermissionsAndroid.RESULTS.DENIED
        );

        const result = await PermissionChecker.requestMicrophonePermission();

        expect(result).toBe(false);
      });

      it('should return false when permission is never_ask_again', async () => {
        (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
          PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        );

        const result = await PermissionChecker.requestMicrophonePermission();

        expect(result).toBe(false);
      });

      it('should handle request errors', async () => {
        (PermissionsAndroid.request as jest.Mock).mockRejectedValue(
          new Error('Permission request failed')
        );

        const result = await PermissionChecker.requestMicrophonePermission();

        expect(result).toBe(false);
      });
    });

    describe('on iOS', () => {
      beforeEach(() => {
        mockPlatformOS = 'ios';
      });

      it('should return true when getUserMedia succeeds', async () => {
        const mockStopFn = jest.fn();
        const mockStream = {
          getTracks: jest.fn(() => [
            { stop: mockStopFn },
          ]),
        };
        (mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);

        const result = await PermissionChecker.requestMicrophonePermission();

        expect(result).toBe(true);
        expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
          audio: true,
          video: false,
        });
        
        // Should stop the stream
        expect(mockStopFn).toHaveBeenCalled();
      });

      it('should return false when getUserMedia fails', async () => {
        (mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
          new Error('Permission denied')
        );

        const result = await PermissionChecker.requestMicrophonePermission();

        expect(result).toBe(false);
      });

      it('should handle getUserMedia errors', async () => {
        (mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
          new Error('Device not found')
        );

        const result = await PermissionChecker.requestMicrophonePermission();

        expect(result).toBe(false);
      });
    });
  });

  describe('getPermissionStatusText', () => {
    it('should format granted status correctly', () => {
      const status: PermissionStatus = {
        microphone: 'granted',
        camera: 'granted',
      };

      const text = PermissionChecker.getPermissionStatusText(status);

      expect(text).toBe('Mic: granted | Camera: granted');
    });

    it('should format denied status correctly', () => {
      const status: PermissionStatus = {
        microphone: 'denied',
        camera: 'denied',
      };

      const text = PermissionChecker.getPermissionStatusText(status);

      expect(text).toBe('Mic: denied | Camera: denied');
    });

    it('should format mixed status correctly', () => {
      const status: PermissionStatus = {
        microphone: 'granted',
        camera: 'undetermined',
      };

      const text = PermissionChecker.getPermissionStatusText(status);

      expect(text).toBe('Mic: granted | Camera: undetermined');
    });

    it('should format error status correctly', () => {
      const status: PermissionStatus = {
        microphone: 'error',
        camera: 'error',
      };

      const text = PermissionChecker.getPermissionStatusText(status);

      expect(text).toBe('Mic: error | Camera: error');
    });
  });

  describe('Cross-platform consistency', () => {
    it('should return consistent PermissionStatus structure across platforms', async () => {
      // Both platforms should return same structure
      const result = await PermissionChecker.checkPermissions();
      
      expect(result).toHaveProperty('microphone');
      expect(result).toHaveProperty('camera');
      expect(['granted', 'denied', 'undetermined', 'error']).toContain(result.microphone);
      expect(['granted', 'denied', 'undetermined', 'error']).toContain(result.camera);
    });

    it('should handle edge case of no media devices', async () => {
      mockPlatformOS = 'ios';
      (mediaDevices.enumerateDevices as jest.Mock).mockResolvedValue([]);

      const result = await PermissionChecker.checkPermissions();

      // Should not crash
      expect(result).toBeDefined();
      expect(result.microphone).toBe('undetermined');
    });
  });

  describe('Permission state transitions', () => {
    it('should handle transition from undetermined to granted', async () => {
      mockPlatformOS = 'ios';
      
      // Mock permission flow
      const mockStream = {
        getTracks: jest.fn(() => [{ stop: jest.fn() }]),
      };
      (mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);
      
      const granted = await PermissionChecker.requestMicrophonePermission();
      expect(granted).toBe(true);
    });

    it('should handle permission denial flow', async () => {
      mockPlatformOS = 'ios';
      
      // Request permission - denied
      (mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );
      
      const granted = await PermissionChecker.requestMicrophonePermission();
      expect(granted).toBe(false);
    });
  });
});
