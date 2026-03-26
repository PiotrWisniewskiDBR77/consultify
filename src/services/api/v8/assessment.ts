import { v8Delete, v8Get, v8Post, v8Put } from './client';

export interface V8AssessmentListItem {
  id: string;
  name: string;
  status: string;
  backendStatus?: string;
  assessment_type?: string;
  project_id?: string | null;
  updated_at?: string;
  created_at?: string;
  answers?: Record<string, unknown>;
  scoreSummary?: Record<string, unknown>;
}

export interface V8AssessmentDetail extends V8AssessmentListItem {
  contextSnapshot?: Record<string, unknown>;
  navigation?: Record<string, unknown> | null;
}

export interface V8AssessmentUserRole {
  role: string;
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canManage: boolean;
    canManageTeam: boolean;
    canChangeStatus: boolean;
    canApprove: boolean;
    canDelete: boolean;
    canGenerateReport: boolean;
    canGenerateInitiatives: boolean;
    canRequestAccess: boolean;
  };
  assignedAreas: string[] | null;
  isOwner: boolean;
}

export interface V8AssessmentUserState {
  assessmentId: string;
  userId: string;
  navigation: Record<string, unknown> | null;
  updatedAt: string | null;
}

export interface V8AssessmentAssignment {
  id: string;
  assessment_id: string;
  area_id: string;
  assigned_user_id: string;
  assigned_by: string;
  assigned_at: string;
  due_at?: string | null;
  status: string;
}

export interface V8AssessmentListResponse {
  items: V8AssessmentListItem[];
  assessments: V8AssessmentListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface V8AssessmentCreatePayload {
  assessmentType: string;
  name: string;
  projectId?: string | null;
}

export interface V8AssessmentUpdatePayload {
  name?: string;
  answers?: Record<string, unknown>;
  completionPercent?: number;
  confidenceAvg?: number;
  contextSnapshot?: Record<string, unknown>;
  scoreSummary?: Record<string, unknown>;
  currentSectionId?: string | null;
  navigation?: Record<string, unknown>;
}

export interface V8AssessmentUserStatePayload {
  navigation?: {
    axisId: number;
    areaId: string;
    level: number;
  };
}

export interface V8AssessmentAssignmentPayload {
  areaId: string;
  assignedUserId: string;
  dueAt?: string | null;
  status?: string;
}

export const V8AssessmentApi = {
  listAssessments(params?: {
    projectId?: string;
    status?: string;
    assessmentType?: string;
    limit?: number;
    offset?: number;
  }) {
    const query: Record<string, string> = {};
    if (params?.projectId) query.projectId = params.projectId;
    if (params?.status) query.status = params.status;
    if (params?.assessmentType) query.assessmentType = params.assessmentType;
    if (params?.limit !== undefined) query.limit = String(params.limit);
    if (params?.offset !== undefined) query.offset = String(params.offset);
    return v8Get<V8AssessmentListResponse>('/assessment', query);
  },

  getAssessment(assessmentId: string) {
    return v8Get<{ assessment: V8AssessmentDetail }>(`/assessment/${assessmentId}`);
  },

  createAssessment(payload: V8AssessmentCreatePayload) {
    return v8Post<{ id: string; assessment: V8AssessmentDetail }>('/assessment', payload);
  },

  updateAssessment(assessmentId: string, payload: V8AssessmentUpdatePayload) {
    return v8Put<{ id: string; updatedAt: string }>(`/assessment/${assessmentId}`, payload);
  },

  getMyRole(assessmentId: string) {
    return v8Get<V8AssessmentUserRole>(`/assessment/${assessmentId}/my-role`);
  },

  getUserState(assessmentId: string) {
    return v8Get<V8AssessmentUserState>(`/assessment/${assessmentId}/user-state`);
  },

  updateUserState(assessmentId: string, payload: V8AssessmentUserStatePayload) {
    return v8Put<{ assessmentId: string; userId: string; updatedAt: string }>(
      `/assessment/${assessmentId}/user-state`,
      payload
    );
  },

  listAssignments(assessmentId: string) {
    return v8Get<{ assessmentId: string; assignments: V8AssessmentAssignment[] }>(
      `/assessment/${assessmentId}/assignments`
    );
  },

  upsertAssignment(assessmentId: string, payload: V8AssessmentAssignmentPayload) {
    return v8Put<{
      assessmentId: string;
      areaId: string;
      assignedUserId: string;
      dueAt?: string | null;
      status: string;
      updatedAt: string;
    }>(`/assessment/${assessmentId}/assignments`, payload);
  },

  deleteAssignment(assessmentId: string, assignmentId: string) {
    return v8Delete<{ assessmentId: string; assignmentId: string; deleted: boolean }>(
      `/assessment/${assessmentId}/assignments/${assignmentId}`
    );
  },
};
