import axios from 'axios';

// Mock apiConfig before importing ApiClient
jest.mock('../config/apiConfig', () => ({
  getApiBaseUrl: jest.fn(() => 'http://localhost:5001/api/'),
  getAppKey: jest.fn(() => 'test-app-key-123'),
}));

// Mock axios
jest.mock('axios', () => {
  const mockAxiosInstance = {
    post: jest.fn(() => Promise.resolve({ data: { message: 'test response' } })),
    defaults: { headers: {} },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockAxiosInstance),
      post: jest.fn(),
    },
  };
});

describe('ApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Axios instance configuration', () => {
    it('should create axios instance with App Key header', () => {
      // Re-import to trigger module initialization with mocks
      jest.isolateModules(() => {
        const axiosMock = require('axios').default;
        require('../services/ApiClient');

        expect(axiosMock.create).toHaveBeenCalledWith(
          expect.objectContaining({
            baseURL: 'http://localhost:5001/api/',
            headers: expect.objectContaining({
              'X-GamerUncle-AppKey': 'test-app-key-123',
              'Content-Type': 'application/json',
            }),
          })
        );
      });
    });

    it('should create axios instance with correct base URL', () => {
      jest.isolateModules(() => {
        const axiosMock = require('axios').default;
        require('../services/ApiClient');

        expect(axiosMock.create).toHaveBeenCalledWith(
          expect.objectContaining({
            baseURL: 'http://localhost:5001/api/',
          })
        );
      });
    });
  });

  describe('getRecommendations', () => {
    it('should post criteria to Recommendations endpoint', async () => {
      let getRecommendations: any;
      let mockPost: jest.Mock;

      jest.isolateModules(() => {
        const axiosMock = require('axios').default;
        mockPost = jest.fn(() => Promise.resolve({ data: { answer: 'Try Catan!' } }));
        axiosMock.create.mockReturnValue({
          post: mockPost,
          defaults: { headers: {} },
        });

        const apiClient = require('../services/ApiClient');
        getRecommendations = apiClient.getRecommendations;
      });

      const criteria = { query: 'best 2 player games' };
      const result = await getRecommendations(criteria);

      expect(mockPost!).toHaveBeenCalledWith('Recommendations', criteria);
      expect(result).toEqual({ answer: 'Try Catan!' });
    });

    it('should propagate errors from the API', async () => {
      let getRecommendations: any;

      jest.isolateModules(() => {
        const axiosMock = require('axios').default;
        axiosMock.create.mockReturnValue({
          post: jest.fn(() => Promise.reject(new Error('Network error'))),
          defaults: { headers: {} },
        });

        const apiClient = require('../services/ApiClient');
        getRecommendations = apiClient.getRecommendations;
      });

      await expect(getRecommendations({ query: 'test' })).rejects.toThrow('Network error');
    });
  });
});
