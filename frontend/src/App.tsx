import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { UploadPage } from '@/pages/UploadPage'
import { ReviewPage } from '@/pages/ReviewPage'
import { RecordsPage } from '@/pages/RecordsPage'
import { extractionService } from '@/services/extractionService'

function App() {
  // 页面启动时恢复未完成任务的轮询（处理刷新场景）
  useEffect(() => {
    extractionService.resumeAllPending()
  }, [])

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
