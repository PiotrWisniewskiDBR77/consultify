import { FullInitiative } from '../types';
import { Api } from './api';

export const InitiativeService = {
  getAll: async (): Promise<FullInitiative[]> => {
    try {
      const data = await Api.get('/initiatives');
      return data;
    } catch (error) {
      console.error('Failed to fetch initiatives', error);
      throw error;
    }
  },

  getById: async (id: string): Promise<FullInitiative> => {
    try {
      const data = await Api.get(`/initiatives/${id}`);
      return data;
    } catch (error) {
      console.error(`Failed to fetch initiative ${id}`, error);
      throw error;
    }
  },
};
