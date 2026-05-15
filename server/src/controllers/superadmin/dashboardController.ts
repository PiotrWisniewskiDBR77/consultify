import { AppError, type AuthenticatedRequest, catchAsync, deps } from './shared.js';

/**
 * Get all dashboards
 */
export const getDashboards = catchAsync(async (req, res, next) => {
  const { isShared } = req.query;
  const dashboards = await deps.DashboardBuilderService.getDashboards({
    createdBy: (req as AuthenticatedRequest).user!.id,
    isShared: isShared === 'true' ? true : isShared === 'false' ? false : undefined,
  });
  res.json(dashboards);
});

/**
 * Get dashboard statistics
 */
export const getDashboardBuilderStats = catchAsync(async (req, res, next) => {
  const stats = await deps.DashboardBuilderService.getStats();
  res.json(stats);
});

/**
 * Get dashboard by ID
 */
export const getDashboardById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const dashboard = await deps.DashboardBuilderService.getDashboardById(id);
  if (!dashboard) {
    return next(new AppError('Dashboard not found', 404));
  }
  res.json(dashboard);
});

/**
 * Create a new dashboard
 */
export const createDashboard = catchAsync(async (req, res, next) => {
  const { name, description, layout, widgets, isShared } = req.body;

  if (!name) {
    return next(new AppError('Dashboard name is required', 400));
  }

  const dashboard = await deps.DashboardBuilderService.createDashboard({
    name,
    description,
    layout,
    widgets,
    isShared,
    createdBy: (req as AuthenticatedRequest).user!.id,
  });

  res.status(201).json(dashboard);
});

/**
 * Update a dashboard
 */
export const updateDashboard = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, layout, widgets, isShared } = req.body;

  const updated = await deps.DashboardBuilderService.updateDashboard(id, {
    name,
    description,
    layout,
    widgets,
    isShared,
  });

  if (!updated) {
    return next(new AppError('Dashboard not found or no changes made', 404));
  }

  const dashboard = await deps.DashboardBuilderService.getDashboardById(id);
  res.json(dashboard);
});

/**
 * Clone a dashboard
 */
export const cloneDashboard = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name } = req.body;

  const cloned = await deps.DashboardBuilderService.cloneDashboard(
    id,
    name,
    (req as AuthenticatedRequest).user!.id
  );

  if (!cloned) {
    return next(new AppError('Dashboard not found', 404));
  }

  res.status(201).json(cloned);
});

/**
 * Toggle dashboard sharing
 */
export const toggleDashboardShare = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { isShared } = req.body;

  const toggled = await deps.DashboardBuilderService.toggleShare(id, isShared);

  if (!toggled) {
    return next(new AppError('Dashboard not found', 404));
  }

  const dashboard = await deps.DashboardBuilderService.getDashboardById(id);
  res.json(dashboard);
});

/**
 * Delete a dashboard
 */
export const deleteDashboard = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const deleted = await deps.DashboardBuilderService.deleteDashboard(id);

  if (!deleted) {
    return next(new AppError('Dashboard not found', 404));
  }

  res.json({ success: true, message: 'Dashboard deleted successfully' });
});

/**
 * Add widget to dashboard
 */
export const addDashboardWidget = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const widget = req.body;

  const newWidget = await deps.DashboardBuilderService.addWidget(id, widget);

  if (!newWidget) {
    return next(new AppError('Dashboard not found', 404));
  }

  res.status(201).json(newWidget);
});

/**
 * Update widget in dashboard
 */
export const updateDashboardWidget = catchAsync(async (req, res, next) => {
  const { id, widgetId } = req.params;
  const updates = req.body;

  const updated = await deps.DashboardBuilderService.updateWidget(id, widgetId, updates);

  if (!updated) {
    return next(new AppError('Dashboard or widget not found', 404));
  }

  const dashboard = await deps.DashboardBuilderService.getDashboardById(id);
  res.json(dashboard);
});

/**
 * Remove widget from dashboard
 */
export const removeDashboardWidget = catchAsync(async (req, res, next) => {
  const { id, widgetId } = req.params;

  const removed = await deps.DashboardBuilderService.removeWidget(id, widgetId);

  if (!removed) {
    return next(new AppError('Dashboard or widget not found', 404));
  }

  res.json({ success: true, message: 'Widget removed successfully' });
});

/**
 * Reorder widgets in dashboard
 */
export const reorderDashboardWidgets = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { widgetOrder } = req.body;

  if (!widgetOrder || !Array.isArray(widgetOrder)) {
    return next(new AppError('Widget order array is required', 400));
  }

  const reordered = await deps.DashboardBuilderService.reorderWidgets(id, widgetOrder);

  if (!reordered) {
    return next(new AppError('Dashboard not found', 404));
  }

  const dashboard = await deps.DashboardBuilderService.getDashboardById(id);
  res.json(dashboard);
});

/**
 * Get widget data
 */
export const getDashboardWidgetData = catchAsync(async (req, res, next) => {
  const widget = req.body;

  if (!widget.dataSource) {
    return next(new AppError('Widget data source is required', 400));
  }

  const data = await deps.DashboardBuilderService.getWidgetData(widget);
  res.json(data);
});
