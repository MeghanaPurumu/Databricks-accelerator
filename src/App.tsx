import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import EstablishedConnections from './pages/Connections/EstablishedConnections';
import ConnectionIngestion from './pages/Connections/ConnectionIngestion';
import MasterDataHub from './pages/MasterData/MasterDataHub';
import MdmGoldenRecords from './pages/MasterData/MdmGoldenRecords';
import RecordDetails from './pages/RecordDetails';
import StewardshipQueue from './pages/Stewardship/Queue';
import DuplicateReview from './pages/DuplicateReview';
import Merge from './pages/Merge';
import QualityDashboard from './pages/DataQuality/Dashboard';
import RulesEngine from './pages/DataQuality/Rules';
import ExceptionsList from './pages/DataQuality/Exceptions';
import LineageFlow from './pages/Lineage';
import Settings from './pages/Settings';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header Panel */}
          <Header />

          {/* Subpages Content */}
          <main className="flex-1 overflow-hidden bg-gray-50 flex flex-col">
            <Routes>
              {/* Landing Page: Established Connections */}
              <Route path="/" element={<EstablishedConnections />} />

              {/* Connection & Ingestion page (Separate) */}
              <Route path="/connections" element={<ConnectionIngestion />} />

              {/* Redirect /dashboard to / */}
              <Route path="/dashboard" element={<Navigate to="/" replace />} />

              {/* Master Data Hub & Golden Records */}
              <Route path="/master-data" element={<MasterDataHub />} />
              <Route path="/master-data/:mdmId/golden-records" element={<MdmGoldenRecords />} />
              <Route path="/master-data/:domain" element={<MdmGoldenRecords />} />
              <Route path="/master-data/:domain/:id" element={<RecordDetails />} />

              {/* Data Stewardship pages */}
              <Route path="/stewardship/queue" element={<StewardshipQueue />} />
              <Route path="/stewardship/duplicates" element={<DuplicateReview />} />
              <Route path="/stewardship/merge/:duplicateId" element={<Merge />} />

              {/* Data Quality pages */}
              <Route path="/quality/dashboard" element={<QualityDashboard />} />
              <Route path="/quality/rules" element={<RulesEngine />} />
              <Route path="/quality/exceptions" element={<ExceptionsList />} />

              {/* Data Lineage page */}
              <Route path="/lineage" element={<LineageFlow />} />

              {/* Settings page */}
              <Route path="/settings" element={<Settings />} />

              {/* Fallback redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
