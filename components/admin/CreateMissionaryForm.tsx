"use client";
import { useForm, Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { countries } from "countries-list";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Radio } from "@/components/ui/Radio";
import { Button } from "@/components/ui/Button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { Autocomplete } from "@/components/ui/Autocomplete";
import { Plus } from "lucide-react";
import { 
  createMissionary, 
  searchAgencies, 
  searchChurches, 
  getInitialAgencies,
  getInitialChurches,
} from "@/app/admin/missionaries/actions";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const schema = yup.object({
  isManagedByHarvest21: yup.string().oneOf(["yes", "no"]).required(),
  firstName: yup.string().required("First name is required"),
  lastName: yup.string().required("Last name is required"),
  email: yup.string().when("isManagedByHarvest21", {
    is: "no",
    then: (s) => s.email("Invalid email").required("Email is required"),
    otherwise: (s) => s.optional(),
  }),
  phoneNumber: yup.string().nullable().notRequired(),
  countryOfResidence: yup.string().required("Country of residence is required"),
  agencyName: yup.string().required("Agency name is required"),
  sendingChurchName: yup.string().required("Sending church name is required"),
  missionFieldChurchName: yup.string().required("Mission field church name is required"),
  missionStatus: yup.string().required("Mission status is required"),
  openToVisits: yup.string().required("Open to visits is required"),
  destinationCountry: yup.string().required("Destination country is required"),
});

type FormData = {
  isManagedByHarvest21: "yes" | "no";
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  countryOfResidence: string;
  agencyName: string;
  sendingChurchName: string;
  missionFieldChurchName: string;
  missionStatus: string;
  openToVisits: string;
  destinationCountry: string;
};

type CreateMissionaryFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (result: { missionary: { id: number; first_name: string; last_name: string; destination_country?: string | null; mission_status?: string; is_managed_by_harvest21?: boolean }; user?: { status?: string; last_activity?: string | null } | null }) => void | Promise<void>;
};

