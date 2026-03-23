import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ScanSearch, BookOpen, Settings, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/scan', label: 'Scan & Review', icon: ScanSearch },
  { to: '/rules', label: 'Rules', icon: BookOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  return (
    <div className="flex flex-col w-64 border-r bg-gray-50 dark:bg-gray-900">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-blue-600" />
          <span className="font-semibold text-sm">Claude Learning Loop</span>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              location.pathname === to
                ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <p className="text-xs text-gray-500">CLL v5</p>
      </div>
    </div>
  );
}
