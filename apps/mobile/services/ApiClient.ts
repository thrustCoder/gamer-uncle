import axios from 'axios';

const api = axios.create({
  baseURL: 'https://gamer-uncle-dev-app-svc-fre7dsc5hecdh7fn.westus-01.azurewebsites.net/api/',
});

export const getRecommendations = async (criteria: any) => {
  const response = await api.post('Recommendations', criteria);
  return response.data;
};