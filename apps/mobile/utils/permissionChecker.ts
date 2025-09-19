import { PermissionsAndroid, Platform } from 'react-native';
import { mediaDevices } from 'react-native-webrtc';

export interface PermissionStatus {
  microphone: 'granted' | 'denied' | 'undetermined' | 'error';
  camera: 'granted' | 'denied' | 'undetermined' | 'error';
}

export class PermissionChecker {
  static async checkPermissions(): Promise<PermissionStatus> {
    const result: PermissionStatus = {
      microphone: 'undetermined',
      camera: 'undetermined'
    };

    try {
      if (Platform.OS === 'android') {
        // Android permission checking
        const micStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        const cameraStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        
        result.microphone = micStatus ? 'granted' : 'denied';
        result.camera = cameraStatus ? 'granted' : 'denied';
      } else {
        // iOS - We can't directly check permissions without triggering a request,
        // but we can try to enumerate devices to see if permissions exist
        try {
          const devices = await mediaDevices.enumerateDevices() as MediaDeviceInfo[];
          const audioDevices = devices.filter((device: MediaDeviceInfo) => device.kind === 'audioinput');
          const videoDevices = devices.filter((device: MediaDeviceInfo) => device.kind === 'videoinput');
          
          // If we get device labels, permissions are likely granted
          result.microphone = audioDevices.length > 0 && audioDevices[0].label ? 'granted' : 'undetermined';
          result.camera = videoDevices.length > 0 && videoDevices[0].label ? 'granted' : 'undetermined';
        } catch (error) {
          console.log('Device enumeration failed:', error);
          result.microphone = 'undetermined';
          result.camera = 'undetermined';
        }
      }
    } catch (error) {
      console.error('Permission check failed:', error);
      result.microphone = 'error';
      result.camera = 'error';
    }

    return result;
  }

  static async requestMicrophonePermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Gamer Uncle needs access to your microphone for voice chat.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        // iOS - attempt to get user media which will trigger permission request
        try {
          const stream = await mediaDevices.getUserMedia({
            audio: true,
            video: false
          });
          
          // If successful, stop the stream and return true
          stream.getTracks().forEach(track => track.stop());
          return true;
        } catch (error) {
          console.log('iOS microphone permission request failed:', error);
          return false;
        }
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  static getPermissionStatusText(status: PermissionStatus): string {
    return `Mic: ${status.microphone} | Camera: ${status.camera}`;
  }
}

export default PermissionChecker;