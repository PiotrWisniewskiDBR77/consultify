/**
 * Access Control Schema
 */

export interface AccessControlRule {
  id: string;
  resource: string;
  action: string;
  effect: 'allow' | 'deny';
  conditions?: Record<string, any>;
}

export interface AccessControlPolicy {
  id: string;
  name: string;
  description?: string;
  rules: AccessControlRule[];
  createdAt: string;
  updatedAt: string;
}

export const validateAccessControlRule = (rule: any): rule is AccessControlRule => {
  return (
    typeof rule.id === 'string' &&
    typeof rule.resource === 'string' &&
    typeof rule.action === 'string' &&
    (rule.effect === 'allow' || rule.effect === 'deny')
  );
};

export const AccessControlSchemas = {
  AccessControlRule: {} as AccessControlRule,
  AccessControlPolicy: {} as AccessControlPolicy,
};
