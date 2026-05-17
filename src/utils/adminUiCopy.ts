export const ADMIN_UI_COPY = {
  unavailable: {
    title: 'Unavailable',
    description: 'This action is not available yet because the backend workflow is not connected.',
  },
  readOnly: {
    title: 'Read-only diagnostic view',
    description: 'Configuration is managed elsewhere.',
  },
  degraded: {
    title: 'Limited data',
    description:
      'Some data could not be loaded. Showing the last reliable snapshot where available.',
  },
  noData: {
    title: 'No data',
    description: 'No records yet.',
  },
  error: {
    title: 'Unable to load data',
    description: 'We could not load this data. Try again or contact an administrator.',
  },
  destructiveDisabled: {
    title: 'Destructive action disabled',
    description:
      'This destructive action is disabled until confirmation, audit and recovery workflow are implemented.',
  },
  hidden: {
    title: 'Hidden until ready',
    description: 'This action is intentionally hidden until the implementation is complete.',
  },
} as const;
