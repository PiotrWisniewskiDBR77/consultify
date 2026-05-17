export const getOrganizationContextQuotaCopy = (percentage: number) => {
  if (percentage >= 100) {
    return {
      title: 'Organization context uploads are blocked',
      tone: 'critical' as const,
      description:
        'New context documents will be saved as quota_blocked metadata only. They are not processed, indexed, or available to AI until storage is freed or the plan limit changes.',
    };
  }

  if (percentage >= 90) {
    return {
      title: 'Organization context storage is critical',
      tone: 'critical' as const,
      description:
        'Uploads may be blocked soon. Review large project documents before relying on them in AI workflows.',
    };
  }

  if (percentage >= 75) {
    return {
      title: 'Organization context storage is getting high',
      tone: 'warning' as const,
      description:
        'Uploaded documents, extracted text, and indexed chunks consume storage. Keep only useful project context ready for AI.',
    };
  }

  return {
    title: 'Organization context storage is healthy',
    tone: 'normal' as const,
    description:
      'Project and organization documents can continue to be uploaded and processed within the current plan limit.',
  };
};
