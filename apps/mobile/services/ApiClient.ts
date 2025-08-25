import axios from 'axios';

const api = axios.create({
  baseURL: 'https://gamer-uncle-prod-app-svc.azurewebsites.net/api/',
});

export const getRecommendations = async (criteria: any) => {
  const response = await api.post('Recommendations', criteria);
  return response.data;
};