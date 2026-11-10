import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSEO } from "@/lib/useSEO";
import { toast } from "sonner";
import { Star, Users, CheckCircle2, ShieldCheck, Clock, BookOpen, Play, Award } from "lucide-react";

export default function CourseDetail() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    api.get(`/courses/${slug}`).then((r) => setCourse(r.data)).catch(() => setCourse(null));
    if (user) {
      api.get("/enrollments/me").then((r) => {
        setEnrolled(r.data.some((e) => e.course_slug === slug));
      }).catch(() => {});
    }
  }, [slug, user]);

  useSEO({
    title: course ? `${course.title} · ${course.target} · FNJEE.com` : "Course",
    description: course?.highlights?.join(" · "),
    canonical: `https://fnjee.com/courses/${slug}`,
  });

  const handleEnroll = async () => {
    if (!user) { nav("/login"); return; }
    setEnrolling(true);
    try {
      await api.post("/enroll", { course_slug: slug, payment_method: "test" });
      setEnrolled(true);
      toast.success(`Enrolled in ${course.title}!`);
      setTimeout(() => nav("/student"), 1200);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Enrollment failed");
    } finally {
      setEnrolling(false);
    }
  };

  if (!course) {
    return <div className="max-w-5xl mx-auto px-6 py-20 text-center text-muted-foreground">Loading course…</div>;
  }

  return (
    <div data-testid="course-detail-page" className="max-w-7xl mx-auto px-6 py-14 lg:py-20 grid lg:grid-cols-[1fr,380px] gap-10">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="rounded-full">{course.target}</Badge>
          <Badge variant="outline" className="rounded-full">{course.kind}</Badge>
          {course.featured && <Badge className="rounded-full bg-accent text-accent-foreground">Most popular</Badge>}
        </div>
        <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight mt-4">{course.title}</h1>
        <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {course.enrolments.toLocaleString()}+ enrolled</span>
          <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-current text-amber-500" /> {course.rating} · {course.reviews.toLocaleString()} ratings</span>
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {course.duration_months} months</span>
        </div>

        <Card className="en-card mt-8 p-6">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">What's included</div>
          <ul className="mt-4 grid sm:grid-cols-2 gap-3">
            {course.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />{h}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="en-card mt-6 p-6">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Curriculum snapshot</div>
          <div className="mt-4 grid sm:grid-cols-3 gap-4">
            {course.subjects.map((s) => (
              <div key={s} className="p-4 rounded-xl border border-border">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center mb-2"><BookOpen className="h-4 w-4" /></div>
                <div className="font-display font-semibold">{s}</div>
                <div className="text-xs text-muted-foreground mt-1">Chapter-wise MCQs · NCERT-tagged · video walkthroughs</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="en-card mt-6 p-6">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">How you'll study</div>
          <div className="mt-4 space-y-3">
            {[
              { icon: Play, t: "Watch a concept lecture", d: "5–8 min bite-sized clips per topic. Take notes only if you want to." },
              { icon: BookOpen, t: "Practice on CBT", d: "20–30 MCQs per topic with instant audio-video solutions. NCERT filter available." },
              { icon: Clock, t: "Solve today's DPP", d: "Auto-generated set targeting weak chapters. 15–30 min. Build the streak." },
              { icon: Award, t: "Take the weekend mock", d: "Full-syllabus CBT under exam pressure. Get rank prediction after every mock." },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><s.icon className="h-4 w-4" /></div>
                <div>
                  <div className="font-semibold text-sm">{s.t}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-24 h-fit">
        <Card className="en-card p-6 border-primary/30">
          <div className="flex items-end gap-2">
            <div className="font-display font-bold text-4xl">₹{course.price.toLocaleString()}</div>
            <div className="text-muted-foreground line-through mb-1">₹{course.mrp.toLocaleString()}</div>
          </div>
          <Badge variant="outline" className="mt-2 rounded-full text-emerald-600 border-emerald-500/40">
            Save ₹{(course.mrp - course.price).toLocaleString()} · Limited time
          </Badge>
          {enrolled ? (
            <Button data-testid="go-to-portal" className="w-full rounded-full mt-6" onClick={() => nav("/student")}>Go to portal →</Button>
          ) : (
            <Button data-testid="confirm-enroll-btn" className="w-full rounded-full mt-6" onClick={handleEnroll} disabled={enrolling}>
              {enrolling ? "Processing…" : "Enroll now"}
            </Button>
          )}
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> 3-day no-questions refund
          </div>
          <div className="mt-6 pt-6 border-t border-border space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Valid for</span><span className="font-semibold">{course.duration_months} months</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Devices</span><span className="font-semibold">Web + App</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Language</span><span className="font-semibold">English / Hinglish</span></div>
          </div>
        </Card>
        <div className="mt-4 text-xs text-muted-foreground text-center">
          <Link to="/courses" className="hover:text-primary">← Back to all courses</Link>
        </div>
      </aside>
    </div>
  );
}
