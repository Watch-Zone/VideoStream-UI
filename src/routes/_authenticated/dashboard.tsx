import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { deleteVideo, getMyVideos } from "@/lib/videos.functions";
import { formatDuration, formatViews } from "@/lib/format";
import { TimeAgo } from "@/components/TimeAgo";
import { EditVideoDialog } from "@/components/EditVideoDialog";
import type { VideoDTO } from "@/lib/video-types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your videos — StreamHub" },
      {
        name: "description",
        content: "Manage the videos you published on StreamHub: views, visibility and deletion.",
      },
      { property: "og:title", content: "Your videos — StreamHub" },
      { property: "og:description", content: "Manage your published StreamHub videos." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const queryClient = useQueryClient();
  const [editingVideo, setEditingVideo] = useState<VideoDTO | null>(null);
  const { data, isPending } = useQuery({
    queryKey: ["my-videos"],
    queryFn: () => getMyVideos() as Promise<VideoDTO[]>,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteVideo({ data: { id } }),
    onSuccess: () => {
      toast.success("Video deleted");
      void queryClient.invalidateQueries({ queryKey: ["my-videos"] });
    },
    onError: () => toast.error("Could not delete that video."),
  });

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight">Your videos</h1>
        <Button asChild size="sm">
          <Link to="/upload">
            <Upload className="mr-2 h-4 w-4" /> Upload
          </Link>
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          You haven&apos;t published anything yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {data!.map((video) => (
            <li
              key={video.id}
              className="flex flex-wrap items-center gap-4 rounded-xl bg-surface p-3"
            >
              <Link
                to="/videos/$id"
                params={{ id: video.id }}
                className="aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-background"
              >
                {video.thumbnail_url && (
                  <img
                    src={video.thumbnail_url}
                    alt={`Thumbnail for ${video.title}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to="/videos/$id"
                  params={{ id: video.id }}
                  className="line-clamp-1 text-sm font-semibold hover:text-primary"
                >
                  {video.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatViews(Number(video.view_count))} ·{" "}
                  {formatDuration(video.duration_seconds)} · <TimeAgo date={video.created_at} />
                </p>
                <Badge variant="secondary" className="mt-2 capitalize">
                  {video.visibility}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${video.title}`}
                  onClick={() => setEditingVideo(video)}
                >
                  <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${video.title}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete "${video.title}"?`)) {
                      remove.mutate(video.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editingVideo && (
        <EditVideoDialog
          video={editingVideo}
          open={Boolean(editingVideo)}
          onOpenChange={(open) => !open && setEditingVideo(null)}
        />
      )}
    </AppShell>
  );
}
