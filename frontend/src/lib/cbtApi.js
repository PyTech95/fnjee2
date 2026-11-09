import { api } from "@/lib/api";

// DigiALM-style CBT examination APIs.
export const cbtApi = {
  getExam: (tid) => api.get(`/cbt/exam/${tid}`).then((r) => r.data),
  start: (test_id, retake = false) => api.post("/cbt/attempts/start", { test_id, retake }).then((r) => r.data),
  state: (aid) => api.get(`/cbt/attempts/${aid}/state`).then((r) => r.data),
  setLanguage: (aid, language) =>
    api.post(`/cbt/attempts/${aid}/language`, { language }).then((r) => r.data),
  saveResponse: (aid, payload) =>
    api.post(`/cbt/attempts/${aid}/response`, payload).then((r) => r.data),
  summary: (aid) => api.get(`/cbt/attempts/${aid}/summary`).then((r) => r.data),
  submit: (aid) => api.post(`/cbt/attempts/${aid}/submit`).then((r) => r.data),
  expire: (aid) => api.post(`/cbt/attempts/${aid}/expire`).then((r) => r.data),
  // admin
  adminListExams: () => api.get("/cbt/admin/exams").then((r) => r.data),
  adminUpdateExam: (tid, data) => api.put(`/cbt/admin/exams/${tid}`, data).then((r) => r.data),
  adminValidateExam: (tid) => api.post(`/cbt/admin/exams/${tid}/validate`).then((r) => r.data),
  adminPublishExam: (tid, published) => api.post(`/cbt/admin/exams/${tid}/publish`, { published }).then((r) => r.data),
};
