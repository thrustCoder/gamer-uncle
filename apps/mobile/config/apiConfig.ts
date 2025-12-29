/**
 * API Configuration
 * 
 * Change API_ENVIRONMENT to switch between endpoints:
 * - 'local': Local development server
 * - 'dev': Azure Dev environment
 * - 'prod': Azure Production environment
 */

// Configure which API endpoint to use
export type ApiEnvironment = 'local' | 'dev' | 'prod';
export const API_ENVIRONMENT: ApiEnvironment = 'local'; // Change this to switch endpoints

// API endpoint URLs
const LOCAL_API_URL = 'http://192.168.50.11:5001/api/'; // Local API (host machine IP for iOS simulator)
const AZURE_DEV_API_URL = 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/'; // Azure dev endpoint
const AZURE_PROD_API_URL = 'https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net/api/'; // Azure prod endpoint

/**
 * Get the API base URL based on environment configuration
 */
export const getApiBaseUrl = (): string => {
  switch (API_ENVIRONMENT) {
    case 'local':
      return LOCAL_API_URL;
    case 'dev':
      return AZURE_DEV_API_URL;
    case 'prod':
      return AZURE_PROD_API_URL;
    default:
      // Fallback to prod for production builds
      return __DEV__ ? AZURE_DEV_API_URL : AZURE_PROD_API_URL;
  }
};
