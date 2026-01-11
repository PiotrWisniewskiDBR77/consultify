import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  linkedinId: z.string().optional(),
  companyName: z.string(),
  role: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended', 'pending']),
  lastLogin: z.string().optional(),
  isAuthenticated: z.boolean(),
  accessLevel: z.enum(['free', 'full']),
  preferredLanguage: z.string().optional(),
  organizationId: z.string().optional(),
  organizationName: z.string().optional(),
  avatarUrl: z.string().optional(),
  tokenUsage: z.number().optional(),
  tokenLimit: z.number().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  units: z.enum(['metric', 'imperial']).optional(),
  impersonatorId: z.string().optional(),
  licensePlanId: z.string().optional(),
  hasWorkspace: z.boolean().optional(),
  journeyState: z.string().optional(),
  currentPhase: z.string().optional(),
});

export type UserType = z.infer<typeof UserSchema>;
