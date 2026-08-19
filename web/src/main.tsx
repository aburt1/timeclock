import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import KioskPage from './kiosk/KioskPage';
import AdminApp from './admin/AdminApp';
import SignupPage from './signup/SignupPage';
import './index.css';

const router = createBrowserRouter([
  { path: '/', element: <KioskPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/admin/*', element: <AdminApp /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
