import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ThumbsUp, Share2, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { formatViews, formatDuration } from "@/lib/format";
import { TimeAgo } from "@/components/TimeAgo";
import { EditVideoDialog } from "@/components/EditVideoDialog";
import {
  addComment,
  deleteComment,
  deleteVideo,
  getComments,
  getLikeCount,
  getMyLike,
  getVideo,
  registerView,
  toggleLike,
} from "@/lib/videos.functions";

const videoQuery = (id: string) =>
  queryOptions({ queryKey: ["video", id], queryFn: () => getVideo({ data: { id } }) });

export const Route = createFileRoute("/videos/$id")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(videoQuery(params.id));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Video unavailable — StreamHub" }, { name: "robots", content: "noindex" }],
      };
    }
    const { video } = loaderData;
    const description = video.description.slice(0, 150) || `Watch ${video.title} on StreamHub.`;
    return {
      meta: [
        { title: `${video.title} — StreamHub` },
        { name: "description", content: description },
        { property: "og:title", content: video.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "video.other" },
      ],
    };
  },
  component: WatchPage,
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">
        This video doesn&apos;t exist.{" "}
        <Link to="/" className="text-primary underline">
          Back to the feed
        </Link>
      </p>
    </AppShell>
  ),
  errorComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">This video could not be loaded.</p>
    </AppShell>
  ),
});

function WatchPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(videoQuery(id));
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    void registerView({ data: { id } });
  }, [id]);

  const comments = useQuery({
    queryKey: ["comments", id],
    queryFn: () => getComments({ data: { id } }),
  });
  const likes = useQuery({ queryKey: ["likes", id], queryFn: () => getLikeCount({ data: { id } }) });
  const myLike = useQuery({
    queryKey: ["my-like", id, user?.id ?? null],
    queryFn: () => getMyLike({ data: { id } }),
    enabled: Boolean(user),
  });

  const likeMutation = useMutation({
    mutationFn: () => toggleLike({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["likes", id] });
      void queryClient.invalidateQueries({ queryKey: ["my-like", id] });
    },
    onError: () => toast.error("Could not update your like."),
  });

  const commentMutation = useMutation({
    mutationFn: () => addComment({ data: { id, body } }),
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
    onError: () => toast.error("Could not post your comment."),
  });

  if (!data) return null;
  const { video, related } = data;

  const isOwner = Boolean(user && video.owner_id && user.id === video.owner_id);
  const [editOpen, setEditOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteVideo({ data: { id } }),
    onSuccess: () => {
      toast.success("Video deleted");
      navigate({ to: "/" });
    },
    onError: () => toast.error("Could not delete this video."),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment({ data: { id: commentId } }),
    onSuccess: () => {
      toast.success("Comment deleted");
      void queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
    onError: (err: any) => toast.error(err?.message || "Could not delete comment."),
  });

  return (
    <AppShell>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-xl bg-black">
            {video.video_url ? (
              <video
                key={video.video_url}
                src={video.video_url}
                poster={video.thumbnail_url ?? undefined}
                controls
                playsInline
                className="aspect-video w-full"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                This video is still processing.
              </div>
            )}
          </div>

          <h1 className="mt-4 text-xl font-bold leading-snug">{video.title}</h1>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold uppercase">
                {video.channel_name.slice(0, 2)}
              </span>
              <div>
                <p className="text-sm font-semibold">{video.channel_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDuration(video.duration_seconds)} · <TimeAgo date={video.created_at} />
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={myLike.data?.liked ? "default" : "secondary"}
                size="sm"
                className="rounded-full"
                disabled={likeMutation.isPending}
                onClick={() => {
                  if (!user) {
                    toast("Sign in to like this video.");
                    navigate({ to: "/auth" });
                    return;
                  }
                  likeMutation.mutate();
                }}
              >
                <ThumbsUp className="mr-2 h-4 w-4" />
                {likes.data ?? 0}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  void navigator.clipboard?.writeText(window.location.href);
                  toast.success("Link copied");
                }}
              >
                <Share2 className="mr-2 h-4 w-4" /> Share
              </Button>

              {isOwner && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-full"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this video? This cannot be undone.")) {
                        deleteMutation.mutate();
                      }
                    }}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-surface p-4">
            <p className="text-sm font-medium">
              {formatViews(Number(video.view_count))} · <TimeAgo date={video.created_at} />
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {video.description || "No description provided."}
            </p>
            {video.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {video.tags.map((tag) => (
                  <Link
                    key={tag}
                    to="/explore"
                    search={{ tag }}
                    className="text-xs text-primary hover:underline"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Separator className="my-6" />

          <section aria-label="Comments">
            <h2 className="text-base font-semibold">
              {comments.data?.length ?? 0} Comments
            </h2>
            {user ? (
              <form
                className="mt-4 flex gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (body.trim()) commentMutation.mutate();
                }}
              >
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Add a comment…"
                  rows={2}
                  className="bg-surface"
                />
                <Button type="submit" disabled={!body.trim() || commentMutation.isPending}>
                  Comment
                </Button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                <Link to="/auth" className="text-primary underline">
                  Sign in
                </Link>{" "}
                to join the conversation.
              </p>
            )}

            <ul className="mt-6 space-y-5">
              {(comments.data ?? []).map((comment) => (
                <li key={comment.id} className="group flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase">
                      {comment.author_name.slice(0, 2)}
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{comment.author_name}</span>{" "}
                        <TimeAgo date={comment.created_at} />
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
                    </div>
                  </div>
                  {user && (user.id === comment.user_id || isOwner) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                      title="Delete comment"
                      disabled={deleteCommentMutation.isPending}
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Up next</h2>
          {related.map((item) => (
            <Link
              key={item.id}
              to="/videos/$id"
              params={{ id: item.id }}
              className="flex gap-3 group"
            >
              <div className="aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-surface">
                {item.thumbnail_url && (
                  <img
                    src={item.thumbnail_url}
                    alt={`Thumbnail for ${item.title}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium group-hover:text-primary">
                  {item.title}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{item.channel_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatViews(Number(item.view_count))}
                </p>
              </div>
            </Link>
          ))}
        </aside>
      </div>

      {isOwner && (
        <EditVideoDialog
          video={video}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </AppShell>
  );
}
