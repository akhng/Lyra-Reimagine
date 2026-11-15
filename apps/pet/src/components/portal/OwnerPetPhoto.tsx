"use client";
import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { setOwnerPetPhotoAction } from "@/features/portal/actions";
import { PHOTO_ACCEPT, photoProblem, uploadPhoto } from "@/lib/upload";

/** Upload a pet photo straight to your private folder (salons you book with can see it). */
export function OwnerPetPhoto({ userId, petId }: { userId: string; petId: string }) {
  const id = useId();
  const router = useRouter();
  const [status, setStatus] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  async function onChange(file: File | undefined) {
    if (!file) return;
    const problem = photoProblem(file);
    if (problem) return setStatus({ busy: false, error: problem });
    setStatus({ busy: true, error: null });
    const path = await uploadPhoto(`${userId}/pets/${petId}`, file, "owner-media");
    const ok = path ? (await setOwnerPetPhotoAction(petId, path)).ok : false;
    setStatus({ busy: false, error: ok ? null : "We couldn't upload that photo. Please try again." });
    if (ok) router.refresh();
  }
  return (
    <div>
      <label htmlFor={id} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-border bg-surface px-4 text-sm font-semibold hover:bg-surface-2 focus-within:ring-2 focus-within:ring-primary/30">
        <Camera className="size-4" aria-hidden /> {status.busy ? "Uploading…" : "Add a photo"}
        <input id={id} type="file" accept={PHOTO_ACCEPT} className="sr-only" disabled={status.busy} onChange={(e) => void onChange(e.target.files?.[0])} />
      </label>
      {status.error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {status.error}
        </p>
      ) : null}
    </div>
  );
}
