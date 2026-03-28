import React from 'react';
import { Navigate } from 'react-router-dom';

import { ROUTES } from '../../routes/routeConfig';

export const DirectoryView: React.FC = () => (
  <Navigate replace to={`${ROUTES.PARTNER.LANDING}?tab=public-listing`} />
);

export default DirectoryView;
