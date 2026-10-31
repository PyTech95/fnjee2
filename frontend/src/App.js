import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "sonner";

// Marketing
import MarketingLayout from "@/pages/marketing/MarketingLayout";
import MarketingHome from "@/pages/marketing/MarketingHome";
import ExamPage from "@/pages/marketing/ExamPage";
import { CitiesIndex, CityPage } from "@/pages/marketing/CityPages";
import { BlogIndex, BlogPost } from "@/pages/marketing/Blog";
import { Features, HowItWorks, Pricing, Results, FAQ, Contact } from "@/pages/marketing/OtherPages";
import CoursesListing from "@/pages/marketing/CoursesListing";
import CourseDetail from "@/pages/marketing/CourseDetail";
import { PrivacyPolicy, TermsOfUse, DeleteAccount } from "@/pages/Legal";
import DPP from "@/pages/student/DPP";
import Flashcards from "@/pages/student/Flashcards";
import Mindmaps from "@/pages/student/Mindmaps";
import RankPredictor from "@/pages/student/RankPredictor";
import ChapterPlaylist from "@/pages/student/ChapterPlaylist";
import ManualGrader from "@/pages/admin/ManualGrader";

// Auth
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";

// Portal (existing)
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import QuestionBank from "@/pages/admin/QuestionBank";
import ImportWizard from "@/pages/admin/ImportWizard";
import ManualQuestion from "@/pages/admin/ManualQuestion";
import TestBuilder from "@/pages/admin/TestBuilder";
import CbtExams from "@/pages/admin/CbtExams";
import CbtExamBuilder from "@/pages/admin/CbtExamBuilder";
import AdminTests from "@/pages/admin/AdminTests";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import SystemErrors from "@/pages/admin/SystemErrors";
import ProctoringDashboard from "@/pages/admin/ProctoringDashboard";
import AdminStudents from "@/pages/admin/AdminStudents";
import AdminSettings from "@/pages/admin/AdminSettings";
import StudentLayout from "@/pages/student/StudentLayout";
import StudentDashboard from "@/pages/student/StudentDashboard";
import StudentTests from "@/pages/student/StudentTests";
import LiveExam from "@/pages/student/LiveExam";
import CbtExam from "@/pages/student/cbt/CbtExam";
import DemoExam from "@/pages/DemoExam";
import Result from "@/pages/student/Result";
import Rewards from "@/pages/student/Rewards";
import StudentProfile from "@/pages/student/StudentProfile";
import Leaderboard from "@/pages/student/Leaderboard";
import AiTutor from "@/pages/student/AiTutor";
import NotesQuiz from "@/pages/student/NotesQuiz";
import Coach from "@/pages/student/Coach";
import Revision from "@/pages/student/Revision";
import Adaptive from "@/pages/student/Adaptive";
import Battles from "@/pages/student/Battles";
import ParentLayout from "@/pages/parent/ParentLayout";
import ParentDashboard from "@/pages/parent/ParentDashboard";
import ParentAssign from "@/pages/parent/ParentAssign";
import ParentNotifications from "@/pages/parent/ParentNotifications";
import ParentDigest from "@/pages/parent/ParentDigest";
import Podcasts from "@/pages/student/Podcasts";
import Practice from "@/pages/student/Practice";
import DuelChallenge from "@/pages/DuelChallenge";

