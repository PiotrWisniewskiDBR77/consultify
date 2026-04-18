/**
 * StructuredOutputBlock (production stub).
 *
 * Full V9 structured-envelope renderer is WIP on develop (uncommitted).
 * Call sites guard on envelope presence, which is only emitted by the
 * unreleased backend V9 structured-output surface — null is safe in prod.
 */

import React from 'react';

export interface StructuredOutputBlockProps {
  envelope?: unknown;
  [key: string]: unknown;
}

export const StructuredOutputBlock: React.FC<StructuredOutputBlockProps> = () => null;

export default StructuredOutputBlock;
