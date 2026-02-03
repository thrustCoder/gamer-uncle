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
export const API_ENVIRONMENT = 'local' as ApiEnvironment; // Change this to switch endpoints

// API endpoint URLs
const LOCAL_API_URL = 'http://192.168.50.11:5001/api/'; // Local API (host machine IP for iOS simulator)
const AZURE_DEV_API_URL = 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/'; // Azure dev endpoint
const AZURE_PROD_API_URL = 'https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net/api/'; // Azure prod endpoint

// Game Search App Keys (for API authentication)
// In production, these would be bundled securely or fetched from a config service
const LOCAL_APP_KEY = 'dev-gamer-uncle-app-key-2026';
const DEV_APP_KEY = 'dev-gamer-uncle-app-key-2026'; // Will be replaced with Key Vault value in CI/CD
const PROD_APP_KEY = 'prod-gamer-uncle-app-key-2026'; // Will be replaced with Key Vault value in CI/CD

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

/**
 * Get the Game Search App Key based on environment configuration
 */
export const getGameSearchAppKey = (): string => {
  switch (API_ENVIRONMENT) {
    case 'local':
      return LOCAL_APP_KEY;
    case 'dev':
      return DEV_APP_KEY;
    case 'prod':
      return PROD_APP_KEY;
    default:
      return __DEV__ ? DEV_APP_KEY : PROD_APP_KEY;
  }
};
