"use client";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { Plus } from "lucide-react";
import { createCollege } from "@/app/admin/colleges/actions";
import { useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const schema = yup.object({
  collegeName: yup.string().required("College name is required"),
  contactFirstName: yup.string().required("Contact first name is required"),
  contactLastName: yup.string().required("Contact last name is required"),
  email: yup.string().email("Invalid email").required("Email is required"),
  phoneNumber: yup.string().required("Phone number is required"),
});

type FormData = yup.InferType<typeof schema>;

type CreateCollegeFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (result: { college: { id: number; name: string; city?: string | null; country?: string | null }; user: { status?: string; last_activity?: string | null } }) => void | Promise<void>;
};

export function CreateCollegeForm({ isOpen, onClose, onSubmit }: CreateCollegeFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
  });

  const handleFormSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const result = await createCollege(data);
      
      if (result.success) {
        reset();
        onClose();
        toast.success(result.message || "College created successfully!");
        
        // Call the onSubmit callback if provided (pass the created college data)
        if (onSubmit && result.college && result.user) {
          await onSubmit({ college: result.college, user: result.user });
        } else if (!onSubmit) {
          // Fallback to router.refresh() if no callback provided
          router.refresh();
        }
      } else {
        // Show error message
        toast.error(result.message || "Failed to create college");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  return (
    <SlidePanel isOpen={isOpen} onClose={onClose} title="Create New College">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* College Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            College Name
          </label>
          <Input
            {...register("collegeName")}
            placeholder="College Name"
            className={errors.collegeName ? "border-red-500" : ""}
          />
          {errors.collegeName && (
            <p className="mt-1 text-xs text-red-500">{errors.collegeName.message}</p>
          )}
        </div>

        {/* Contact First Name & Last Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">
              Contact First Name
            </label>
            <Input
              {...register("contactFirstName")}
              placeholder="Contact First Name"
              className={errors.contactFirstName ? "border-red-500" : ""}
            />
            {errors.contactFirstName && (
              <p className="mt-1 text-xs text-red-500">{errors.contactFirstName.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">
              Contact Last Name
            </label>
            <Input
              {...register("contactLastName")}
              placeholder="Contact Last Name"
              className={errors.contactLastName ? "border-red-500" : ""}
            />
            {errors.contactLastName && (
              <p className="mt-1 text-xs text-red-500">{errors.contactLastName.message}</p>
            )}
          </div>
        </div>

        {/* Email Address */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            Email Address
          </label>
          <Input
            {...register("email")}
            type="email"
            placeholder="Email Address"
            className={errors.email ? "border-red-500" : ""}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            Phone Number
          </label>
          <Input
            {...register("phoneNumber")}
            type="tel"
            placeholder="Phone Number"
            className={errors.phoneNumber ? "border-red-500" : ""}
          />
          {errors.phoneNumber && (
            <p className="mt-1 text-xs text-red-500">{errors.phoneNumber.message}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            className="px-4 py-2 border-[#D3AF37]! text-zinc-900! hover:bg-yellow-50!"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="px-4 py-2 flex items-center gap-2 bg-[#D3AF37]! text-white! hover:bg-[#C19E2E]!"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              "Saving..."
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </div>
      </form>
    </SlidePanel>
  );
}

