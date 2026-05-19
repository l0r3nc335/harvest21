"use client";

import { useState, useEffect, useRef } from "react";
import { User, Mail, Phone, Globe, Save, Camera } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ImageCropper } from "@/components/admin/ImageCropper";
import { countryList } from "@/lib/countryHelpers";
import { getSupporterProfile, updateSupporterProfile, requestEmailChange } from "@/app/settings/supporter-actions";
import { uploadSupporterProfilePhoto, updateSupporterProfilePhoto, deleteSupporterProfilePhoto } from "@/app/settings/supporter-photo-actions";
import { RASTER_IMAGE_INPUT_ACCEPT } from "@/lib/uploadMimeValidation";
import type { SupporterProfile } from "@/types/supporter";

interface SupporterProfileTabProps {
  initialProfile?: SupporterProfile;
}

export function SupporterProfileTab({ initialProfile }: SupporterProfileTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(initialProfile?.profile_photo_url || "");
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  
  const [profileInfo, setProfileInfo] = useState({
    firstName: initialProfile?.first_name || "",
    lastName: initialProfile?.last_name || "",
    email: initialProfile?.email || "",
    phoneNumber: initialProfile?.phone_number || "",
    countryOfResidence: initialProfile?.country_of_residence || "",
  });

  const handleSaveProfile = async () => {
    if (!profileInfo.firstName || !profileInfo.lastName || !profileInfo.countryOfResidence) {
      toast.error("First name, last name, and country are required");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateSupporterProfile({
        firstName: profileInfo.firstName,
        lastName: profileInfo.lastName,
        email: profileInfo.email,
        phoneNumber: profileInfo.phoneNumber,
        countryOfResidence: profileInfo.countryOfResidence,
      });

      if (result.success) {
        toast.success(result.message || "Profile updated successfully");
      } else {
        toast.error(result.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (newEmail === profileInfo.email) {
      toast.error("New email must be different from current email");
      return;
    }

    setIsChangingEmail(true);
    try {
      const result = await requestEmailChange(newEmail);

      if (result.success) {
        toast.success(result.message || "Verification email sent");
        setShowEmailChange(false);
        setNewEmail("");
      } else {
        toast.error(result.error || "Failed to request email change");
      }
    } catch (error) {
      console.error("Error changing email:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setCropperFile(file);
    setShowImageCropper(true);
  };

  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!cropperFile) return;

    const fileExtension = cropperFile.name.split(".").pop() || "jpg";
    const fileName = `cropped-profile-${Date.now()}.${fileExtension}`;
    const croppedFile = new File([croppedBlob], fileName, {
      type: croppedBlob.type || "image/jpeg",
    });

    setShowImageCropper(false);
    setCropperFile(null);

    await handleFileUpload(croppedFile);
  };

  const handleFileUpload = async (file: File) => {
    setUploadingProfile(true);
    try {
      const existingUrl = profilePhotoUrl || null;
      const result = await uploadSupporterProfilePhoto(file, existingUrl);

      if (!result.success || !result.publicUrl) {
        throw new Error(result.error || "Failed to upload file");
      }

      const publicUrl = result.publicUrl;
      const dbResult = await updateSupporterProfilePhoto(publicUrl);
      
      if (dbResult.success) {
        setProfilePhotoUrl(publicUrl);
        toast.success("Profile photo uploaded successfully!");
      } else {
        throw new Error(dbResult.error || "Failed to update profile photo");
      }
    } catch (error: unknown) {
      console.error("Error uploading file:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setUploadingProfile(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!profilePhotoUrl) return;

    try {
      const result = await deleteSupporterProfilePhoto(profilePhotoUrl);
      if (result.success) {
        setProfilePhotoUrl("");
        toast.success("Profile photo removed successfully!");
      } else {
        toast.error(result.error || "Failed to remove profile photo");
      }
    } catch (error) {
      console.error("Error removing photo:", error);
      toast.error("Failed to remove profile photo");
    }
  };

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <User className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
          <h2 className="text-xl sm:text-2xl font-bold text-white">Profile Information</h2>
        </div>

        <div className="bg-white rounded-lg border border-zinc-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 mb-3 sm:mb-4">Profile Photo</h3>
            <div className="flex items-center gap-4">
              <div className="relative">
                {profilePhotoUrl ? (
                  <img
                    src={profilePhotoUrl}
                    alt="Profile"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-2 ring-zinc-300"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#FFD700] to-[#E6B800] flex items-center justify-center ring-2 ring-zinc-300">
                    <span className="text-xl sm:text-2xl font-bold text-black">
                      {profileInfo.firstName?.[0] || "S"}{profileInfo.lastName?.[0] || "P"}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => profilePhotoInputRef.current?.click()}
                  disabled={uploadingProfile}
                  className="absolute bottom-0 right-0 p-1.5 sm:p-2 bg-[#D3AF37] rounded-full hover:bg-[#c19d2d] transition-colors disabled:opacity-50"
                >
                  <Camera className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept={RASTER_IMAGE_INPUT_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    if (e.target) e.target.value = "";
                  }}
                  disabled={uploadingProfile}
                />
                <Button
                  variant="secondary"
                  disabled={uploadingProfile}
                  onClick={() => profilePhotoInputRef.current?.click()}
                  className="text-xs sm:text-sm"
                >
                  {uploadingProfile ? "Uploading..." : "Upload Photo"}
                </Button>
                {profilePhotoUrl && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRemovePhoto}
                    className="text-xs sm:text-sm"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 mb-3 sm:mb-4">Personal Information</h3>
            <p className="text-xs sm:text-sm text-zinc-600 mb-4 sm:mb-6">
              Update your account information.
            </p>

            <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-zinc-700 mb-1.5 sm:mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={profileInfo.firstName}
                  onChange={(e) => setProfileInfo({ ...profileInfo, firstName: e.target.value })}
                  placeholder="Enter your first name"
                  required
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-zinc-700 mb-1.5 sm:mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={profileInfo.lastName}
                  onChange={(e) => setProfileInfo({ ...profileInfo, lastName: e.target.value })}
                  placeholder="Enter your last name"
                  required
                  className="text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 mb-1.5 sm:mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={profileInfo.email}
                  disabled
                  className="flex-1 bg-zinc-100 text-sm"
                />
                <Button
                  variant="secondary"
                  onClick={() => setShowEmailChange(!showEmailChange)}
                  className="text-xs sm:text-sm"
                >
                  Change Email
                </Button>
              </div>
              {showEmailChange && (
                <div className="mt-3 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                  <p className="text-xs sm:text-sm text-blue-800">
                    Enter your new email address. You'll receive a verification email to confirm the change.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="new@example.com"
                      className="flex-1 text-sm"
                    />
                    <Button
                      variant="primary"
                      onClick={handleEmailChange}
                      disabled={isChangingEmail}
                      className="text-xs sm:text-sm"
                    >
                      {isChangingEmail ? "Sending..." : "Send Verification"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 mb-1.5 sm:mb-2">
                Phone Number
              </label>
              <Input
                type="tel"
                value={profileInfo.phoneNumber}
                onChange={(e) => setProfileInfo({ ...profileInfo, phoneNumber: e.target.value })}
                placeholder="Enter your phone number"
                className="text-sm"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 mb-1.5 sm:mb-2">
                Country of Residence <span className="text-red-500">*</span>
              </label>
              <Select
                value={profileInfo.countryOfResidence}
                onChange={(e) => setProfileInfo({ ...profileInfo, countryOfResidence: e.target.value })}
                options={countryList}
                required
                className="text-sm"
              />
            </div>

              <div className="flex justify-end pt-3 sm:pt-4">
                <Button
                  variant="primary"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex items-center gap-2 text-xs sm:text-sm"
                >
                  <Save className="h-3 w-3 sm:h-4 sm:w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showImageCropper}
        onClose={() => {
          setShowImageCropper(false);
          setCropperFile(null);
        }}
        title="Crop Profile Photo"
      >
        {cropperFile && (
          <ImageCropper
            file={cropperFile}
            onCropComplete={handleCroppedImage}
            onCancel={() => {
              setShowImageCropper(false);
              setCropperFile(null);
            }}
            aspectRatio={1}
            targetWidth={400}
            targetHeight={400}
          />
        )}
      </Modal>
    </>
  );
}

