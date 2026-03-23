import { useLocation } from 'react-router-dom';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/scan': 'Scan & Review',
  '/rules': 'Rules',
  '/settings': 'Settings',
};

export function Header() {
  const location = useLocation();
  return (
    <header className="border-b px-6 py-4 flex items-center justify-between bg-white dark:bg-gray-950">
      <h1 className="text-lg font-semibold">{titles[location.pathname] ?? 'Claude Learning Loop'}</h1>
    </header>
  );
}
