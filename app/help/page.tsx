import Link from "next/link";
import { BodyText, Button, Card, CardTitle } from "@globalcloudr/canopy-ui";
import { ReachShell } from "@/app/_components/reach-shell";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-[1.4rem] font-bold tracking-[-0.02em] text-[var(--foreground)]">{title}</h2>
      {children}
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[13px] font-bold text-white">
        {number}
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="font-semibold text-[var(--foreground)]">{title}</p>
        <BodyText muted className="mt-1 text-[14px]">{description}</BodyText>
      </div>
    </div>
  );
}

function Faq({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="py-4">
      <p className="font-semibold text-[var(--foreground)]">{question}</p>
      <BodyText muted className="mt-1.5 text-[14px]">{answer}</BodyText>
    </div>
  );
}

export default function HelpPage() {
  return (
    <ReachShell
      activeNav="help"
      eyebrow="Help"
      title="User guide"
      subtitle="Learn how to schedule posts and publish to your school's social accounts"
    >
      <div className="mx-auto max-w-3xl space-y-10">

        <Section title="How Canopy Reach works">
          <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none sm:p-8">
            <BodyText className="mb-6 text-[15px]">
              Canopy Reach connects your school's social media accounts so your team can create, schedule,
              and publish posts to Facebook, Instagram, and LinkedIn — all from one place.
            </BodyText>
            <div className="space-y-5">
              <Step number={1} title="Connect your accounts" description="Go to Accounts and link your school's Facebook Page, Instagram business account, or LinkedIn organization. Each account connects through the platform's official OAuth flow." />
              <Step number={2} title="Create a post" description="Open New Post, write your caption, select which platforms to publish to, and attach an image from your media library or upload a new one." />
              <Step number={3} title="Preview per platform" description="Use the platform preview tabs to see how your post will look on Facebook, Instagram, and LinkedIn before publishing. Character count warnings flag anything over platform limits." />
              <Step number={4} title="Schedule or publish" description="Post immediately, save as a draft to finish later, or schedule for a specific date and time. Scheduled posts publish automatically." />
              <Step number={5} title="Track performance" description="Open any published post to see engagement stats — reach, clicks, reactions, and comments — pulled directly from each platform." />
            </div>
          </Card>
        </Section>

        <Section title="Getting started">
          <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none sm:p-8">
            <div className="space-y-6">
              <div>
                <CardTitle className="text-base">1. Connect at least one social account</CardTitle>
                <BodyText muted className="mt-2 text-[14px]">
                  Go to <Link href="/connect" className="underline underline-offset-2">Accounts</Link> and
                  connect your Facebook Page. Instagram and LinkedIn can also be connected here. You need
                  at least one connected account before you can publish posts.
                </BodyText>
              </div>
              <div>
                <CardTitle className="text-base">2. Set your brand guidelines</CardTitle>
                <BodyText muted className="mt-2 text-[14px]">
                  Add your school's voice and tone guidelines in{" "}
                  <Link href="/guidelines" className="underline underline-offset-2">Guidelines</Link>. Staff
                  can reference these while composing posts to stay on-brand.
                </BodyText>
              </div>
              <div>
                <CardTitle className="text-base">3. Create post templates</CardTitle>
                <BodyText muted className="mt-2 text-[14px]">
                  Build reusable starting points in{" "}
                  <Link href="/templates" className="underline underline-offset-2">Templates</Link> for
                  common post types — event announcements, enrollment campaigns, student spotlights.
                  Templates speed up your team's workflow significantly.
                </BodyText>
              </div>
              <div>
                <CardTitle className="text-base">4. Schedule your first post</CardTitle>
                <BodyText muted className="mt-2 text-[14px]">
                  Open <Link href="/posts/new" className="underline underline-offset-2">New Post</Link>,
                  pick a template or start from scratch, select your platforms, add an image, and schedule
                  it. The Calendar view shows everything going out and what's already been published.
                </BodyText>
              </div>
            </div>
          </Card>
        </Section>

        <Section title="Frequently asked questions">
          <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none sm:p-8">
            <div className="divide-y divide-[var(--border)]">
              <Faq
                question="What social platforms are supported?"
                answer="Facebook Pages, Instagram business accounts, and LinkedIn organization pages. X (Twitter) is planned but not yet available."
              />
              <Faq
                question="Why can't I connect my Instagram account?"
                answer="Instagram requires a business account linked to a Facebook Page. Personal Instagram accounts are not supported by the Instagram API. Connect your Facebook Page first — Instagram will appear as an option if a business account is linked to it."
              />
              <Faq
                question="Can multiple staff members post from the same account?"
                answer="Yes. Connected social accounts belong to the workspace, not to individual users. Any staff member with the right role can create and schedule posts using the connected accounts."
              />
              <Faq
                question="What happens if a scheduled post fails to publish?"
                answer="The post status updates to reflect the failure and the reason is shown on the post detail page. Common causes are expired access tokens — reconnect the account in Accounts and reschedule."
              />
              <Faq
                question="Do I need an image for every post?"
                answer="Instagram requires an image for every post. Facebook and LinkedIn support text-only posts, but posts with images consistently perform better."
              />
              <Faq
                question="How do I review posts before they go out?"
                answer="Use the Review queue to see posts that have been submitted by staff and are waiting for approval before publishing. Approvers can approve or send back for changes from there."
              />
            </div>
          </Card>
        </Section>

        <Section title="Quick links">
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary"><Link href="/">Dashboard</Link></Button>
            <Button asChild variant="secondary"><Link href="/calendar">Calendar</Link></Button>
            <Button asChild variant="secondary"><Link href="/posts/new">New Post</Link></Button>
            <Button asChild variant="secondary"><Link href="/connect">Accounts</Link></Button>
            <Button asChild variant="secondary">
              <a href="mailto:info@akkedisdigital.com?subject=Canopy%20Reach%20Support">Contact support</a>
            </Button>
          </div>
        </Section>

      </div>
    </ReachShell>
  );
}
