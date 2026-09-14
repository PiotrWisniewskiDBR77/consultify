import React from 'react';
import { useTranslation } from 'react-i18next';

interface ProjectRolePermissionCopyProps {
  can: string[];
  cannot: string[];
  translate?: (key: string, options?: { defaultValue?: string }) => string;
}

export const ProjectRolePermissionCopy: React.FC<ProjectRolePermissionCopyProps> = ({
  can,
  cannot,
  translate,
}) => {
  const { t } = useTranslation();
  const label = (permission: string) =>
    (translate || t)(`myWork.projects.permissions.${permission}`, { defaultValue: permission });
  const copy = translate || t;

  return (
    <p className="mt-0.5 text-c-text-secondary">
      {copy('myWork.projects.can', { defaultValue: 'Can' })}: {can.map(label).join(', ')} ·{' '}
      {copy('myWork.projects.cannot', { defaultValue: 'Cannot' })}: {cannot.map(label).join(', ')}
    </p>
  );
};
