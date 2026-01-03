/**
 * UI Component Types
 * Enterprise SaaS Architecture - Shared Component Props
 */

import { ReactNode, MouseEvent, KeyboardEvent, ChangeEvent, FocusEvent } from 'react';

// ==========================================
// COMMON PROP TYPES
// ==========================================

/**
 * Base props for all components
 */
export interface BaseProps {
    className?: string;
    style?: React.CSSProperties;
    id?: string;
    'data-testid'?: string;
}

/**
 * Children prop
 */
export interface WithChildren {
    children?: ReactNode;
}

/**
 * Loading state prop
 */
export interface WithLoading {
    isLoading?: boolean;
    loadingText?: string;
}

/**
 * Disabled state prop
 */
export interface WithDisabled {
    disabled?: boolean;
    disabledReason?: string;
}

/**
 * Error state prop
 */
export interface WithError {
    error?: string | null;
    isError?: boolean;
}

// ==========================================
// SIZE & VARIANT TYPES
// ==========================================

export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type ColorVariant = 
    | 'primary' 
    | 'secondary' 
    | 'success' 
    | 'warning' 
    | 'danger' 
    | 'info' 
    | 'neutral';

export type ButtonVariant = 
    | 'solid' 
    | 'outline' 
    | 'ghost' 
    | 'link' 
    | 'soft';

export type InputVariant = 
    | 'outline' 
    | 'filled' 
    | 'flushed' 
    | 'unstyled';

export type BadgeVariant = 
    | 'solid' 
    | 'subtle' 
    | 'outline';

// ==========================================
// BUTTON PROPS
// ==========================================

