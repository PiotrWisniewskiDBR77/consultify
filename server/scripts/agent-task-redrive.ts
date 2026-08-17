import { redriveAgentTask } from '../src/services/ai/agentTaskDispatchService.js';

const [receiptId, operatorId] = process.argv.slice(2);

if (!receiptId || !operatorId) {
  console.error('Usage: tsx server/scripts/agent-task-redrive.ts <receipt-id> <operator-id>');
  process.exit(2);
}

try {
  const result = await redriveAgentTask(receiptId, operatorId);
  console.log(JSON.stringify({
    receiptId: result.receiptId,
    bullJobId: result.bullJobId,
    status: result.status,
  }));
  process.exit(result.status === 'ENQUEUED' || result.status === 'REPLAY' ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
