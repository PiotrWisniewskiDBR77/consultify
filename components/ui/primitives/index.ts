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
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';

// Card
export {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  type CardProps,
  type CardHeaderProps,
  type CardVariant,
  type CardPadding,
} from './Card';

// Input
export { Input, type InputProps, type InputSize } from './Input';

// Modal
export {
  Modal,
  ConfirmModal,
  type ModalProps,
  type ConfirmModalProps,
  type ModalSize,
} from './Modal';

// Badge
export {
  Badge,
  NotificationBadge,
  type BadgeProps,
  type NotificationBadgeProps,
  type BadgeVariant,
  type BadgeSize,
} from './Badge';

// Avatar
export {
  Avatar,
  AvatarGroup,
  type AvatarProps,
  type AvatarGroupProps,
  type AvatarSize,
  type AvatarStatus,
} from './Avatar';

// Tooltip
export { Tooltip, type TooltipProps, type TooltipPlacement } from './Tooltip';

// Skeleton
export {
  Skeleton,
  CardSkeleton,
  TableRowSkeleton,
  AvatarGroupSkeleton,
  type SkeletonProps,
  type CardSkeletonProps,
  type TableRowSkeletonProps,
  type AvatarGroupSkeletonProps,
  type SkeletonVariant,
} from './Skeleton';

// Spinner
export {
  Spinner,
  LoadingOverlay,
  InlineLoader,
  type SpinnerProps,
  type LoadingOverlayProps,
  type InlineLoaderProps,
  type SpinnerSize,
  type SpinnerColor,
} from './Spinner';

// Progress
export {
  Progress,
  ProgressSteps,
  type ProgressProps,
  type ProgressStepsProps,
  type ProgressVariant,
  type ProgressSize,
  type ProgressColor,
} from './Progress';

// Tabs
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentProps,
} from './Tabs';

// Dropdown
export {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
  Select,
  type DropdownProps,
  type DropdownTriggerProps,
  type DropdownContentProps,
  type DropdownItemProps,
  type SelectProps,
} from './Dropdown';

// Drawer
export {
  Drawer,
  DrawerHeader,
  DrawerContent,
  DrawerFooter,
  type DrawerProps,
  type DrawerHeaderProps,
  type DrawerPosition,
  type DrawerSize,
} from './Drawer';

// Toast
export {
  ToastProvider,
  ToastInitializer,
  useToast,
  toast,
  type ToastProviderProps,
  type Toast,
  type ToastType,
  type ToastPosition,
} from './Toast';


