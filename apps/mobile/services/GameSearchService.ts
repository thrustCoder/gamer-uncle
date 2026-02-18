import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl, getAppKey } from '../config/apiConfig';

/**
 * Game search result from the API (lightweight for type-ahead)
 */
export interface GameSearchResult {
  id: string;
  name: string;
  imageUrl?: string;
  averageRating: number;
  minPlayers: number;
  maxPlayers: number;
}

/**
 * Response from the game search endpoint
 */
export interface GameSearchResponse {
  results: GameSearchResult[];
  totalCount: number;
}

/**
 * Detailed game information from the API
 */
export interface GameDetails {
  id: string;
  name: string;
  imageUrl?: string;
  overview: string;
  averageRating: number;
  bggRating: number;
  numVotes: number;
  minPlayers: number;
  maxPlayers: number;
  ageRequirement: number;
  rulesUrl?: string;
  minPlaytime: number;
  maxPlaytime: number;
  yearPublished: number;
  weight: number;
  mechanics: string[];
  categories: string[];
}

/**
 * Service for game search API interactions
 */
class GameSearchService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: getApiBaseUrl(),
      headers: {
        'Content-Type': 'application/json',
        'X-GamerUncle-AppKey': getAppKey(),
      },
    });
  }

  /**
   * Search for games by name (type-ahead)
   * @param query - Search query (minimum 3 characters)
   * @returns Search results with matching games
   */
  async searchGames(query: string): Promise<GameSearchResponse> {
    if (!query || query.length < 3) {
      return { results: [], totalCount: 0 };
    }

    try {
      const response = await this.api.get<GameSearchResponse>('Games/search', {
        params: { q: query },
      });
      return response.data;
    } catch (error: any) {
      console.error('Game search error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error || 'Failed to search games. Please try again.'
      );
    }
  }

  /**
   * Get detailed information for a specific game
   * @param gameId - The game ID (e.g., "bgg-13")
   * @returns Detailed game information
   */
  async getGameDetails(gameId: string): Promise<GameDetails> {
    if (!gameId) {
      throw new Error('Game ID is required');
    }

    try {
      const response = await this.api.get<GameDetails>(`Games/${gameId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Game not found');
      }
      console.error('Get game details error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error || 'Failed to load game details. Please try again.'
      );
    }
  }
}

// Export a singleton instance
export const gameSearchService = new GameSearchService();

export default gameSearchService;
