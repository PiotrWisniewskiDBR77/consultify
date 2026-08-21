#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean };

function read(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((needle) => content.includes(needle));
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const meetingService = read(root, 'server/src/services/meetingService.ts');
  const meetingRoutes = read(root, 'server/src/routes/meeting.routes.ts');
  const gateway = read(root, 'server/src/Gateway.ts');
  const meetingHub = read(root, 'src/components/Meeting/MeetingHub.tsx');
  const meetingExecutor = read(root, 'server/src/ai/actionExecutors/meetingExecutor.ts');
  const api = read(root, 'src/services/api.ts');

  checks.push({
    name: 'Meeting runtime persists meetings and follow-ups in backend tables',
    pass: includesAll(meetingService, [
      'CREATE TABLE IF NOT EXISTS meetings',
      'CREATE TABLE IF NOT EXISTS meeting_follow_ups',
      'createMeeting(',
      'addMeetingDecision(',
      'addMeetingFollowUp(',
      'updateMeetingFollowUpStatus(',
    ]),
  });

  checks.push({
    name: 'Meeting API exposes list create status and follow-up endpoints',
    pass: includesAll(meetingRoutes, [
      "router.get(\n  '/'",
      "router.post(\n  '/'",
      "'/:id/status'",
      "'/:id/decisions'",
      "'/:id/follow-ups'",
      "'/:meetingId/follow-ups/:followUpId'",
    ]) && includesAll(gateway, ['/api/meeting', 'meetingRoutes']),
  });

  checks.push({
    name: 'Meeting frontend uses shared API and governed notes instead of local-only storage',
    pass:
      includesAll(meetingHub, [
        'Api',
        'getMeetings',
        'createMeeting',
        'updateMeetingStatus',
        'generateMeetingNotes',
        'listMeetingNotes',
        'decideMeetingNote',
        "Shared workspace",
        'Nothing becomes a decision or follow-up before human approval.',
      ]) && !meetingHub.includes('consultify.meeting.module.v1'),
  });

  checks.push({
    name: 'Meeting executor schedules real meetings instead of throwing unavailable',
    pass:
      includesAll(meetingExecutor, [
        'createMeeting({',
        'Meeting execution requires organizationId',
        'action: \'schedule_meeting\'',
      ]) && !meetingExecutor.includes('Feature unavailable: MEETING_SCHEDULE execution is not implemented'),
  });

  checks.push({
    name: 'Frontend API layer includes meeting CRUD and governed-note helpers',
    pass: includesAll(api, [
      'getMeetings: async',
      'createMeeting: async',
      'updateMeetingStatus: async',
      'generateMeetingNotes: async',
      'listMeetingNotes: async',
      'decideMeetingNote: async',
    ]),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-v3-meeting-runtime] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-v3-meeting-runtime] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-v3-meeting-runtime] Failed:', (error as Error)?.message || error);
  process.exit(1);
}
