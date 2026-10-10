import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  bumpViews,
  fetchComments,
  fetchFeed,
  fetchLikeCount,
  fetchSearch,
  fetchVideo,
  withSignedMedia,
  publicClient,
} from "./videos.server";

export const getFeed = createServerFn({ method: "GET" }).handler(async () => fetchFeed());

export const searchVideos = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ q: z.string().max(120).default(""), tag: z.string().max(60).nullable().default(null) }).parse(input),
  )
  .handler(async ({ data }) => fetchSearch(data.q, data.tag));

export const getVideo = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => fetchVideo(data.id));

export const getComments = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => fetchComments(data.id));

export const getLikeCount = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => fetchLikeCount(data.id));

export const registerView = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await bumpViews(data.id);
    return { ok: true };
  });

export const getMyVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("videos")
      .select("*")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return withSignedMedia(publicClient(), (data ?? []) as never);
  });

export const createVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(140),
        description: z.string().max(5000).default(""),
        tags: z.array(z.string().max(40)).max(12).default([]),
        visibility: z.enum(["public", "unlisted", "private"]).default("public"),
        duration_seconds: z.number().int().min(0).max(86400).default(0),
        video_path: z.string().min(1).max(500),
        thumbnail_path: z.string().max(500).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: row, error } = await context.supabase
      .from("videos")
      .insert({
        owner_id: context.userId,
        channel_name: profile?.display_name ?? "Creator",
        title: data.title,
        description: data.description,
        tags: data.tags,
        visibility: data.visibility,
        duration_seconds: data.duration_seconds,
        video_url: data.video_path,
        thumbnail_url: data.thumbnail_path,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("videos")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("video_likes")
      .select("video_id")
      .eq("video_id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      await context.supabase
        .from("video_likes")
        .delete()
        .eq("video_id", data.id)
        .eq("user_id", context.userId);
      return { liked: false };
    }
    await context.supabase.from("video_likes").insert({ video_id: data.id, user_id: context.userId });
    return { liked: true };
  });

export const getMyLike = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("video_likes")
      .select("video_id")
      .eq("video_id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    return { liked: Boolean(existing) };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), body: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("comments")
      .insert({ video_id: data.id, user_id: context.userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(140).optional(),
        description: z.string().max(5000).optional(),
        tags: z.array(z.string().max(40)).max(20).optional(),
        visibility: z.enum(["public", "unlisted", "private"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("videos")
      .update({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
      })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: comment, error: fetchErr } = await context.supabase
      .from("comments")
      .select("id, user_id, video_id, videos(owner_id)")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchErr || !comment) throw new Error("Comment not found.");

    const isAuthor = comment.user_id === context.userId;
    const isVideoOwner = (comment.videos as any)?.owner_id === context.userId;

    if (!isAuthor && !isVideoOwner) {
      throw new Error("You are not authorized to delete this comment.");
    }

    const { error } = await context.supabase.from("comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
