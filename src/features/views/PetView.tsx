import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff, Camera, X, Cat, Upload } from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { differenceInDays } from "date-fns";
import { uploadImage } from "@/lib/storage";
import { useLongPress } from "@/hooks/useLongPress";
import { LongPressModal } from "@/components/ui/LongPressModal";

type Pet = {
  id: string;
  name: string;
  species: string;
  birthday: string | null;
  photos: string[]; // photos[0] is face, photos[1] is pattern
  variant: string | null; // "faceMode:patternMode:patternColor"
  created_at: string;
};

export function PetView({ relationshipId }: { relationshipId: string }) {
  const { confirm, activeRoamingPetIds, isPetVisible, toggleActiveRoamingPetId, setActiveRoamingPetIds, setIsPetVisible } = useAppStore();
  const qc = useQueryClient();
  const [petName, setPetName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [isAddingPet, setIsAddingPet] = useState(false);
  const [showLongPressInfo, setShowLongPressInfo] = useState(false);
  const longPressProps = useLongPress({
    onLongPress: () => setShowLongPressInfo(true),
    onClick: () => setIsAddingPet(true)
  });

  useEffect(() => {
    const key = "intro-dismissed-pet";
    const val = localStorage.getItem(key);
    if (!val) {
      setShowLongPressInfo(true);
      localStorage.setItem(key, "true");
    }
  }, []);

  // Mandatory file upload states for creation dialog
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreviewUrl, setFacePreviewUrl] = useState<string | null>(null);
  const [patternFile, setPatternFile] = useState<File | null>(null);
  const [patternPreviewUrl, setPatternPreviewUrl] = useState<string | null>(null);

  // Cropper states (handles "new" cat face or an existing Pet face update)
  const [croppingTarget, setCroppingTarget] = useState<"new" | Pet | null>(null);
  const [croppingFileSrc, setCroppingFileSrc] = useState<string | null>(null);
  const [cropScale, setCropScale] = useState(1.5);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isUploading, setIsUploading] = useState(false);

  const { data: pets = [] } = useQuery({
    queryKey: ["pets", relationshipId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id,name,species,birthday,photos,variant,created_at")
        .eq("relationship_id", relationshipId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Pet[];
    },
  });

  // Creation action: uploads files sequentially and inserts row
  const createPet = useMutation({
    mutationFn: async () => {
      if (!petName.trim()) throw new Error("Please enter a name for the cat");
      if (!faceFile) throw new Error("Please select and crop a face photo");
      if (!patternFile) throw new Error("Please select a coat pattern photo");

      // Generate a client-side UUID so we can group uploads
      const tempId = crypto.randomUUID();

      // 1. Upload face photo
      const faceSubpath = `pets/${tempId}/face_${Date.now()}`;
      const { url: faceUrl } = await uploadImage("wall", relationshipId, faceFile, faceSubpath);

      // 2. Upload pattern photo
      const patternSubpath = `pets/${tempId}/pattern_${Date.now()}`;
      const { url: patternUrl } = await uploadImage("wall", relationshipId, patternFile, patternSubpath);

      // 3. Insert cat record
      const { error } = await supabase.from("pets").insert({
        relationship_id: relationshipId,
        name: petName.trim(),
        species: "cat",
        birthday: birthday ? birthday : null,
        photos: [faceUrl, patternUrl],
        variant: "photo:photo:none", // Configured directly for photos
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Welcome home to your new cat!");
      setPetName("");
      setBirthday("");
      setFaceFile(null);
      setFacePreviewUrl(null);
      setPatternFile(null);
      setPatternPreviewUrl(null);
      setIsAddingPet(false);
      qc.invalidateQueries({ queryKey: ["pets", relationshipId] });
    },
    onError: (e: any) => toast.error(e?.message || String(e)),
  });

  const deletePet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pets").delete().eq("id", id);
      if (error) throw error;
      setActiveRoamingPetIds(activeRoamingPetIds.filter((x) => x !== id));
    },
    onSuccess: () => {
      toast.success("Cat removed from your home");
      qc.invalidateQueries({ queryKey: ["pets", relationshipId] });
    },
    onError: (e: any) => toast.error(e?.message || String(e)),
  });

  // Face File Trigger for existing pet list items
  const handleFaceFileChange = (e: React.ChangeEvent<HTMLInputElement>, pet: Pet) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCroppingTarget(pet);
      setCroppingFileSrc(reader.result as string);
      setCropScale(1.5);
      setCropOffsetX(0);
      setCropOffsetY(0);
    };
    reader.readAsDataURL(file);
  };

  // Face File Trigger for creation modal
  const handleNewFaceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCroppingTarget("new");
      setCroppingFileSrc(reader.result as string);
      setCropScale(1.5);
      setCropOffsetX(0);
      setCropOffsetY(0);
    };
    reader.readAsDataURL(file);
  };

  // Pattern File Trigger for creation modal
  const handleNewPatternFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPatternFile(file);
    setPatternPreviewUrl(URL.createObjectURL(file));
  };

  // Pattern Photo update trigger for existing pet list items
  const handlePatternUpload = async (e: React.ChangeEvent<HTMLInputElement>, pet: Pet) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info("Uploading coat pattern...");
    try {
      const subpath = `pets/${pet.id}/pattern_${Date.now()}`;
      const { url } = await uploadImage("wall", relationshipId, file, subpath);
      
      const existingPhotos = pet.photos || [];
      const newPhotos = [existingPhotos[0] || "", url];

      const { error } = await supabase
        .from("pets")
        .update({ photos: newPhotos, variant: "photo:photo:none" })
        .eq("id", pet.id);

      if (error) throw error;

      toast.success("Cat coat pattern updated!");
      qc.invalidateQueries({ queryKey: ["pets", relationshipId] });
      qc.invalidateQueries({ queryKey: ["active-roaming-pet"] });
    } catch (err: any) {
      toast.error(err?.message || String(err));
    }
  };

  // Dragging handlers for crop preview canvas
  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - cropOffsetX, y: clientY - cropOffsetY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    setCropOffsetX(clientX - dragStart.x);
    setCropOffsetY(clientY - dragStart.y);
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX, e.clientY);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) handleStart(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const saveCroppedFace = async () => {
    if (!croppingTarget || !croppingFileSrc) return;
    setIsUploading(true);
    try {
      const img = document.getElementById("crop-target-img") as HTMLImageElement;
      if (!img) return;

      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.arc(100, 100, 100, 0, Math.PI * 2);
      ctx.clip();

      const naturalAspect = img.naturalHeight / img.naturalWidth;
      const img_left = (128 + cropOffsetX) - (256 * cropScale) / 2;
      const img_top = (128 + cropOffsetY) - (256 * naturalAspect * cropScale) / 2;

      const canvas_img_left = (img_left - 48) * 1.25;
      const canvas_img_top = (img_top - 48) * 1.25;
      const canvas_img_width = 320 * cropScale;
      const canvas_img_height = 320 * naturalAspect * cropScale;

      ctx.drawImage(img, canvas_img_left, canvas_img_top, canvas_img_width, canvas_img_height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Failed to crop image");
          setIsUploading(false);
          return;
        }

        const file = new File([blob], "face.png", { type: "image/png" });

        // If target is "new", we save to state without uploading yet
        if (croppingTarget === "new") {
          setFaceFile(file);
          setFacePreviewUrl(URL.createObjectURL(blob));
          setCroppingTarget(null);
          setCroppingFileSrc(null);
          setIsUploading(false);
          return;
        }

        // Otherwise target is an existing pet object, upload right away
        try {
          const subpath = `pets/${croppingTarget.id}/face_${Date.now()}`;
          const { url } = await uploadImage("wall", relationshipId, file, subpath);

          const existingPhotos = croppingTarget.photos || [];
          const newPhotos = [url, existingPhotos[1] || ""];

          const { error } = await supabase
            .from("pets")
            .update({ photos: newPhotos, variant: "photo:photo:none" })
            .eq("id", croppingTarget.id);

          if (error) throw error;

          toast.success("Cat face photo updated!");
          qc.invalidateQueries({ queryKey: ["pets", relationshipId] });
          qc.invalidateQueries({ queryKey: ["active-roaming-pet"] });
          
          setCroppingTarget(null);
          setCroppingFileSrc(null);
        } catch (err: any) {
          toast.error(err?.message || String(err));
        } finally {
          setIsUploading(false);
        }
      }, "image/png");
    } catch (e: any) {
      toast.error(e?.message || String(e));
      setIsUploading(false);
    }
  };

  const handleEyeToggle = (p: Pet, isActive: boolean) => {
    toggleActiveRoamingPetId(p.id);
    if (!isActive && !isPetVisible) {
      setIsPetVisible(true);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-5 px-5 py-6 pb-32 select-none relative">
      
      {/* ── Cat Sanctuary Card ── */}
      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] text-center space-y-3 relative overflow-hidden">
        <div className="absolute -top-12 -left-12 w-24 h-24 rounded-full bg-yellow-200/20 blur-xl" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 rounded-full bg-pink-200/20 blur-xl" />

        <div className="mx-auto w-16 h-16 rounded-full bg-white/60 flex items-center justify-center border border-white/50 shadow-sm text-foreground/50">
          <Cat size={28} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mt-0.5">Welcome your cats. Upload their face and pattern coat photos to have them roam!</p>
        </div>
      </section>

      {/* ── Cats List ── */}
      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Our Cats ({pets.length})
        </h3>

        {pets.length === 0 ? (
          <div className="text-xs italic text-muted-foreground text-center py-4">No cats welcomed yet. Welcome your first cat!</div>
        ) : (
          <ul className="space-y-4">
            {pets.map((p) => {
              const ageInDays = p.birthday ? differenceInDays(new Date(), new Date(p.birthday)) : null;
              const hasFace = p.photos && p.photos.length > 0 && !!p.photos[0];
              const isActive = activeRoamingPetIds.includes(p.id);
              const isCurrentlyVisible = isActive && isPetVisible;

              return (
                <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-white/40 bg-white/30 p-3.5 shadow-[0_2px_8px_-4px_rgba(80,110,160,0.1)]">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative w-11 h-11 rounded-full bg-white/60 border border-white/50 flex items-center justify-center text-foreground/45 shadow-inner overflow-hidden select-none pointer-events-none">
                        {hasFace ? (
                          <img src={p.photos[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Cat size={18} />
                        )}
                        <label 
                          onClick={(e) => e.stopPropagation()} 
                          className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer pointer-events-auto"
                        >
                          <Camera size={12} className="text-white" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFaceFileChange(e, p)}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground/95 flex items-center gap-1.5">
                          {p.name}
                          {isCurrentlyVisible && (
                            <span className="text-[8px] bg-emerald-500/20 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Roaming</span>
                          )}
                          {isActive && !isPetVisible && (
                            <span className="text-[8px] bg-slate-500/20 text-slate-600 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Hidden</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                          <span>Cat</span>
                          {ageInDays !== null && (
                            <span>• {ageInDays} days with us</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEyeToggle(p, isActive)}
                        className={`p-1.5 rounded-full border border-white/50 transition-all ${
                          isCurrentlyVisible 
                            ? "bg-emerald-500 text-white scale-110 shadow-sm" 
                            : isActive 
                            ? "bg-slate-500 text-white scale-110 shadow-sm" 
                            : "bg-white/50 text-foreground/45 hover:text-foreground"
                        }`}
                        title={isCurrentlyVisible ? "Hide cat from navbar" : "Make cat roam on navbar"}
                      >
                        {isCurrentlyVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>

                      <button
                        onClick={() => {
                          confirm({
                            title: "Remove cat?",
                            message: `Are you sure you want to release "${p.name}" to the wild?`,
                            onConfirm: () => deletePet.mutate(p.id),
                          });
                        }}
                        className="p-1.5 rounded-full bg-red-50 border border-red-200/50 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                        title="Remove cat"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Photo Updates (Outlines and solid colors completely abandoned) */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-white/20 pt-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground font-semibold">Face Image:</span>
                      <label className="font-semibold text-primary hover:text-primary-hover cursor-pointer flex items-center gap-1.5">
                        <Upload size={11} />
                        Upload photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFaceFileChange(e, p)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="flex flex-col gap-1 border-l border-white/10 pl-3">
                      <span className="text-muted-foreground font-semibold">Coat Pattern:</span>
                      <label className="font-semibold text-primary hover:text-primary-hover cursor-pointer flex items-center gap-1.5">
                        <Upload size={11} />
                        Upload photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePatternUpload(e, p)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Welcome Cat FAB bottom right ── */}
      <button
        {...longPressProps}
        className="fixed bottom-24 right-5 z-20 flex items-center gap-2 rounded-full border border-white/50 bg-white/70 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(80,110,160,0.4)] hover:bg-white/80 active:scale-95 transition-all"
      >
        <Plus size={16} /> Welcome Cat
      </button>

      <LongPressModal
        isOpen={showLongPressInfo}
        onClose={() => setShowLongPressInfo(false)}
        title="Welcome Cat"
        description="Tap to welcome a new cat to our space. You'll be able to name them, set their birthday, upload their face photo, and add a pattern photo to customize their coat. Once welcomed, they'll wander around our home."
      />

      {/* ── Add New Cat Bottom Sheet Modal ── */}
      {isAddingPet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/10 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-white/50 bg-white/85 backdrop-blur-2xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Cat size={14} className="text-primary" /> Welcome new cat
              </h3>
              <button 
                onClick={() => {
                  setPetName("");
                  setBirthday("");
                  setFaceFile(null);
                  setFacePreviewUrl(null);
                  setPatternFile(null);
                  setPatternPreviewUrl(null);
                  setIsAddingPet(false);
                }}
                className="rounded-full bg-white border border-white/50 p-1 text-foreground/50 hover:text-foreground transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Cat Name</label>
                <input
                  type="text"
                  placeholder="Mocha, Lily, etc..."
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  className="font-sans w-full rounded-2xl border border-white/60 bg-white/40 px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all shadow-inner"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Adopt Date / Birthday (Optional)</label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="font-sans w-full rounded-2xl border border-white/60 bg-white/40 px-4 py-2.5 text-xs text-foreground outline-none focus:border-primary transition-all shadow-inner"
                />
              </div>

              {/* Mandatory File Uploaders */}
              <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-white/20 pt-3.5">
                {/* Required Face Image Picker */}
                <div className="flex flex-col gap-1.5 items-center text-center">
                  <span className="text-muted-foreground uppercase tracking-wider font-bold text-[8px]">Face Image (Required)</span>
                  <label className="w-16 h-16 rounded-full border border-dashed border-white/80 bg-white/40 flex flex-col items-center justify-center cursor-pointer hover:bg-white/60 transition-all overflow-hidden shadow-inner">
                    {facePreviewUrl ? (
                      <img src={facePreviewUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Upload size={16} className="text-foreground/40" />
                        <span className="text-[8px] text-foreground/50 mt-1">Upload photo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleNewFaceFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Required Pattern Image Picker */}
                <div className="flex flex-col gap-1.5 items-center text-center border-l border-white/10 pl-2">
                  <span className="text-muted-foreground uppercase tracking-wider font-bold text-[8px]">Coat Pattern (Required)</span>
                  <label className="w-16 h-16 rounded-2xl border border-dashed border-white/80 bg-white/40 flex flex-col items-center justify-center cursor-pointer hover:bg-white/60 transition-all overflow-hidden shadow-inner">
                    {patternPreviewUrl ? (
                      <img src={patternPreviewUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Upload size={16} className="text-foreground/40" />
                        <span className="text-[8px] text-foreground/50 mt-1">Upload photo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleNewPatternFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <button
                onClick={() => createPet.mutate()}
                disabled={createPet.isPending || !petName.trim() || !faceFile || !patternFile}
                className="font-sans font-semibold w-full py-3 rounded-full border border-white/50 bg-white/70 hover:bg-white/80 backdrop-blur-2xl text-foreground text-xs active:scale-[0.99] transition-all shadow-[0_10px_30px_-14px_rgba(80,110,160,0.25)] disabled:opacity-50 mt-2 cursor-pointer"
              >
                {createPet.isPending ? "Welcoming Cat..." : "Welcome Cat"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Interactive Face Cropper Modal ── */}
      {croppingFileSrc && croppingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm select-none">
          <div className="w-full max-w-sm rounded-3xl border border-white/50 bg-white/80 backdrop-blur-2xl p-5 shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-full flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Crop Face</h3>
              <button 
                onClick={() => { setCroppingTarget(null); setCroppingFileSrc(null); }}
                className="rounded-full bg-white border border-white/50 p-1 text-foreground/50 hover:text-foreground transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div 
              className="relative w-64 h-64 overflow-hidden rounded-2xl bg-black/60 border border-white/30 select-none cursor-move flex items-center justify-center shadow-inner"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={handleEnd}
            >
              <img
                id="crop-target-img"
                src={croppingFileSrc}
                alt=""
                className="absolute pointer-events-none select-none max-w-none origin-center"
                style={{
                  width: "256px",
                  left: "128px",
                  top: "128px",
                  transform: `translate(-50%, -50%) translate(${cropOffsetX}px, ${cropOffsetY}px) scale(${cropScale})`,
                }}
              />
              
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-40 h-40 rounded-full border-2 border-dashed border-white ring-[999px] ring-black/50 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]" />
              </div>
            </div>

            <div className="w-full space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                <span>Scale / Zoom</span>
                <span>{cropScale.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="4"
                step="0.05"
                value={cropScale}
                onChange={(e) => setCropScale(parseFloat(e.target.value))}
                className="w-full h-1 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <p className="text-[10px] text-muted-foreground text-center px-4 leading-relaxed">
              Drag the cat picture and slide the zoom slider until your cat's face fits perfectly inside the circle!
            </p>

            <button
              onClick={saveCroppedFace}
              disabled={isUploading}
              className="w-full py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold active:scale-95 transition-all shadow-md disabled:opacity-50"
            >
              {isUploading ? "Processing..." : "Save Face Image"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
