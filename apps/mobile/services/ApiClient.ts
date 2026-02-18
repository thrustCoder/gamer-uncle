import axios from 'axios';
import { getApiBaseUrl, getAppKey } from '../config/apiConfig';

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    'X-GamerUncle-AppKey': getAppKey(),
  },
});

export const getRecommendations = async (criteria: any) => {
  const response = await api.post('Recommendations', criteria);
  return response.data;
};