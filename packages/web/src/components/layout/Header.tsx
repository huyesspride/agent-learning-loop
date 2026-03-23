import { useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Button } from '@/components/ui/button';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/scan': 'Scan & Review',
  '/rules': 'Rules',
  '/settings': 'Settings',
};

export function Header() {
  const location = useLocation();
  const { isDark, toggle } = useDarkMode();
  return (
    <header className="border-b px-6 py-4 flex items-center justify-between bg-white dark:bg-gray-950">
      <h1 className="text-lg font-semibold">{titles[location.pathname] ?? 'Claude Learning Loop'}</h1>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>
    </header>
  );
}
