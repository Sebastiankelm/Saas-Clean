import dynamic from 'next/dynamic';

const CmsManagerView = dynamic(() =>
  import('./components/CmsManagerView').then((module) => module.CmsManagerView),
  { ssr: false }
);

export const metadata = {
  title: 'CMS Manager',
};

export default function CmsPage() {
  return <CmsManagerView />;
}
