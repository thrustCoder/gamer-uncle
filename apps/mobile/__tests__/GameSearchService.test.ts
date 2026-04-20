import axios from 'axios';

// Mock apiConfig before importing the service
jest.mock('../config/apiConfig', () => ({
  getApiBaseUrl: () => 'https://test-api.example.com/api/',
  getAppKey: () => 'test-app-key',
}));

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
  })),
}));

import { GameSearchService, GameSearchResponse, GameDetails, gameSearchService } from '../services/GameSearchService';

describe('GameSearchService', () => {
  let mockApi: { get: jest.Mock; post: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockApi = {
      get: jest.fn(),
      post: jest.fn(),
    };
    (axios.create as jest.Mock).mockReturnValue(mockApi);
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(gameSearchService).toBeDefined();
    });
  });

  describe('searchGames', () => {
    it('should return empty results for empty query', async () => {
      // Use a fresh instance so our mock api is attached
      const service = new (GameSearchService as any)();
      // Manually override the api
      (service as any).api = mockApi;

      const result = await service.searchGames('');
      expect(result).toEqual({ results: [], totalCount: 0 });
      expect(mockApi.get).not.toHaveBeenCalled();
    });

    it('should return empty results for query shorter than 3 characters', async () => {
      const service = new (GameSearchService as any)();
      (service as any).api = mockApi;

      const result = await service.searchGames('ca');
      expect(result).toEqual({ results: [], totalCount: 0 });
      expect(mockApi.get).not.toHaveBeenCalled();
    });

    it('should call API with correct params for valid query', async () => {
      const mockResponse: GameSearchResponse = {
        results: [
          {
            id: 'bgg-13',
            name: 'Catan',
            imageUrl: 'https://example.com/catan.jpg',
            averageRating: 7.2,
            minPlayers: 3,
            maxPlayers: 4,
          },
        ],
        totalCount: 1,
      };

      const service = new (GameSearchService as any)();
      (service as any).api = mockApi;
      mockApi.get.mockResolvedValue({ data: mockResponse });

      const result = await service.searchGames('Catan');

      expect(mockApi.get).toHaveBeenCalledWith('Games/search', {
        params: { q: 'Catan' },
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error with API error message on failure', async () => {
      const service = new (GameSearchService as any)();
      (service as any).api = mockApi;
      mockApi.get.mockRejectedValue({
        response: { data: { error: 'Service unavailable' } },
      });

      await expect(service.searchGames('Catan')).rejects.toThrow('Service unavailable');
    });

    it('should throw default error message when no API error message', async () => {
      const service = new (GameSearchService as any)();
      (service as any).api = mockApi;
      mockApi.get.mockRejectedValue({
        message: 'Network Error',
      });

      await expect(service.searchGames('Catan')).rejects.toThrow(
        'Failed to search games. Please try again.'
      );
    });
  });

  describe('getGameDetails', () => {
    it('should throw error for empty gameId', async () => {
      const service = new (GameSearchService as any)();
      (service as any).api = mockApi;

      await expect(service.getGameDetails('')).rejects.toThrow('Game ID is required');
      expect(mockApi.get).not.toHaveBeenCalled();
    });

    it('should call API with correct path', async () => {
      const mockDetails: GameDetails = {
        id: 'bgg-13',
        name: 'Catan',
        overview: 'A classic board game',
        averageRating: 7.2,
        bggRating: 7.1,
        numVotes: 100000,
        minPlayers: 3,
        maxPlayers: 4,
        ageRequirement: 10,
        minPlaytime: 60,
        maxPlaytime: 120,
        yearPublished: 1995,
        weight: 2.3,
        mechanics: ['Trading', 'Dice Rolling'],
        categories: ['Strategy'],
      };

      const service = new (GameSearchService as any)();
      (service as any).api = mockApi;
      mockApi.get.mockResolvedValue({ data: mockDetails });

      const result = await service.getGameDetails('bgg-13');

      expect(mockApi.get).toHaveBeenCalledWith('Games/bgg-13');
      expect(result).toEqual(mockDetails);
    });

    it('should throw "Game not found" for 404 responses', async () => {
      const service = new (GameSearchService as any)();
      (service as any).api = mockApi;
      mockApi.get.mockRejectedValue({
        response: { status: 404 },
      });

      await expect(service.getGameDetails('bgg-9999')).rejects.toThrow('Game not found');
    });

    it('should throw API error message for other errors', async () => {
      const service = new (GameSearchService as any)();
      (service as any).api = mockApi;
      mockApi.get.mockRejectedValue({
        response: { status: 500, data: { error: 'Internal error' } },
      });

      await expect(service.getGameDetails('bgg-13')).rejects.toThrow('Internal error');
    });

    it('should throw default error message when no API error message', async () => {
      const service = new (GameSearchService as any)();
      (service as any).api = mockApi;
      mockApi.get.mockRejectedValue({
        message: 'Timeout',
      });

      await expect(service.getGameDetails('bgg-13')).rejects.toThrow(
        'Failed to load game details. Please try again.'
      );
    });
  });
});
