import dynamic from 'next/dynamic';

const DataExplorerView = dynamic(() =>
  import('./components/DataExplorerView').then((module) => module.default),
  { ssr: false }
);

export const metadata = {
  title: 'Data Explorer',
};

export default function DataExplorerPage() {
  return <DataExplorerView />;
}
