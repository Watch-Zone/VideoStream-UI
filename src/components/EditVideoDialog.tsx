import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateVideo } from "@/lib/videos.functions";
import type { VideoDTO } from "@/lib/video-types";

interface EditVideoDialogProps {
  video: Pick<VideoDTO, "id" | "title" | "description" | "tags" | "visibility">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditVideoDialog({
  video,
  open,
  onOpenChange,
  onSuccess,
}: EditVideoDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [tags, setTags] = useState(video.tags.join(", "));
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">(
    (video.visibility as "public" | "unlisted" | "private") || "public"
  );

  useEffect(() => {
    if (open) {
      setTitle(video.title);
      setDescription(video.description);
      setTags(video.tags.join(", "));
      setVisibility((video.visibility as "public" | "unlisted" | "private") || "public");
    }
  }, [open, video]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateVideo({
        data: {
          id: video.id,
          title: title.trim(),
          description: description.trim(),
          tags: tags
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 12),
          visibility,
        },
      }),
    onSuccess: () => {
      toast.success("Video updated successfully");
      void queryClient.invalidateQueries({ queryKey: ["video", video.id] });
      void queryClient.invalidateQueries({ queryKey: ["my-videos"] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update video.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Video Details</DialogTitle>
            <DialogDescription>
              Update your video title, description, tags, and visibility settings.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={5000}
                placeholder="What is your video about?"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="cinematic, trailer, gaming"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-visibility">Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(val: "public" | "unlisted" | "private") => setVisibility(val)}
              >
                <SelectTrigger id="edit-visibility">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public — Anyone can discover and watch</SelectItem>
                  <SelectItem value="unlisted">Unlisted — Anyone with the link can watch</SelectItem>
                  <SelectItem value="private">Private — Only you can watch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={updateMutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
