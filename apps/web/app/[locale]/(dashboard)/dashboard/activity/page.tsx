import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@saas-clean/ui';
import {
  Settings,
  LogOut,
  UserPlus,
  Lock,
  UserCog,
  AlertCircle,
  UserMinus,
  Mail,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react';
import { ActivityType } from '@/lib/db/schema';
import { getActivityLogs } from '@/lib/db/queries';
import { getTranslations, getLocale } from 'next-intl/server';

const iconMap: Record<ActivityType, LucideIcon> = {
  [ActivityType.SIGN_UP]: UserPlus,
  [ActivityType.SIGN_IN]: UserCog,
  [ActivityType.SIGN_OUT]: LogOut,
  [ActivityType.UPDATE_PASSWORD]: Lock,
  [ActivityType.DELETE_ACCOUNT]: UserMinus,
  [ActivityType.UPDATE_ACCOUNT]: Settings,
  [ActivityType.CREATE_TEAM]: UserPlus,
  [ActivityType.REMOVE_TEAM_MEMBER]: UserMinus,
  [ActivityType.INVITE_TEAM_MEMBER]: Mail,
  [ActivityType.ACCEPT_INVITATION]: CheckCircle,
};

function createRelativeTimeFormatter(locale: string) {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  return (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);

    const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
      [60, 'second'],
      [60, 'minute'],
      [24, 'hour'],
      [7, 'day'],
      [4.34524, 'week'],
      [12, 'month'],
      [Number.POSITIVE_INFINITY, 'year'],
    ];

    let duration = diffInSeconds;

    for (const [amount, unit] of divisions) {
      if (Math.abs(duration) < amount) {
        return formatter.format(Math.round(duration), unit);
      }
      duration /= amount;
    }

    return formatter.format(Math.round(duration), 'year');
  };
}

export default async function ActivityPage() {
  const logs = await getActivityLogs();
  const locale = await getLocale();
  const t = await getTranslations('dashboard.activity');
  const formatRelativeTime = createRelativeTimeFormatter(locale);

  return (
    <section className="flex-1 bg-white p-4 dark:bg-gray-950 lg:p-8">
      <h1 className="mb-6 text-lg font-medium text-gray-900 dark:text-white lg:text-2xl">
        {t('title')}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('recent')}</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <ul className="space-y-4">
              {logs.map((log) => {
                const Icon = iconMap[log.action as ActivityType] || Settings;
                const actionKey = `actions.${log.action}` as Parameters<typeof t>[0];
                const formattedAction = t(actionKey, {
                  default: t('actions.default'),
                });

                return (
                  <li key={log.id} className="flex items-center space-x-4">
                    <div className="rounded-full bg-orange-100 p-2 dark:bg-orange-900/40">
                      <Icon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formattedAction}
                        {log.ip_address
                          ? ` ${t('fromIp', { ip: log.ip_address })}`
                          : null}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(new Date(log.occurred_at))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="mb-4 h-12 w-12 text-orange-500" />
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                {t('emptyTitle')}
              </h3>
              <p className="max-w-sm text-sm text-gray-600 dark:text-gray-300">
                {t('emptyDescription')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
