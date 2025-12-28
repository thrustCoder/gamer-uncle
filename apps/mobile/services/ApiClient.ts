import axios from 'axios';
import { getApiBaseUrl } from '../config/apiConfig';

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

export const getRecommendations = async (criteria: any) => {
  const response = await api.post('Recommendations', criteria);
  return response.data;
};