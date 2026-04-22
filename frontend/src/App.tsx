import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { UploadPage } from '@/pages/UploadPage'
import { ReviewPage } from '@/pages/ReviewPage'
import { RecordsPage } from '@/pages/RecordsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<UploadPage />} />
          <Route path="/review/:id" element={<ReviewPage />} />
          <Route path="/records" element={<RecordsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
