/**
 * UI Primitives - Apple HIG Design System
 *
 * A collection of atomic UI components following Apple Human Interface Guidelines.
 * These components serve as the foundation for building complex interfaces.
 *
 * @example
 * import { Button, Card, Input, Modal } from '@/components/ui/primitives';
 */

// Button
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button';

// Card
export {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    type CardHeaderProps,
    type CardPadding,
    type CardProps,
    type CardVariant,
} from './Card';

// Input
export { Input, type InputProps, type InputSize } from './Input';

// Modal
export { ConfirmModal, type ConfirmModalProps, Modal, type ModalProps, type ModalSize } from './Modal';

// Badge
export {
    Badge,
    type BadgeProps,
    type BadgeSize,
    type BadgeVariant,
    NotificationBadge,
    type NotificationBadgeProps,
} from './Badge';

// Avatar
export {
    Avatar,
    AvatarGroup,
    type AvatarGroupProps,
    type AvatarProps,
    type AvatarSize,
    type AvatarStatus,
} from './Avatar';

// Tooltip
export { Tooltip, type TooltipPlacement, type TooltipProps } from './Tooltip';

// Skeleton
export {
    AvatarGroupSkeleton,
    type AvatarGroupSkeletonProps,
    CardSkeleton,
    type CardSkeletonProps,
    Skeleton,
    type SkeletonProps,
    type SkeletonVariant,
    TableRowSkeleton,
    type TableRowSkeletonProps,
} from './Skeleton';

// Spinner
export {
    InlineLoader,
    type InlineLoaderProps,
    LoadingOverlay,
    type LoadingOverlayProps,
    Spinner,
    type SpinnerColor,
    type SpinnerProps,
    type SpinnerSize,
} from './Spinner';

// Progress
export {
    Progress,
    type ProgressColor,
    type ProgressProps,
    type ProgressSize,
    ProgressSteps,
    type ProgressStepsProps,
    type ProgressVariant,
} from './Progress';

// Tabs
export {
    Tabs,
    TabsContent,
    type TabsContentProps,
    TabsList,
    type TabsListProps,
    type TabsProps,
    TabsTrigger,
    type TabsTriggerProps,
} from './Tabs';

// Dropdown
export {
    Dropdown,
    DropdownContent,
    type DropdownContentProps,
    DropdownItem,
    type DropdownItemProps,
    DropdownLabel,
    type DropdownProps,
    DropdownSeparator,
    DropdownTrigger,
    type DropdownTriggerProps,
    Select,
    type SelectProps,
} from './Dropdown';

// Drawer
export {
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    type DrawerHeaderProps,
    type DrawerPosition,
    type DrawerProps,
    type DrawerSize,
} from './Drawer';

// Toast
export {
    type Toast,
    toast,
    ToastInitializer,
    type ToastPosition,
    ToastProvider,
    type ToastProviderProps,
    type ToastType,
    useToast,
} from './Toast';

// OptimizedImage
export { OptimizedImage, type OptimizedImageProps, ResponsiveImage, type ResponsiveImageProps } from './OptimizedImage';
