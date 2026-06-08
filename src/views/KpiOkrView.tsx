import React from 'react';
import { Navigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

export const KpiOkrView: React.FC = () => <Navigate to={ROUTES.BENEFITS} replace />;