// Teacher portal
import TeacherLayout from "@/pages/teacher/TeacherLayout";
import TeacherDashboard from "@/pages/teacher/TeacherDashboard";
import TeacherQuestionBank from "@/pages/teacher/TeacherQuestionBank";
import TeacherPapers from "@/pages/teacher/TeacherPapers";
import TeacherResults from "@/pages/teacher/TeacherResults";
import ManageLiveClasses from "@/pages/live/ManageLiveClasses";
import StudentLiveClasses from "@/pages/live/StudentLiveClasses";
import TeacherPermissions from "@/pages/admin/TeacherPermissions";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Routes>
          {/* Marketing site */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<MarketingHome />} />
            <Route path="/jee" element={<ExamPage />} />
            <Route path="/neet" element={<ExamPage />} />
            <Route path="/olympiads" element={<ExamPage />} />
            <Route path="/govt-exams" element={<ExamPage />} />
            <Route path="/features" element={<Features />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/results" element={<Results />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/cities" element={<CitiesIndex />} />
            <Route path="/cities/:slug" element={<CityPage />} />
            <Route path="/blog" element={<BlogIndex />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/courses" element={<CoursesListing />} />
            <Route path="/courses/:slug" element={<CourseDetail />} />
          </Route>

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/demo" element={<DemoExam />} />

          {/* Legal (also linked from the Android / iOS store listings) */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfUse />} />
          <Route path="/delete-account" element={<DeleteAccount />} />

          {/* Portals */}
          <Route path="/admin" element={<Protected roles={["admin"]}><AdminLayout /></Protected>}>
            <Route index element={<AdminDashboard />} />
            <Route path="questions" element={<QuestionBank />} />
            <Route path="import" element={<ImportWizard />} />
            <Route path="questions/new" element={<ManualQuestion />} />
            <Route path="tests" element={<AdminTests />} />
            <Route path="tests/new" element={<TestBuilder />} />
            <Route path="cbt-exams" element={<CbtExams />} />
            <Route path="cbt-exams/new" element={<CbtExamBuilder />} />
            <Route path="cbt-exams/:testId/edit" element={<CbtExamBuilder />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="grading" element={<ManualGrader />} />
            <Route path="teachers" element={<TeacherPermissions />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="system" element={<SystemErrors />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="proctoring" element={<ProctoringDashboard />} />
            <Route path="live-classes" element={<ManageLiveClasses accent="Admin" />} />
          </Route>

          <Route path="/student" element={<Protected roles={["student"]}><StudentLayout /></Protected>}>
            <Route index element={<StudentDashboard />} />
            <Route path="tests" element={<StudentTests />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="practice" element={<Practice />} />
            <Route path="ai-tutor" element={<AiTutor />} />
            <Route path="notes-quiz" element={<NotesQuiz />} />
            <Route path="coach" element={<Coach />} />
            <Route path="revision" element={<Revision />} />
            <Route path="adaptive" element={<Adaptive />} />
            <Route path="battles" element={<Battles />} />
            <Route path="live" element={<StudentLiveClasses />} />
            <Route path="dpp" element={<DPP />} />
            <Route path="playlist" element={<ChapterPlaylist />} />
            <Route path="flashcards" element={<Flashcards />} />
            <Route path="mindmaps" element={<Mindmaps />} />
            <Route path="rank" element={<RankPredictor />} />
            <Route path="podcasts" element={<Podcasts />} />
            <Route path="rewards" element={<Rewards />} />
            <Route path="profile" element={<StudentProfile />} />
            <Route path="results/:attemptId" element={<Result />} />
          </Route>
          <Route path="/student/exam/:testId" element={<Protected roles={["student"]}><LiveExam /></Protected>} />
          <Route path="/student/cbt/:testId" element={<Protected roles={["student"]}><CbtExam /></Protected>} />
          <Route path="/duel/:code" element={<DuelChallenge />} />

          {/* Teacher / Vendor portal */}
          <Route path="/teacher" element={<Protected roles={["teacher"]}><TeacherLayout /></Protected>}>
            <Route index element={<TeacherDashboard />} />
            <Route path="question-bank" element={<TeacherQuestionBank />} />
            <Route path="papers" element={<TeacherPapers />} />
            <Route path="results" element={<TeacherResults />} />
            <Route path="live-classes" element={<ManageLiveClasses accent="Teacher" />} />
          </Route>

          <Route path="/parent" element={<Protected roles={["parent"]}><ParentLayout /></Protected>}>
            <Route index element={<ParentDashboard />} />
            <Route path="digest" element={<ParentDigest />} />
            <Route path="assign" element={<ParentAssign />} />
            <Route path="notifications" element={<ParentNotifications />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
