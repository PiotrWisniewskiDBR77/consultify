/**
 * PromptsLibraryTab - Development > Prompts Library
 * Wrapper for PromptManagementUI
 */

import React from 'react';

import { PromptManagementUI } from '../../../../components/Admin/PromptManagementUI';

export const PromptsLibraryTab: React.FC = () => {
  return (
    <div className="p-6 overflow-y-auto h-full">
      <PromptManagementUI />
    </div>
  );
};

export default PromptsLibraryTab;
