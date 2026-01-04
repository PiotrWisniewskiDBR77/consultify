export default AccessPolicyService;
declare namespace AccessPolicyService {
    export { ORG_TYPES };
    export { DEFAULT_TRIAL_LIMITS };
    export { DEFAULT_DEMO_LIMITS };
    export { TRIAL_DURATION_DAYS };
    export let MAX_TRIAL_EXTENSIONS: number;
    export let MAX_EXTENSION_DAYS: number;
}
declare namespace ORG_TYPES {
    let DEMO: string;
    let TRIAL: string;
    let PAID: string;
}
declare namespace DEFAULT_TRIAL_LIMITS {
    let max_projects: number;
    let max_users: number;
    let max_ai_calls_per_day: number;
    let max_initiatives: number;
    let max_storage_mb: number;
    let max_total_tokens: number;
    let ai_roles_enabled_json: string;
}
declare namespace DEFAULT_DEMO_LIMITS {
    let max_projects_1: number;
    export { max_projects_1 as max_projects };
    let max_users_1: number;
    export { max_users_1 as max_users };
    let max_ai_calls_per_day_1: number;
    export { max_ai_calls_per_day_1 as max_ai_calls_per_day };
    let max_initiatives_1: number;
    export { max_initiatives_1 as max_initiatives };
    let max_storage_mb_1: number;
    export { max_storage_mb_1 as max_storage_mb };
    let ai_roles_enabled_json_1: string;
    export { ai_roles_enabled_json_1 as ai_roles_enabled_json };
}
declare const TRIAL_DURATION_DAYS: 14;
//# sourceMappingURL=accessPolicyService.d.ts.map