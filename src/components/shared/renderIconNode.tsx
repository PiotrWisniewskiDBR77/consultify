import React from 'react';

export type IconNode =
  | React.ReactNode
  | React.ComponentType<any>
  // forwardRef/memo components are objects with $$typeof
  | { $$typeof?: unknown };

export function renderIconNode(icon: IconNode, props?: Record<string, unknown>): React.ReactNode {
  if (!icon) return null;

  if (React.isValidElement(icon)) {
    return icon;
  }

  if (typeof icon === 'function') {
    return React.createElement(icon as React.ComponentType<any>, props ?? {});
  }

  if (typeof icon === 'object' && (icon as any)?.$$typeof) {
    // React.forwardRef / React.memo return objects that are valid element types.
    return React.createElement(icon as any, props ?? {});
  }

  return icon as React.ReactNode;
}

import React from 'react';

export type IconNode =
  | React.ReactNode
  | React.ComponentType<any>
  // forwardRef/memo components are objects with $$typeof
  | { $$typeof?: unknown };

export function renderIconNode(icon: IconNode, props?: Record<string, unknown>): React.ReactNode {
  if (!icon) return null;

  if (React.isValidElement(icon)) {
    return icon;
  }

  if (typeof icon === 'function') {
    return React.createElement(icon as React.ComponentType<any>, props ?? {});
  }

  if (typeof icon === 'object' && (icon as any)?.$$typeof) {
    // React.forwardRef / React.memo return objects that are valid element types.
    return React.createElement(icon as any, props ?? {});
  }

  return icon as React.ReactNode;
}

