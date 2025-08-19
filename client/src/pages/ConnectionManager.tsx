import { Suspense, lazy } from 'react';

const RestClient = lazy(() => import('../components/RestClient'));

export default function ConnectionManager() {
  return (
    <div className="app-container app-full" style={{ minHeight: '0px' }}>
      <details open>
        <summary style={{ textAlign: 'left', padding: '0px' }}>REST Client</summary>
        <Suspense fallback={null}>
          <RestClient />
        </Suspense>
      </details>
    </div>
  );
}
