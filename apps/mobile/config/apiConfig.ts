/**
 * API Configuration
 * 
 * Change USE_LOCAL_API to switch between local and Azure Dev endpoints
 */

// Set to true for local development, false for Azure Dev endpoint
export const USE_LOCAL_API = false;

// API endpoint URLs
const LOCAL_API_URL = 'http://192.168.50.11:5001/api/'; // Local API (host machine IP for iOS simulator)
const AZURE_DEV_API_URL = 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/'; // Azure dev endpoint
const AZURE_PROD_API_URL = 'https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net/api/'; // Azure prod endpoint

/**
 * Get the API base URL based on environment and configuration
 */
export const getApiBaseUrl = (): string => {
  // In development mode, respect the USE_LOCAL_API flag
  if (__DEV__) {
    return USE_LOCAL_API ? LOCAL_API_URL : AZURE_DEV_API_URL;
  }
  
  // For production builds, always use Azure Dev endpoint
  // (Change to AZURE_PROD_API_URL when ready for production)
  return AZURE_DEV_API_URL;
};
