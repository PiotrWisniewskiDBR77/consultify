export interface ServerPayloadMessage {
  en: string;
  pl: string;
  runtime?: boolean;
}

import { SERVER_PAYLOAD_MESSAGES_BATCH_01 } from './batch01.js';
import { SERVER_PAYLOAD_MESSAGES_BATCH_02 } from './batch02.js';
import { SERVER_PAYLOAD_MESSAGES_BATCH_03 } from './batch03.js';

export const SERVER_PAYLOAD_MESSAGES: readonly ServerPayloadMessage[] = [
  ...SERVER_PAYLOAD_MESSAGES_BATCH_01,
  ...SERVER_PAYLOAD_MESSAGES_BATCH_02,
  ...SERVER_PAYLOAD_MESSAGES_BATCH_03,
];
