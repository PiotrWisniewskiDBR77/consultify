/**
 * Toggle — canonical alias of the primitive `Switch`.
 *
 * Some modules refer to the boolean control as a "toggle"; this re-export keeps
 * a single implementation (the token-enforcing `Switch`) while letting callers
 * import whichever name reads best at the call site.
 */

export type { SwitchProps as ToggleProps } from './Switch';
export { default, Switch as Toggle } from './Switch';
