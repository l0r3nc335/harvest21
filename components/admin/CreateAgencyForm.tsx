"use client";
import { useForm, Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Radio } from "@/components/ui/Radio";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { Plus } from "lucide-react";
import { createAgency } from "@/app/admin/agencies/actions";
import { useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const schema = yup.object({
  isManagedByHarvest21: yup.string().oneOf(["yes", "no"]).required(),
  agencyName: yup.string().required("Agency name is required"),
  contactFirstName: yup.string().when("isManagedByHarvest21", {
    is: "no",
    then: (s) => s.required("Contact first name is required"),
    otherwise: (s) => s.optional(),
  }),
  contactLastName: yup.string().when("isManagedByHarvest21", {
    is: "no",
    then: (s) => s.required("Contact last name is required"),
    otherwise: (s) => s.optional(),
  }),
  email: yup.string().when("isManagedByHarvest21", {
    is: "no",
    then: (s) => s.email("Invalid email").required("Email is required"),
    otherwise: (s) => s.optional(),
  }),
  phoneNumber: yup.string().when("isManagedByHarvest21", {
    is: "no",
    then: (s) => s.required("Phone number is required"),
    otherwise: (s) => s.optional(),
  }),
});

type FormData = {
  isManagedByHarvest21: "yes" | "no";
  agencyName: string;
  contactFirstName?: string;
  contactLastName?: string;
  email?: string;
  phoneNumber?: string;
};

type CreateAgencyFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (result: { agency: { id: number; name: string; city?: string | null; country?: string | null }; user: { status?: string; last_activity?: string | null } }) => void | Promise<void>;
};

export function CreateAgencyForm({ isOpen, onClose, onSubmit }: CreateAgencyFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(schema) as Resolver<FormData>,
    defaultValues: { isManagedByHarvest21: "no" },
  });
  const isManagedByHarvest21 = watch("isManagedByHarvest21") ?? "no";

  const handleFormSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const result = await createAgency(data);
      if (result.success) {
        reset();
        onClose();
        toast.success(result.message || "Agency created successfully!");
        
        // Call the onSubmit callback if provided (pass the created agency data)
        if (onSubmit && result.agency) {
          await onSubmit({ agency: result.agency, user: result.user ?? undefined });
        } else if (!onSubmit) {
          // Fallback to router.refresh() if no callback provided
          router.refresh();
        }
      } else {
        toast.error(result.message || "Failed to create agency");
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
    <SlidePanel isOpen={isOpen} onClose={onClose} title="Create New Agency">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-2">
            Managed by Harvest21?
          </label>
          <div className="flex flex-wrap gap-4">
            <Radio {...register("isManagedByHarvest21")} value="no" label="No" checked={isManagedByHarvest21 === "no"} />
            <Radio {...register("isManagedByHarvest21")} value="yes" label="Yes" checked={isManagedByHarvest21 === "yes"} />
          </div>
          {isManagedByHarvest21 === "yes" && (
            <p className="mt-1 text-xs text-zinc-500">
              Harvest21 will manage this page. You can add contact and send invite later from the account tab.
            </p>
          )}
        </div>

        {/* Agency Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            Agency Name
          </label>
          <Input
            {...register("agencyName")}
            placeholder="Agency Name"
            className={errors.agencyName ? "border-red-500" : ""}
          />
          {errors.agencyName && (
            <p className="mt-1 text-xs text-red-500">{errors.agencyName.message}</p>
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

        {isManagedByHarvest21 === "no" && (
        <>
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
        </>
        )}

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
            disabled={isSubmitting}
            className="px-4 py-2 border-[#D3AF37]! text-zinc-900! hover:bg-yellow-50!"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="px-4 py-2 flex items-center gap-2 bg-[#D3AF37]! text-black! hover:bg-[#C19E2E]!"
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </SlidePanel>
  );
}

