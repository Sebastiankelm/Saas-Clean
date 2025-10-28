import Link from 'next/link';
import { Database, Users, CreditCard, FileText, Building2 } from 'lucide-react';

const AVAILABLE_TABLES = [
  { schema: 'public', table: 'users', icon: Users, displayName: 'Users' },
  { schema: 'public', table: 'teams', icon: Building2, displayName: 'Teams' },
  { schema: 'public', table: 'subscriptions', icon: CreditCard, displayName: 'Subscriptions' },
  { schema: 'public', table: 'activity_logs', icon: FileText, displayName: 'Activity Logs' },
];

export default function DataExplorerPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Data Explorer</h1>
        <p className="text-slate-400 mt-2">Browse and manage your database tables</p>
      </header>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Database className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search tables..."
            className="w-full bg-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AVAILABLE_TABLES.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.table}
              href={`/data/${item.table}`}
              className="block p-6 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700 hover:border-orange-500"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Icon className="h-6 w-6 text-orange-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold">{item.displayName}</h2>
                  <p className="text-sm text-slate-400">{item.schema}.{item.table}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                <span className="text-sm text-slate-400">Records</span>
                <span className="text-lg font-bold text-white">—</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
