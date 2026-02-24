/**
 * CustomReportsTab - Analytics > Custom Reports
 * NEW: Report builder and scheduled reports
 */

import {
  BarChart2,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit,
  Eye,
  FileBarChart,
  FileDown,
  Filter,
  Grid,
  LayoutGrid,
  List,
  Mail,
  MoreVertical,
  PieChart,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Star,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import React from 'react';

import SavedReportsView from '../../../superadmin/analytics/SavedReportsView';

export const CustomReportsTab: React.FC = () => {
  // Reuse fully-wired SuperAdmin reports builder (real DB + execute + schedule).
  return <SavedReportsView />;
};

export default CustomReportsTab;
