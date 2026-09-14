type WorkloadFlagEnv = { VITE_INITIATIVES_WORKLOAD?: string };

export const isInitiativesWorkloadEnabled = (
  env: WorkloadFlagEnv = import.meta.env as WorkloadFlagEnv
): boolean => env.VITE_INITIATIVES_WORKLOAD === 'true';