// Convert countries-list to array format and sort alphabetically
const allCountries = Object.entries(countries)
  .map(([code, name]) => ({
    value: code.toLowerCase(),
    label: name.name,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

export function CreateMissionaryForm({ isOpen, onClose, onSubmit }: CreateMissionaryFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agencyOptions, setAgencyOptions] = useState<{ id: string | number; name: string }[]>([]);
  const [sendingChurchOptions, setSendingChurchOptions] = useState<{ id: string | number; name: string }[]>([]);
  const [missionFieldChurchOptions, setMissionFieldChurchOptions] = useState<{ id: string | number; name: string }[]>([]);
  const [isLoadingAgencies, setIsLoadingAgencies] = useState(false);
  const [isLoadingSendingChurches, setIsLoadingSendingChurches] = useState(false);
  const [isLoadingMissionFieldChurches, setIsLoadingMissionFieldChurches] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: yupResolver(schema) as Resolver<FormData>,
    defaultValues: {
      isManagedByHarvest21: "no",
      countryOfResidence: "us",
      missionStatus: "On-field",
      openToVisits: "Yes",
      destinationCountry: "cl",
      phoneNumber: "",
    },
  });

  // Fetch initial options when form opens
  useEffect(() => {
    if (isOpen) {
      const fetchInitialOptions = async () => {
        const [agencies, churches] = await Promise.all([
          getInitialAgencies(),
          getInitialChurches(),
        ]);
        setAgencyOptions(agencies);
        setSendingChurchOptions(churches);
        setMissionFieldChurchOptions(churches);
      };
      fetchInitialOptions();
    }
  }, [isOpen]);

  // Use watch with default values to avoid React Compiler warnings
  const isManagedByHarvest21 = watch("isManagedByHarvest21") ?? "no";
  const missionStatus = watch("missionStatus") ?? "On-field";
  const openToVisits = watch("openToVisits") ?? "Yes";
  const agencyName = watch("agencyName");
  const sendingChurchName = watch("sendingChurchName");
  const missionFieldChurchName = watch("missionFieldChurchName");

  const handleSearchAgencies = async (query: string) => {
    if (query.length < 1) {
      const initial = await getInitialAgencies();
      setAgencyOptions(initial);
      return;
    }
    setIsLoadingAgencies(true);
    try {
      const results = await searchAgencies(query);
      setAgencyOptions(results);
    } catch (error) {
      console.error("Error searching agencies:", error);
    } finally {
      setIsLoadingAgencies(false);
    }
  };

  const handleSearchSendingChurches = async (query: string) => {
    if (query.length < 1) {
      const initial = await getInitialChurches();
      setSendingChurchOptions(initial);
      return;
    }
    setIsLoadingSendingChurches(true);
    try {
      const results = await searchChurches(query);
      setSendingChurchOptions(results);
    } catch (error) {
      console.error("Error searching sending churches:", error);
    } finally {
      setIsLoadingSendingChurches(false);
    }
  };

  const handleSearchMissionFieldChurches = async (query: string) => {
    if (query.length < 1) {
      const initial = await getInitialChurches();
      setMissionFieldChurchOptions(initial);
      return;
    }
    setIsLoadingMissionFieldChurches(true);
    try {
      const results = await searchChurches(query);
      setMissionFieldChurchOptions(results);
    } catch (error) {
      console.error("Error searching mission field churches:", error);
    } finally {
      setIsLoadingMissionFieldChurches(false);
    }
  };

  const handleFormSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const result = await createMissionary({
        isManagedByHarvest21: data.isManagedByHarvest21,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber || undefined,
        countryOfResidence: data.countryOfResidence,
        agencyName: data.agencyName,
        sendingChurchName: data.sendingChurchName,
        missionFieldChurchName: data.missionFieldChurchName,
        missionStatus: data.missionStatus,
        openToVisits: data.openToVisits,
        destinationCountry: data.destinationCountry,
      });
      if (result.success) {
        reset();
        onClose();
        toast.success(result.message || "Missionary created successfully!");
        
        // Call the onSubmit callback if provided (pass the created missionary data)
        if (onSubmit && result.missionary) {
          await onSubmit({ missionary: result.missionary, user: result.user ?? undefined });
        } else if (!onSubmit) {
          // Fallback to router.refresh() if no callback provided
          router.refresh();
        }
      } else {
        toast.error(result.message || "Failed to create missionary");
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
    <SlidePanel isOpen={isOpen} onClose={onClose} title="Create New Missionary">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-2">
            Managed by Harvest21?
          </label>
          <div className="flex flex-wrap gap-4">
            <Radio
              {...register("isManagedByHarvest21")}
              value="no"
              label="No"
              checked={isManagedByHarvest21 === "no"}
            />
            <Radio
              {...register("isManagedByHarvest21")}
              value="yes"
              label="Yes"
              checked={isManagedByHarvest21 === "yes"}
            />
          </div>
          {isManagedByHarvest21 === "yes" && (
            <p className="mt-1 text-xs text-zinc-500">
              Harvest21 will manage this page. You can add email and send invite later from the account tab.
            </p>
          )}
        </div>

        {/* First Name & Last Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">
              First Name
            </label>
            <Input
              {...register("firstName")}
              placeholder="First Name"
              className={errors.firstName ? "border-red-500" : ""}
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">
              Last Name
            </label>
            <Input
              {...register("lastName")}
              placeholder="Last Name"
              className={errors.lastName ? "border-red-500" : ""}
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {isManagedByHarvest21 === "no" && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-zinc-900">
                Email Address
              </label>
              <span className="text-xs text-red-500">Required.</span>
            </div>
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

        {/* Country of Residence */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            Country of Residence
          </label>
          <Select
            {...register("countryOfResidence")}
            options={allCountries}
            className={errors.countryOfResidence ? "border-red-500" : ""}
          />
          {errors.countryOfResidence && (
            <p className="mt-1 text-xs text-red-500">{errors.countryOfResidence.message}</p>
          )}
        </div>

        {/* Agency Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            Agency Name
          </label>
          <Autocomplete
            value={agencyName}
            options={agencyOptions}
            onSelect={(option) => {
              setValue("agencyName", option?.name || "", { shouldValidate: true });
            }}
            onSearch={handleSearchAgencies}
            placeholder="Search agencies..."
            isLoading={isLoadingAgencies}
            className={errors.agencyName ? "border-red-500" : ""}
          />
          {errors.agencyName && (
            <p className="mt-1 text-xs text-red-500">{errors.agencyName.message}</p>
          )}
        </div>

        {/* Sending Church Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            Sending Church Name
          </label>
          <Autocomplete
            value={sendingChurchName}
            options={sendingChurchOptions}
            onSelect={(option) => {
              setValue("sendingChurchName", option?.name || "", { shouldValidate: true });
            }}
            onSearch={handleSearchSendingChurches}
            placeholder="Search churches..."
            isLoading={isLoadingSendingChurches}
            className={errors.sendingChurchName ? "border-red-500" : ""}
          />
          {errors.sendingChurchName && (
            <p className="mt-1 text-xs text-red-500">{errors.sendingChurchName.message}</p>
          )}
        </div>

        {/* Mission Field Church Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            Mission Field Church Name
          </label>
          <Autocomplete
            value={missionFieldChurchName}
            options={missionFieldChurchOptions}
            onSelect={(option) => {
              setValue("missionFieldChurchName", option?.name || "", { shouldValidate: true });
            }}
            onSearch={handleSearchMissionFieldChurches}
            placeholder="Search churches..."
            isLoading={isLoadingMissionFieldChurches}
            className={errors.missionFieldChurchName ? "border-red-500" : ""}
          />
          {errors.missionFieldChurchName && (
            <p className="mt-1 text-xs text-red-500">{errors.missionFieldChurchName.message}</p>
          )}
        </div>

        {/* Mission Status */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-2">
            Mission Status
          </label>
          <div className="flex flex-wrap gap-4">
            <Radio
              {...register("missionStatus")}
              value="On-field"
              label="On-Field"
              checked={missionStatus === "On-field"}
            />
            <Radio
              {...register("missionStatus")}
              value="Furlough"
              label="Furlough"
              checked={missionStatus === "Furlough"}
            />
            <Radio
              {...register("missionStatus")}
              value="Deputation"
              label="Deputation"
              checked={missionStatus === "Deputation"}
            />
          </div>
          {errors.missionStatus && (
            <p className="mt-1 text-xs text-red-500">{errors.missionStatus.message}</p>
          )}
        </div>

        {/* Open To Visits */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-2">
            Open To Visits
          </label>
          <div className="flex flex-wrap gap-4">
            <Radio
              {...register("openToVisits")}
              value="Yes"
              label="Yes"
              checked={openToVisits === "Yes"}
            />
            <Radio
              {...register("openToVisits")}
              value="No"
              label="No"
              checked={openToVisits === "No"}
            />
          </div>
          {errors.openToVisits && (
            <p className="mt-1 text-xs text-red-500">{errors.openToVisits.message}</p>
          )}
        </div>

        {/* Destination Country */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            Destination Country
          </label>
          <Select
            {...register("destinationCountry")}
            options={allCountries}
            className={errors.destinationCountry ? "border-red-500" : ""}
          />
          {errors.destinationCountry && (
            <p className="mt-1 text-xs text-red-500">{errors.destinationCountry.message}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="px-4 py-2 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </SlidePanel>
  );
}
