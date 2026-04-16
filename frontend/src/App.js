import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';

// Import pages
import LawyerListing from './pages/LawyerListing';
import LawyerProfile from './pages/LawyerProfile';
import SignupSelect from './pages/SignupSelect';
import AdminDashboard from './pages/AdminDashboard';
import AvocatDashboard from './pages/AvocatDashboard';
import ClientDashboard from './pages/ClientDashboard';
import CaseList from './pages/CaseList';
import CaseCreate from './pages/CaseCreate';
import CaseDetails from './pages/CaseDetails';
import NotFound from './components/NotFound';
import AboutPage from './pages/about';
import Contact from './pages/contact';
import LandingPage from './pages/LandingPage';
import PrivacyPage from './pages/Privacy';
import TermsPage from './pages/Terms';
import SignupAvocat from './pages/SignupAvocat';
import AvocatOnboarding from './pages/Avocatonboarding';
import RoleSelector from './pages/RoleSelector';
import Login from './pages/Login';
import ClientOnboarding from './pages/ClientOnboarding';
import ForgotPassword from './pages/ForgetPassword';
import ResetPassword from './pages/ResetPassword';
import FoundingMembersPage from './pages/FoundingMembers';
import CompleteProfile from './pages/FoundingMembers/CompleteProfile';
import FoundingOnboarding from './pages/FoundingMembers/FoundingOnboarding';


// Diagnostic: log import types to detect any invalid (object) imports
try {
  // eslint-disable-next-line no-console
  console.log('App imports types:', {
    LandingPage: typeof LandingPage,
    LawyerListing: typeof LawyerListing,
    AvocatOnboarding: typeof AvocatOnboarding,
    LawyerProfile: typeof LawyerProfile,
    SignupSelect: typeof SignupSelect,
    SignupAvocat: typeof SignupAvocat,
    AdminDashboard: typeof AdminDashboard,
    AvocatDashboard: typeof AvocatDashboard,
    ClientDashboard: typeof ClientDashboard,
    CaseList: typeof CaseList,
    CaseCreate: typeof CaseCreate,
    CaseDetails: typeof CaseDetails,
    NotFound: typeof NotFound,
    ResetPassword:typeof ResetPassword,
    ForgotPassword:typeof ForgotPassword,
    FoundingMembersPage:typeof  FoundingMembersPage
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('App import diagnostic error', err);
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public homepage */}
            <Route path="/" element={<LandingPage />} />

            {/* Lawyer listing page */}
            <Route path="/lawyers" element={<LawyerListing />} />

            {/*Footer */}
            <Route path="/contact" element={<Contact />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />


            {/* Cases */}
            <Route path="/cases" element={<ProtectedRoute allowedUserTypes={["Avocat", "Client"]}><CaseList /></ProtectedRoute>} />
            <Route path="/cases/new" element={<ProtectedRoute allowedUserTypes={["Avocat"]}><CaseCreate /></ProtectedRoute>} />
            <Route path="/cases/:id" element={<ProtectedRoute allowedUserTypes={["Avocat", "Client"]}><CaseDetails /></ProtectedRoute>} />

            {/* Lawyer profile page */}
            <Route path="/lawyer/:id" element={<LawyerProfile />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Public routes - redirect to dashboard if already logged in */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicRoute>
                  <RoleSelector />
                </PublicRoute>
              }
            />
            <Route
              path="/signup/avocat"
              element={
                <PublicRoute>
                  <AvocatOnboarding />
                </PublicRoute>
              }
            />
            <Route
              path="/signup/client"
              element={
                <PublicRoute>
                  <ClientOnboarding />
                </PublicRoute>
              }
            />
            <Route path="/foundingMembers"
              element={
                <PublicRoute>
                  <FoundingMembersPage />
                </PublicRoute>
              }
            />
            <Route path="/founding/complete/:token" element={<CompleteProfile />} />
            <Route path="/foundingMembers/onboarding" element={<FoundingOnboarding />} />

            {/* Protected routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/dashboard"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/avocat/dashboard"
              element={
                <ProtectedRoute allowedUserTypes={['Avocat']}>
                  <AvocatDashboard />
                </ProtectedRoute>
              }
            />

            {/* 404 Not Found */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
