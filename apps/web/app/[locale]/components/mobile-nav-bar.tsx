'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, Database, Settings, User } from 'lucide-react';

const navItems = [
  { href: '/en', icon: Home, label: 'Home' },
  { href: '/en/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/en/data', icon: Database, label: 'Data' },
  { href: '/en/settings', icon: Settings, label: 'Settings' },
  { href: '/en/dashboard/general', icon: User, label: 'Profile' },
];

export function MobileNavBar() {
  const pathname = usePathname();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950 pb-safe md:hidden">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.includes(item.href) && item.href !== '/en';
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] flex-1 transition-colors ${
                isActive ? 'text-orange-500' : 'text-slate-400'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
