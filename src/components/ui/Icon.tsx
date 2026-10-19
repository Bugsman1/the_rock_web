import ArrowLeftIcon from "@/icons/arrow-left.svg?react";
import ArrowRightIcon from "@/icons/arrow-right.svg?react";
import BackspaceIcon from "@/icons/backspace.svg?react";
import BellIcon from "@/icons/bell-simple.svg?react";
import BuildingBankIcon from "@/icons/bank.svg?react";
import CalculatorIcon from "@/icons/calculator.svg?react";
import CalendarIcon from "@/icons/calendar.svg?react";
import ChartBarIcon from "@/icons/chart-bar.svg?react";
import CheckIcon from "@/icons/check.svg?react";
import ChevronDownIcon from "@/icons/chevron-down.svg?react";
import CircleIcon from "@/icons/circle.svg?react";
import CircleCheckIcon from "@/icons/circle-check.svg?react";
import ClockIcon from "@/icons/clock.svg?react";
import EyeIcon from "@/icons/eye.svg?react";
import EyeOffIcon from "@/icons/eye-off.svg?react";
import FileTypePdfIcon from "@/icons/file-type-pdf.svg?react";
import FlagFrIcon from "@/icons/flag-fr.svg?react";
import FlagMrIcon from "@/icons/flag-mr.svg?react";
import FlameIcon from "@/icons/flame.svg?react";
import HistoryIcon from "@/icons/history.svg?react";
import IdBadgeIcon from "@/icons/id-badge.svg?react";
import LayoutDashboardIcon from "@/icons/layout-dashboard.svg?react";
import LockPasswordIcon from "@/icons/lock-password.svg?react";
import LogoutIcon from "@/icons/logout.svg?react";
import MenuIcon from "@/icons/list.svg?react";
import MillIcon from "@/icons/mill.svg?react";
import MinusIcon from "@/icons/minus.svg?react";
import PackagesIcon from "@/icons/packages.svg?react";
import PencilIcon from "@/icons/pencil.svg?react";
import PlayerPlayIcon from "@/icons/player-play.svg?react";
import PlusIcon from "@/icons/plus.svg?react";
import ReceiptIcon from "@/icons/receipt.svg?react";
import RefreshIcon from "@/icons/refresh.svg?react";
import SearchIcon from "@/icons/magnifying-glass.svg?react";
import SettingsIcon from "@/icons/settings.svg?react";
import ShieldLockIcon from "@/icons/shield-lock.svg?react";
import ShoppingBagIcon from "@/icons/bag-simple.svg?react";
import ToolIcon from "@/icons/tool.svg?react";
import TrashIcon from "@/icons/trash.svg?react";
import TruckDeliveryIcon from "@/icons/truck-delivery.svg?react";
import UserIcon from "@/icons/user.svg?react";
import UsersIcon from "@/icons/users.svg?react";
import UsersFourIcon from "@/icons/users-four.svg?react";
import WarehouseIcon from "@/icons/warehouse.svg?react";
import WorldIcon from "@/icons/globe.svg?react";
import XIcon from "@/icons/x.svg?react";
import { cn } from "@/lib/cn";

const glyphs = {
  "arrow-left": ArrowLeftIcon,
  "arrow-right": ArrowRightIcon,
  backspace: BackspaceIcon,
  bell: BellIcon,
  "building-bank": BuildingBankIcon,
  calculator: CalculatorIcon,
  calendar: CalendarIcon,
  "chart-bar": ChartBarIcon,
  check: CheckIcon,
  "chevron-down": ChevronDownIcon,
  circle: CircleIcon,
  "circle-check": CircleCheckIcon,
  clock: ClockIcon,
  eye: EyeIcon,
  "eye-off": EyeOffIcon,
  "file-type-pdf": FileTypePdfIcon,
  "flag-fr": FlagFrIcon,
  "flag-mr": FlagMrIcon,
  flame: FlameIcon,
  history: HistoryIcon,
  "id-badge": IdBadgeIcon,
  "layout-dashboard": LayoutDashboardIcon,
  "lock-password": LockPasswordIcon,
  logout: LogoutIcon,
  menu: MenuIcon,
  mill: MillIcon,
  minus: MinusIcon,
  packages: PackagesIcon,
  pencil: PencilIcon,
  "player-play": PlayerPlayIcon,
  plus: PlusIcon,
  receipt: ReceiptIcon,
  refresh: RefreshIcon,
  search: SearchIcon,
  settings: SettingsIcon,
  "shield-lock": ShieldLockIcon,
  "shopping-bag": ShoppingBagIcon,
  tool: ToolIcon,
  trash: TrashIcon,
  "truck-delivery": TruckDeliveryIcon,
  user: UserIcon,
  users: UsersIcon,
  "users-four": UsersFourIcon,
  warehouse: WarehouseIcon,
  world: WorldIcon,
  x: XIcon,
} as const;

export type IconName = keyof typeof glyphs;

const directionalGlyphs: ReadonlySet<IconName> = new Set([
  "arrow-left",
  "arrow-right",
  "backspace",
  "logout",
]);

type IconProps = {
  name: IconName;
  title?: string;
  className?: string;
};

export function Icon({ name, title, className }: IconProps) {
  const Glyph = glyphs[name];
  const classes = cn(
    "h-5 w-5 shrink-0",
    directionalGlyphs.has(name) && "rtl:-scale-x-100",
    className,
  );

  if (title === undefined) {
    return <Glyph className={classes} focusable="false" aria-hidden />;
  }

  return <Glyph className={classes} focusable="false" role="img" title={title} />;
}
