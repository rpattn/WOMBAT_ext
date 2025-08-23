import { Suspense, lazy } from 'react';

const RestClient = lazy(() => import('../components/RestClient'));

export default function ConnectionManager() {
  return (
    <div className="app-container app-full" style={{ minHeight: '0px' }}>
        <Suspense fallback={null}>
          <RestClient />
        </Suspense>
    </div>
  );
}
