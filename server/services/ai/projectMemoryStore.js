export const projectMemoryStore = {
  async getProjectContext() {
    return { context: '' };
  },
  async addMemory() {
    return {};
  },
  async recordDecision() {
    return {};
  },
  async recordLearning() {
    return {};
  },
  async getApplicableLearnings() {
    return [];
  },
  async getProjectMemory() {
    return [];
  },
};

export default projectMemoryStore;
