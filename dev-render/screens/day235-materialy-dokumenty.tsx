/** Day 235: real Materials registry or Document Studio artifact, selected by `view`. */
import React from 'react';

import DocumentArtifactScreen from './document-artifact';
import MaterialsRegistryScreen from './materials-registry';

export default function Day235MaterialyDokumentyScreen(): React.ReactElement {
  const view = new URLSearchParams(window.location.search).get('view');
  return view === 'registry' ? <MaterialsRegistryScreen /> : <DocumentArtifactScreen />;
}