export interface ButtonProps extends BaseProps, WithChildren, WithLoading, WithDisabled {
    variant?: ButtonVariant;
    color?: ColorVariant;
    size?: Size;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    isFullWidth?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

export interface IconButtonProps extends BaseProps, WithLoading, WithDisabled {
    icon: ReactNode;
    'aria-label': string;
    variant?: ButtonVariant;
    color?: ColorVariant;
    size?: Size;
    isRound?: boolean;
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

// ==========================================
// INPUT PROPS
// ==========================================

export interface InputProps extends BaseProps, WithDisabled, WithError {
    value?: string;
    defaultValue?: string;
    placeholder?: string;
    type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search';
    size?: Size;
    variant?: InputVariant;
    leftElement?: ReactNode;
    rightElement?: ReactNode;
    isRequired?: boolean;
    isReadOnly?: boolean;
    autoFocus?: boolean;
    autoComplete?: string;
    maxLength?: number;
    pattern?: string;
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
    onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
    onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export interface TextareaProps extends BaseProps, WithDisabled, WithError {
    value?: string;
    defaultValue?: string;
    placeholder?: string;
    rows?: number;
    size?: Size;
    variant?: InputVariant;
    isRequired?: boolean;
    isReadOnly?: boolean;
    autoFocus?: boolean;
    maxLength?: number;
    resize?: 'none' | 'vertical' | 'horizontal' | 'both';
    onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    onBlur?: (e: FocusEvent<HTMLTextAreaElement>) => void;
    onFocus?: (e: FocusEvent<HTMLTextAreaElement>) => void;
}

export interface SelectOption<T = string> {
    value: T;
    label: string;
    disabled?: boolean;
    icon?: ReactNode;
    description?: string;
}

export interface SelectProps<T = string> extends BaseProps, WithDisabled, WithError {
    options: SelectOption<T>[];
    value?: T;
    defaultValue?: T;
    placeholder?: string;
    size?: Size;
    variant?: InputVariant;
    isRequired?: boolean;
    isSearchable?: boolean;
    isClearable?: boolean;
    isMulti?: boolean;
    onChange?: (value: T | T[] | null) => void;
    onBlur?: () => void;
}

// ==========================================
// FORM PROPS
// ==========================================

export interface FormFieldProps extends BaseProps {
    label?: string;
    helperText?: string;
    error?: string;
    isRequired?: boolean;
    isInvalid?: boolean;
    children: ReactNode;
}

export interface FormProps extends BaseProps, WithChildren {
    onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
    isSubmitting?: boolean;
}

// ==========================================
// MODAL & DIALOG PROPS
// ==========================================

export interface ModalProps extends BaseProps, WithChildren {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    closeOnOverlayClick?: boolean;
    closeOnEsc?: boolean;
    showCloseButton?: boolean;
    initialFocusRef?: React.RefObject<HTMLElement>;
    finalFocusRef?: React.RefObject<HTMLElement>;
}

export interface ConfirmDialogProps extends ModalProps {
    confirmText?: string;
    cancelText?: string;
    variant?: 'info' | 'warning' | 'danger';
    onConfirm: () => void | Promise<void>;
    isConfirming?: boolean;
}

export interface DrawerProps extends ModalProps {
    placement?: 'left' | 'right' | 'top' | 'bottom';
}

// ==========================================
// TABLE PROPS
// ==========================================

export interface TableColumn<T> {
    id: string;
    header: string | ReactNode;
    accessor: keyof T | ((row: T) => ReactNode);
    width?: string | number;
    minWidth?: string | number;
    maxWidth?: string | number;
    sortable?: boolean;
    filterable?: boolean;
    align?: 'left' | 'center' | 'right';
    sticky?: 'left' | 'right';
    render?: (value: unknown, row: T, index: number) => ReactNode;
}

export interface TableProps<T> extends BaseProps, WithLoading {
    data: T[];
    columns: TableColumn<T>[];
    keyField: keyof T;
    selectable?: boolean;
    selectedRows?: T[];
    onSelectionChange?: (rows: T[]) => void;
    sortable?: boolean;
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc';
    onSort?: (column: string, direction: 'asc' | 'desc') => void;
    pagination?: PaginationProps;
    emptyState?: ReactNode;
    stickyHeader?: boolean;
    striped?: boolean;
    hoverable?: boolean;
    compact?: boolean;
    onRowClick?: (row: T, index: number) => void;
}

export interface PaginationProps {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
    showPageSizeSelector?: boolean;
    showTotalCount?: boolean;
}

// ==========================================
// LIST & CARD PROPS
// ==========================================

export interface ListProps<T> extends BaseProps, WithLoading {
    items: T[];
    renderItem: (item: T, index: number) => ReactNode;
    keyExtractor: (item: T, index: number) => string;
    emptyState?: ReactNode;
    gap?: Size;
    direction?: 'vertical' | 'horizontal';
}

export interface CardProps extends BaseProps, WithChildren {
    variant?: 'elevated' | 'outline' | 'filled' | 'unstyled';
    padding?: Size;
    onClick?: () => void;
    isHoverable?: boolean;
    isSelectable?: boolean;
    isSelected?: boolean;
}

// ==========================================
// FEEDBACK PROPS
// ==========================================

export type ToastStatus = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
    id?: string;
    title?: string;
    description?: string;
    status: ToastStatus;
    duration?: number;
    isClosable?: boolean;
    position?: 'top' | 'top-right' | 'top-left' | 'bottom' | 'bottom-right' | 'bottom-left';
    icon?: ReactNode;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export interface AlertProps extends BaseProps, WithChildren {
    status: ToastStatus;
    variant?: 'subtle' | 'solid' | 'left-accent' | 'top-accent';
    title?: string;
    description?: string;
    icon?: ReactNode;
    isClosable?: boolean;
    onClose?: () => void;
}

export interface ProgressProps extends BaseProps {
    value: number;
    max?: number;
    size?: Size;
    color?: ColorVariant;
    variant?: 'determinate' | 'indeterminate';
    showValue?: boolean;
    valueFormat?: (value: number, max: number) => string;
    label?: string;
    isAnimated?: boolean;
}

export interface SpinnerProps extends BaseProps {
    size?: Size;
    color?: ColorVariant;
    thickness?: string;
    speed?: string;
    label?: string;
}

// ==========================================
// TOOLTIP & POPOVER PROPS
// ==========================================

export interface TooltipProps extends WithChildren {
    content: ReactNode;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    disabled?: boolean;
    hasArrow?: boolean;
}

export interface PopoverProps extends WithChildren {
    content: ReactNode;
    isOpen?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    trigger?: 'click' | 'hover';
    closeOnBlur?: boolean;
    hasArrow?: boolean;
}

// ==========================================
// NAVIGATION PROPS
// ==========================================

export interface TabItem {
    id: string;
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
    badge?: string | number;
    content?: ReactNode;
}

export interface TabsProps extends BaseProps {
    items: TabItem[];
    activeTab?: string;
    defaultTab?: string;
    onChange?: (tabId: string) => void;
    variant?: 'line' | 'enclosed' | 'soft-rounded' | 'solid-rounded';
    size?: Size;
    orientation?: 'horizontal' | 'vertical';
    isFitted?: boolean;
    isLazy?: boolean;
}

export interface BreadcrumbItem {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: ReactNode;
}

export interface BreadcrumbProps extends BaseProps {
    items: BreadcrumbItem[];
    separator?: ReactNode;
    maxItems?: number;
}

export interface StepperProps extends BaseProps {
    steps: StepItem[];
    activeStep: number;
    orientation?: 'horizontal' | 'vertical';
    size?: Size;
    colorScheme?: ColorVariant;
    onStepClick?: (index: number) => void;
}

export interface StepItem {
    title: string;
    description?: string;
    icon?: ReactNode;
    isCompleted?: boolean;
    isError?: boolean;
}

// ==========================================
// AVATAR & BADGE PROPS
// ==========================================

export interface AvatarProps extends BaseProps {
    src?: string;
    name?: string;
    size?: Size;
    showBorder?: boolean;
    status?: 'online' | 'offline' | 'away' | 'busy';
    onClick?: () => void;
}

export interface AvatarGroupProps extends BaseProps {
    avatars: AvatarProps[];
    max?: number;
    size?: Size;
    spacing?: number;
}

export interface BadgeProps extends BaseProps, WithChildren {
    variant?: BadgeVariant;
    color?: ColorVariant;
    size?: Size;
    rounded?: boolean;
}

// ==========================================
// SKELETON PROPS
// ==========================================

export interface SkeletonProps extends BaseProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string;
    isLoaded?: boolean;
    children?: ReactNode;
}

export interface SkeletonTextProps extends BaseProps {
    lines?: number;
    spacing?: Size;
    startColor?: string;
    endColor?: string;
}

// ==========================================
// EMPTY STATE & ERROR STATE PROPS
// ==========================================

export interface EmptyStateProps extends BaseProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
        variant?: ButtonVariant;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
}

export interface ErrorStateProps extends BaseProps {
    title?: string;
    message: string;
    details?: string;
    onRetry?: () => void;
    onBack?: () => void;
    showReportButton?: boolean;
}

// ==========================================
// DRAG & DROP PROPS
// ==========================================

export interface DraggableItemProps<T> extends BaseProps {
    item: T;
    index: number;
    isDragging?: boolean;
    isDropTarget?: boolean;
    onDragStart?: (item: T, index: number) => void;
    onDragEnd?: () => void;
    renderItem: (item: T, isDragging: boolean) => ReactNode;
}

export interface DroppableAreaProps<T> extends BaseProps, WithChildren {
    id: string;
    items: T[];
    onDrop?: (item: T, targetIndex: number) => void;
    onReorder?: (items: T[]) => void;
    direction?: 'vertical' | 'horizontal';
    isDropDisabled?: boolean;
}

// ==========================================
// CHART PROPS
// ==========================================

export interface ChartDataPoint {
    label: string;
    value: number;
    color?: string;
    metadata?: Record<string, unknown>;
}

export interface LineChartProps extends BaseProps {
    data: ChartDataPoint[];
    xAxisLabel?: string;
    yAxisLabel?: string;
    showGrid?: boolean;
    showLegend?: boolean;
    showTooltip?: boolean;
    height?: number;
    colors?: string[];
    curved?: boolean;
    showArea?: boolean;
}

export interface BarChartProps extends BaseProps {
    data: ChartDataPoint[];
    xAxisLabel?: string;
    yAxisLabel?: string;
    showGrid?: boolean;
    showLegend?: boolean;
    showTooltip?: boolean;
    height?: number;
    colors?: string[];
    horizontal?: boolean;
    stacked?: boolean;
}

export interface PieChartProps extends BaseProps {
    data: ChartDataPoint[];
    showLegend?: boolean;
    showTooltip?: boolean;
    showLabels?: boolean;
    height?: number;
    colors?: string[];
    donut?: boolean;
    donutWidth?: number;
}


