/**
 * API Configuration
 * 
 * Change API_ENVIRONMENT to switch between endpoints:
 * - 'local': Local development server
 * - 'dev': Azure Dev environment
 * - 'prod': Azure Production environment
 * 
 * App keys are loaded from environment variables (set in .env.local, which is gitignored).
 * Run "testit" command to automatically fetch keys from Azure Key Vault and create .env.local.
 */

// Configure which API endpoint to use
export type ApiEnvironment = 'local' | 'dev' | 'prod';
export const API_ENVIRONMENT = 'prod' as ApiEnvironment; // Change this to switch endpoints

// API endpoint URLs
const LOCAL_API_URL = 'http://192.168.50.11:5001/api/'; // Local API (host machine IP for iOS simulator)
const AZURE_DEV_API_URL = 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/'; // Azure dev endpoint
const AZURE_PROD_API_URL = 'https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net/api/'; // Azure prod endpoint

// App Keys (for API authentication)
// Keys are loaded from environment variables, with fallback to placeholders for CI/CD
const LOCAL_APP_KEY = process.env.EXPO_PUBLIC_LOCAL_APP_KEY || 'dev-gamer-uncle-app-key-2026';
const DEV_APP_KEY = process.env.EXPO_PUBLIC_DEV_APP_KEY || 'dev-gamer-uncle-app-key-2026';
const PROD_APP_KEY = process.env.EXPO_PUBLIC_PROD_APP_KEY || 'prod-gamer-uncle-app-key-2026';

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
 * Get the App Key based on environment configuration
 */
export const getAppKey = (): string => {
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
