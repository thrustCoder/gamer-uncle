import axios from 'axios';

// Environment-specific API base URLs
const getApiBaseUrl = (): string => {
  // Check if we're in a development environment
  if (__DEV__) {
    // Use local API when developing locally - change this to Azure dev endpoint if needed
    return 'http://192.168.50.11:5001/api/'; // Local API (host machine IP for iOS simulator)
    // return 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/'; // Azure dev endpoint
  }
  
  // For production, use Azure Front Door endpoint
  return 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/';
  // 
  // // For production, use Azure Front Door endpoint
  // return 'https://gamer-uncle-prod-endpoint-cgctf0csbzetb6eb.z03.azurefd.net/api/';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

export const getRecommendations = async (criteria: any) => {
  const response = await api.post('Recommendations', criteria);
  return response.data;
};