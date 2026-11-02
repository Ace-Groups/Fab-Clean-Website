import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <AppLayout>
      <div className="page-shell">
        <section className="container-tight section-padding">
          <div className="visual-card p-10 text-center">
            <p className="eyebrow justify-center">404</p>
            <h1 className="mt-6 font-display text-5xl text-ink sm:text-6xl">Page Not Found</h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              The page you are looking for does not exist or may have been moved.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/">
                <Button>Back to home</Button>
              </Link>
              <Link href="/schedule-pickup">
                <Button variant="outline">Schedule pickup</Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
