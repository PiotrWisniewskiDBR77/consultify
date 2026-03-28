import React from 'react';
import { Navigate } from 'react-router-dom';

import { ROUTES } from '../../routes/routeConfig';

export const ResourcesView: React.FC = () => (
  <Navigate replace to={`${ROUTES.PARTNER.LANDING}?tab=documentation`} />
);

export default ResourcesView;
