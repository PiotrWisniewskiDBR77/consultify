export namespace projectMemoryStore {
  function getProjectContext(): Promise<{
    context: string;
  }>;
  function addMemory(): Promise<{}>;
  function recordDecision(): Promise<{}>;
  function recordLearning(): Promise<{}>;
  function getApplicableLearnings(): Promise<any[]>;
  function getProjectMemory(): Promise<any[]>;
}
export default projectMemoryStore;
//# sourceMappingURL=projectMemoryStore.d.ts.map
