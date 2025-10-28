import dynamic from 'next/dynamic';

const UsersBrowser = dynamic(
  () => import('./components/UsersBrowser').then((module) => module.UsersBrowser),
  { ssr: false }
);

export const metadata = {
  title: 'User Administration',
};

export default function AdminUsersPage() {
  return <UsersBrowser />;
}

