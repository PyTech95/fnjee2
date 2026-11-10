import { Link, useParams, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/lib/useSEO";
import { BLOG_POSTS } from "@/lib/marketingData";
import { CalendarDays, Clock } from "lucide-react";

const ORIGIN = "https://fnjee.com";

export function BlogIndex() {
  useSEO({
    title: "FNJEE.com Blog — Strategy, chapter-wise tips & exam hacks",
    description: "Read expert strategy pieces for JEE, NEET, Olympiads and govt exams — daily practice systems, chapter-wise revision plans, mock-test schedules, and rank-boosting tactics.",
    canonical: `${ORIGIN}/blog`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Blog",
      "name": "FNJEE.com Blog",
      "url": `${ORIGIN}/blog`,
      "blogPost": BLOG_POSTS.map(p => ({
        "@type": "BlogPosting",
        "headline": p.title,
        "description": p.excerpt,
        "datePublished": p.date,
        "url": `${ORIGIN}/blog/${p.slug}`,
      })),
    },
  });
  return (
    <div data-testid="blog-index" className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
      <div className="max-w-2xl mb-10">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Blog</div>
        <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight mt-2">Rank-boosting reads.</h1>
        <p className="text-muted-foreground mt-3">Short, useful posts on exam strategy, daily practice systems, and CBT hacks.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {BLOG_POSTS.map(p => (
          <Link key={p.slug} to={`/blog/${p.slug}`} data-testid={`blog-card-${p.slug}`}>
            <Card className="en-card p-6 h-full">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Badge variant="secondary" className="rounded-full">{p.tag}</Badge>
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{p.date}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.read}</span>
              </div>
              <h3 className="font-display font-semibold text-xl leading-tight">{p.title}</h3>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{p.excerpt}</p>
              <div className="mt-4 text-sm text-primary font-medium">Read →</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const post = BLOG_POSTS.find(p => p.slug === slug);

  useSEO({
    title: post ? `${post.title} · FNJEE.com` : "FNJEE.com",
    description: post?.excerpt,
    canonical: post ? `${ORIGIN}/blog/${post.slug}` : undefined,
    jsonLd: post ? {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.excerpt,
      "datePublished": post.date,
      "author": { "@type": "Organization", "name": "FNJEE.com" },
      "publisher": { "@type": "Organization", "name": "FNJEE.com" },
      "mainEntityOfPage": `${ORIGIN}/blog/${post.slug}`,
    } : undefined,
  });

  if (!post) return <Navigate to="/blog" replace />;

  return (
    <article data-testid={`blog-post-${post.slug}`} className="max-w-3xl mx-auto px-6 py-16">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
        <Badge variant="secondary" className="rounded-full">{post.tag}</Badge>
        <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{post.date}</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.read}</span>
      </div>
      <h1 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-tight">{post.title}</h1>
      <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{post.excerpt}</p>
      <div className="mt-10 space-y-4 text-foreground/80 leading-relaxed whitespace-pre-line">
        {post.body.split("\n\n").map((p, i) => {
          if (p.startsWith("**") && p.endsWith("**")) {
            return <h3 key={i} className="font-display font-semibold text-xl mt-8">{p.replace(/\*\*/g, "")}</h3>;
          }
          if (p.startsWith("- ")) {
            return <ul key={i} className="list-disc pl-6 space-y-1">{p.split("\n").map((li, j) => <li key={j}>{li.replace(/^-\s+/, "")}</li>)}</ul>;
          }
          return <p key={i}>{p}</p>;
        })}
      </div>
      <div className="mt-12 p-6 rounded-2xl bg-primary text-primary-foreground">
        <div className="font-display font-semibold text-lg">Ready to put this into practice?</div>
        <p className="text-sm text-primary-foreground/80 mt-1">Sign up on FNJEE.com and take your first mock free.</p>
        <Link to="/signup"><Button variant="secondary" className="rounded-full mt-4">Start free mock</Button></Link>
      </div>
    </article>
  );
}
