import type { NextFunction, Request, Response } from 'express';

import { localizeServerPayload } from '../i18n/serverPayloadLocalizer.js';

export function serverPayloadLocale(req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => json(localizeServerPayload(body, req))) as Response['json'];
  next();
}
