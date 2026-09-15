export interface ServerPayloadMessage {
  en: string;
  pl: string;
  runtime?: boolean;
}

import { SERVER_PAYLOAD_MESSAGES_BATCH_01 } from './batch01.js';

export const SERVER_PAYLOAD_MESSAGES: readonly ServerPayloadMessage[] = [
  ...SERVER_PAYLOAD_MESSAGES_BATCH_01,
];
