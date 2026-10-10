import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HeroBanner } from "@/components/HeroBanner";
import { Rail } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { getFeed } from "@/lib/videos.functions";
import { getMySubscriptions } from "@/lib/profile.functions";
import { useSession } from "@/hooks/use-session";

const feedQuery = queryOptions({ queryKey: ["feed"], queryFn: () => getFeed() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StreamHub — Stream, upload and watch together" },
      {
        name: "description",
        content:
          "StreamHub is a cinematic streaming platform: browse featured titles, upload your own videos and watch together in private rooms with chat and screen sharing.",
      },
      { property: "og:title", content: "StreamHub — Stream, upload and watch together" },
      {
        property: "og:description",
        content: "Featured titles, creator uploads and private watch-together rooms with live chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(feedQuery),
  component: FeedPage,
  errorComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">The feed could not be loaded. Try refreshing.</p>
    </AppShell>
  ),
});

function FeedPage() {
  const { data } = useSuspenseQuery(feedQuery);
  const { user } = useSession();
  const { data: subscriptions } = useQuery({
    queryKey: ["my-subscriptions", user?.id],
    queryFn: () => getMySubscriptions(),
    enabled: Boolean(user),
  });
  const featured = data[0];
  const trending = [...data].sort((a, b) => Number(b.view_count) - Number(a.view_count));

  return (
    <AppShell bleed>
      {featured ? (
        <HeroBanner video={featured} />
      ) : (
        <div className="aurora px-4 pt-24 text-center sm:px-6">
          <h1 className="text-3xl font-extrabold">Nothing streaming yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">Upload your first video to get started.</p>
        </div>
      )}

      <div className="relative z-10 mx-auto -mt-8 max-w-[1600px] px-4 sm:px-6">
        {subscriptions && subscriptions.length > 0 && (
          <section className="mb-8" aria-label="Subscriptions rail">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold tracking-tight text-foreground/90">
                Subscriptions
              </h2>
              <span className="text-xs text-muted-foreground">
                {subscriptions.length} channel{subscriptions.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
              {subscriptions.map((channel: any) => (
                <Link
                  key={channel.id}
                  to="/profile/$userId"
                  params={{ userId: channel.id }}
                  className="group flex flex-col items-center gap-1.5 shrink-0 transition-transform hover:scale-105"
                >
                  <div className="relative h-14 w-14 rounded-full p-[2px] ring-2 ring-primary/40 group-hover:ring-primary transition-all">
                    {channel.avatar_url ? (
                      <img
                        src={channel.avatar_url}
                        alt={channel.display_name}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-secondary text-sm font-bold uppercase text-foreground">
                        {(channel.display_name || "C").slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <span className="max-w-[76px] truncate text-center text-xs font-medium text-foreground/80 group-hover:text-foreground">
                    {channel.display_name || "Creator"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <Rail title="Trending now" videos={trending.slice(0, 12)} />
        <Rail title="New releases" videos={data.slice(0, 12)} wide />
        <Rail title="Because you watch on StreamHub" videos={[...data].reverse().slice(0, 12)} />

        <section className="panel mt-14 overflow-hidden rounded-3xl p-8 sm:p-12">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
                <Users className="h-3.5 w-3.5" /> Watch party
              </span>
              <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl">
                Create a <span className="text-gradient">Room</span> and watch together
              </h2>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                Share a room ID and password with friends. Chat in real time and share your screen —
                like a private cinema meet, right inside StreamHub.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="gradient-brand w-fit rounded-full px-8 font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              <Link to="/rooms">Open Rooms</Link>
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
