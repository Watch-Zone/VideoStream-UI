import { useState, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, MapPin, Eye, Film, Users, Bell, Check, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VideoCard } from "@/components/VideoCard";
import { getProfile, updateMyProfile, getIsSubscribed, toggleSubscription } from "@/lib/profile.functions";
import { useSession } from "@/hooks/use-session";
import { formatViews, initialsOf } from "@/lib/format";
import { TimeAgo } from "@/components/TimeAgo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile/$userId")({
  head: () => ({
    meta: [
      { title: "Creator profile — StreamHub" },
      {
        name: "description",
        content:
          "See a StreamHub creator's profile: their bio, uploaded videos, total views and whether they are live right now.",
      },
      { property: "og:title", content: "Creator profile — StreamHub" },
      {
        property: "og:description",
        content: "A StreamHub creator profile with uploads, stats and live status.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { userId } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfile({ data: { userId } }),
  });

  const isMe = user?.id === userId;

  const subQuery = useQuery({
    queryKey: ["isSubscribed", userId, user?.id],
    queryFn: () => getIsSubscribed({ data: { channelId: userId } }),
    enabled: Boolean(user && !isMe),
  });

  const isSubscribed = Boolean(subQuery.data?.isSubscribed);

  const subMutation = useMutation({
    mutationFn: () => toggleSubscription({ data: { channelId: userId } }),
    onSuccess: (res) => {
      toast.success(res.subscribed ? "Subscribed to channel!" : "Unsubscribed from channel");
      void queryClient.invalidateQueries({ queryKey: ["isSubscribed", userId] });
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Subscription action failed"),
  });

  if (profile.isPending) {
    return (
      <AppShell>
        <p className="mt-10 text-sm text-muted-foreground">Loading profile…</p>
      </AppShell>
    );
  }

  if (!profile.data) {
    return (
      <AppShell>
        <div className="mt-10">
          <h1 className="text-2xl font-bold">Profile not found</h1>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/">Back home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const { profile: p, videos, stats, live } = profile.data;

  return (
    <AppShell>
      <section className="animate-fade panel relative mt-4 overflow-hidden rounded-3xl">
        <div className="aurora h-36 w-full sm:h-44">
          {p.banner_url ? (
            <img src={p.banner_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </div>

        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-7">
          <div className="-mt-16 shrink-0 sm:-mt-20">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-border bg-primary text-2xl font-bold text-primary-foreground sm:h-28 sm:w-28 shadow-lg">
              {p.avatar_url ? (
                <img
                  src={p.avatar_url}
                  alt={`${p.display_name} avatar`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                initialsOf(p.display_name ?? "Creator")
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold sm:text-3xl">{p.display_name}</h1>
              {live ? (
                <Link
                  to="/live/$streamId"
                  params={{ streamId: live.id }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-live px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-live-foreground"
                >
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-live-foreground" /> Live now
                </Link>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.handle} · joined <TimeAgo date={p.created_at} />
            </p>
            {p.bio ? <p className="mt-3 max-w-2xl text-sm text-foreground/90">{p.bio}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {p.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {p.location}
                </span>
              ) : null}
              {p.website ? (
                <a
                  href={p.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 hover:text-primary"
                >
                  <Globe className="h-3.5 w-3.5" /> {p.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
            </div>
          </div>

          <div className="sm:self-center">
            {isMe ? (
              <EditProfileDialog
                open={open}
                onOpenChange={setOpen}
                initial={{
                  display_name: p.display_name ?? "",
                  bio: p.bio ?? "",
                  website: p.website ?? "",
                  location: p.location ?? "",
                  avatar_url: p.avatar_url ?? "",
                  banner_url: p.banner_url ?? "",
                }}
                onSaved={() => {
                  setOpen(false);
                  void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
                }}
              />
            ) : (
              <Button
                variant={isSubscribed ? "secondary" : "default"}
                size="sm"
                className="rounded-full px-5 font-semibold transition-transform hover:scale-[1.02]"
                disabled={subMutation.isPending}
                onClick={() => {
                  if (!user) {
                    toast("Sign in to subscribe to this channel.");
                    navigate({ to: "/auth" });
                    return;
                  }
                  subMutation.mutate();
                }}
              >
                {isSubscribed ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-primary" /> Subscribed
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" /> Subscribe
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-3">
        <StatCard icon={Film} label="Videos" value={String(stats.videos)} />
        <StatCard icon={Eye} label="Views" value={formatViews(stats.views).replace(" views", "")} />
        <StatCard icon={Users} label="Subscribers" value={String(stats.subscribers)} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Uploads</h2>
        {videos.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No public videos yet.</p>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Film;
  label: string;
  value: string;
}) {
  return (
    <div className="panel rounded-2xl p-4 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-2 text-xl font-bold">{value}</p>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    </div>
  );
}

function EditProfileDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  initial: {
    display_name: string;
    bio: string;
    website: string;
    location: string;
    avatar_url: string;
    banner_url: string;
  };
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: () => updateMyProfile({ data: form }),
    onSuccess: () => {
      toast.success("Profile updated");
      onSaved();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save profile"),
  });

  async function handleFileUpload(file: File, kind: "avatar" | "banner") {
    const isAvatar = kind === "avatar";
    if (isAvatar) setAvatarUploading(true);
    else setBannerUploading(true);

    try {
      const stamp = Date.now();
      const safeName = file.name.replace(/[^\w.-]/g, "_");
      const filePath = `profiles/${kind}-${stamp}-${safeName}`;

      const upload = await supabase.storage.from("thumbnails").upload(filePath, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

      if (upload.error) throw upload.error;

      const { data: pub } = supabase.storage.from("thumbnails").getPublicUrl(filePath);
      const publicUrl = pub.publicUrl;

      setForm((prev) => ({
        ...prev,
        [isAvatar ? "avatar_url" : "banner_url"]: publicUrl,
      }));

      toast.success(`${isAvatar ? "Avatar" : "Banner"} uploaded!`);
    } catch (err: any) {
      toast.error(err.message || `Failed to upload ${kind}`);
    } finally {
      if (isAvatar) setAvatarUploading(false);
      else setBannerUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="rounded-full">
          Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          {/* Avatar Upload Preview */}
          <div className="flex items-center gap-4 rounded-xl border border-border/70 p-3 bg-surface/50">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-primary/20 text-lg font-bold">
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="Avatar preview" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs font-semibold">Avatar Image</Label>
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={avatarInputRef}
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileUpload(f, "avatar");
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  disabled={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarUploading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Pick Image
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Banner Upload Preview */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3 bg-surface/50">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Banner Image</Label>
              <input
                type="file"
                ref={bannerInputRef}
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileUpload(f, "banner");
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs"
                disabled={bannerUploading}
                onClick={() => bannerInputRef.current?.click()}
              >
                {bannerUploading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="mr-1.5 h-3.5 w-3.5" /> Pick Banner
                  </>
                )}
              </Button>
            </div>
            {form.banner_url ? (
              <div className="h-20 w-full overflow-hidden rounded-lg border border-border">
                <img src={form.banner_url} alt="Banner preview" className="h-full w-full object-cover" />
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Display Name</Label>
            <Input
              value={form.display_name}
              onChange={(event) => setForm({ ...form, display_name: event.target.value })}
              placeholder="Display name"
              maxLength={60}
              required
              aria-label="Display name"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Short Bio</Label>
            <Textarea
              value={form.bio}
              onChange={(event) => setForm({ ...form, bio: event.target.value })}
              placeholder="Tell viewers about yourself…"
              maxLength={500}
              rows={3}
              aria-label="Bio"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Location</Label>
              <Input
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                placeholder="City, Country"
                maxLength={80}
                aria-label="Location"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Website</Label>
              <Input
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
                placeholder="https://your-site.com"
                maxLength={200}
                aria-label="Website"
              />
            </div>
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={save.isPending || avatarUploading || bannerUploading}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
