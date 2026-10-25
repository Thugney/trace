// Browser-test entry only; excluded from the production index and bundle.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProfileProvider } from '../src/context/ProfileContext';
import LessonPage from '../src/pages/learn/LessonPage';
import '../src/index.css';

const id = new URLSearchParams(location.search).get('lesson');
createRoot(document.getElementById('root')!).render(
  <ProfileProvider><MemoryRouter initialEntries={[`/learn/lessons/${id}`]}><Routes>
    <Route path="/learn/lessons/:lessonId" element={<LessonPage />} />
  </Routes></MemoryRouter></ProfileProvider>
);
