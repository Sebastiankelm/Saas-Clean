'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
} from '@saas-clean/ui';
import { customerPortalAction } from '@/lib/payments/actions';
import { useActionState, Suspense } from 'react';
import useSWR from 'swr';
import type { TeamDataWithMembers, User } from '@/lib/db/schema';
import {
  inviteTeamMember,
  removeTeamMember,
} from '@/app/[locale]/(auth)/actions';
import { Loader2, PlusCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

type ActionState = {
  error?: string;
  success?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function SubscriptionSkeleton() {
  const t = useTranslations('dashboard.subscription');
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function ManageSubscription() {
  const { data: teamData } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const t = useTranslations('dashboard.subscription');
  const status = teamData?.billingSummary?.subscription_status;

  const statusLabel = (() => {
    if (status === 'active') {
      return t('status.active');
    }
    if (status === 'trialing') {
      return t('status.trialing');
    }
    return t('status.none');
  })();

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col items-start justify-between sm:flex-row sm:items-center">
            <div className="mb-4 sm:mb-0">
              <p className="font-medium text-gray-900 dark:text-white">
                {t('currentPlan', {
                  plan: teamData?.billingSummary?.plan_name || t('free'),
                })}
              </p>
              <p className="text-sm text-muted-foreground">{statusLabel}</p>
            </div>
            <form action={customerPortalAction}>
              <Button type="submit" variant="outline" className="rounded-full">
                {t('manage')}
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamMembersSkeleton() {
  const t = useTranslations('dashboard.members');
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mt-1 space-y-4 animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="size-8 rounded-full bg-gray-200 dark:bg-gray-800" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-14 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamMembers() {
  const { data: teamData } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const [removeState, removeAction, isRemovePending] = useActionState<
    ActionState,
    FormData
  >(removeTeamMember, {});
  const t = useTranslations('dashboard.members');

  const getUserDisplayName = (user: Pick<User, 'id' | 'name' | 'email'>) => {
    return user.name || user.email || t('unknown');
  };

  if (!teamData?.teamMembers?.length) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t('empty')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {teamData.teamMembers.map((member, index) => (
            <li key={member.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Avatar>
                  <AvatarImage alt={getUserDisplayName(member.user)} />
                  <AvatarFallback>
                    {getUserDisplayName(member.user)
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {getUserDisplayName(member.user)}
                  </p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {member.role}
                  </p>
                </div>
              </div>
              {index > 1 ? (
                <form action={removeAction}>
                  <input type="hidden" name="memberId" value={member.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={isRemovePending}
                  >
                    {isRemovePending ? t('removing') : t('remove')}
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {removeState?.error && (
          <p className="mt-4 text-sm text-red-500">{removeState.error}</p>
        )}
        {removeState?.success && (
          <p className="mt-4 text-sm text-green-500">{t('removed')}</p>
        )}
      </CardContent>
    </Card>
  );
}

function InviteTeamMemberSkeleton() {
  const t = useTranslations('dashboard.invite');
  return (
    <Card className="h-[260px]">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function InviteTeamMember() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const isOwner = user?.role === 'owner';
  const [inviteState, inviteAction, isInvitePending] = useActionState<
    ActionState,
    FormData
  >(inviteTeamMember, {});
  const t = useTranslations('dashboard.invite');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={inviteAction} className="space-y-4">
          <div>
            <Label htmlFor="email" className="mb-2">
              {t('emailLabel')}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              required
              disabled={!isOwner}
            />
          </div>
          <div>
            <Label>{t('roleLabel')}</Label>
            <RadioGroup
              defaultValue="member"
              name="role"
              className="mt-2 flex space-x-4"
              disabled={!isOwner}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="member" id="member" />
                <Label htmlFor="member">{t('roles.member')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="owner" id="owner" />
                <Label htmlFor="owner">{t('roles.owner')}</Label>
              </div>
            </RadioGroup>
          </div>
          {inviteState?.error && (
            <p className="text-sm text-red-500">{inviteState.error}</p>
          )}
          {inviteState?.success && (
            <p className="text-sm text-green-500">{t('invited')}</p>
          )}
          <Button
            type="submit"
            className="rounded-full bg-orange-500 text-white hover:bg-orange-600"
            disabled={isInvitePending || !isOwner}
          >
            {isInvitePending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('submitting')}
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('submit')}
              </>
            )}
          </Button>
        </form>
      </CardContent>
      {!isOwner && (
        <CardFooter>
          <p className="text-sm text-muted-foreground">{t('ownerOnly')}</p>
        </CardFooter>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const t = useTranslations('dashboard');
  return (
    <section className="flex-1 bg-white p-4 dark:bg-gray-950 lg:p-8">
      <h1 className="mb-6 text-lg font-medium text-gray-900 dark:text-white lg:text-2xl">
        {t('title')}
      </h1>
      <Suspense fallback={<SubscriptionSkeleton />}>
        <ManageSubscription />
      </Suspense>
      <Suspense fallback={<TeamMembersSkeleton />}>
        <TeamMembers />
      </Suspense>
      <Suspense fallback={<InviteTeamMemberSkeleton />}>
        <InviteTeamMember />
      </Suspense>
    </section>
  );
}
