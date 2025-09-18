import axios from 'axios';

// Environment-specific API base URLs
const getApiBaseUrl = (): string => {
  // TEMPORARY: Force dev endpoint for both voice and chat testing until prod is configured
  // TODO: Remove this when production services are deployed
  return 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/';
  
  // Original logic (restored after production services are deployed):
  // Check if we're in a development environment
  // if (__DEV__) {
  //   // For development, use Azure Front Door endpoint
  //   return 'https://gamer-uncle-dev-endpoint-ddbzf6b4hzcadhbg.z03.azurefd.net/api/';
  // }
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