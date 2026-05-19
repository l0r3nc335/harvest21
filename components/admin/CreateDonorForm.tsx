"use client";
import { useForm, Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { countries } from "countries-list";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { Plus } from "lucide-react";

const schema = yup.object({
  firstName: yup.string().required("First name is required"),
  lastName: yup.string().required("Last name is required"),
  email: yup.string().email("Invalid email").required("Email is required"),
  phoneNumber: yup.string().optional(),
  address: yup.string().optional(),
  state: yup.string().optional(),
  city: yup.string().optional(),
  country: yup.string().required("Country is required"),
  postCode: yup.string().optional(),
  churchName: yup.string().optional(),
  collegeName: yup.string().optional(),
});

type FormData = yup.InferType<typeof schema>;

type CreateDonorFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
};

// Convert countries-list to array format and sort alphabetically
const allCountries = Object.entries(countries)
  .map(([code, name]) => ({
    value: code.toLowerCase(),
    label: name.name,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

// US States list
const usStates = [
  { value: "", label: "Choose State" },
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

// Common US Cities (can be expanded or made dynamic based on state)
const usCities = [
  { value: "", label: "Choose City" },
  { value: "new-york", label: "New York" },
  { value: "los-angeles", label: "Los Angeles" },
  { value: "chicago", label: "Chicago" },
  { value: "houston", label: "Houston" },
  { value: "phoenix", label: "Phoenix" },
  { value: "philadelphia", label: "Philadelphia" },
  { value: "san-antonio", label: "San Antonio" },
  { value: "san-diego", label: "San Diego" },
  { value: "dallas", label: "Dallas" },
  { value: "san-jose", label: "San Jose" },
  { value: "austin", label: "Austin" },
  { value: "jacksonville", label: "Jacksonville" },
  { value: "fort-worth", label: "Fort Worth" },
  { value: "columbus", label: "Columbus" },
  { value: "charlotte", label: "Charlotte" },
  { value: "san-francisco", label: "San Francisco" },
  { value: "indianapolis", label: "Indianapolis" },
  { value: "seattle", label: "Seattle" },
  { value: "denver", label: "Denver" },
  { value: "washington", label: "Washington" },
  { value: "boston", label: "Boston" },
  { value: "el-paso", label: "El Paso" },
  { value: "detroit", label: "Detroit" },
  { value: "nashville", label: "Nashville" },
  { value: "portland", label: "Portland" },
  { value: "oklahoma-city", label: "Oklahoma City" },
  { value: "las-vegas", label: "Las Vegas" },
  { value: "memphis", label: "Memphis" },
  { value: "louisville", label: "Louisville" },
  { value: "baltimore", label: "Baltimore" },
  { value: "milwaukee", label: "Milwaukee" },
  { value: "albuquerque", label: "Albuquerque" },
  { value: "tucson", label: "Tucson" },
  { value: "fresno", label: "Fresno" },
  { value: "sacramento", label: "Sacramento" },
  { value: "kansas-city", label: "Kansas City" },
  { value: "mesa", label: "Mesa" },
  { value: "atlanta", label: "Atlanta" },
  { value: "omaha", label: "Omaha" },
  { value: "colorado-springs", label: "Colorado Springs" },
  { value: "raleigh", label: "Raleigh" },
  { value: "virginia-beach", label: "Virginia Beach" },
  { value: "miami", label: "Miami" },
  { value: "oakland", label: "Oakland" },
  { value: "minneapolis", label: "Minneapolis" },
  { value: "tulsa", label: "Tulsa" },
  { value: "cleveland", label: "Cleveland" },
  { value: "wichita", label: "Wichita" },
  { value: "arlington", label: "Arlington" },
];

const churches = [
  { value: "", label: "Choose one" },
  { value: "friendship-baptist", label: "Friendship Baptist Church" },
  { value: "bible-study", label: "Bible Study Fellowship" },
  { value: "bible-center", label: "Bible Center" },
  { value: "bible-baptist", label: "Bible Baptist Church" },
  { value: "grace-community", label: "Grace Community Church" },
  { value: "first-baptist", label: "First Baptist Church" },
];

const colleges = [
  { value: "", label: "Choose one" },
  { value: "trinity-christian", label: "Trinity Christian University" },
  { value: "liberty-university", label: "Liberty University" },
  { value: "wheaton-college", label: "Wheaton College" },
  { value: "calvin-university", label: "Calvin University" },
  { value: "biola-university", label: "Biola University" },
  { value: "taylor-university", label: "Taylor University" },
];

export function CreateDonorForm({ isOpen, onClose, onSubmit }: CreateDonorFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: yupResolver(schema) as Resolver<FormData>,
    defaultValues: {
      country: "us",
      state: "",
      city: "",
      churchName: "",
      collegeName: "",
    },
  });

  const handleFormSubmit = (data: FormData) => {
    onSubmit(data);
    reset();
    onClose();
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  return (
    <SlidePanel isOpen={isOpen} onClose={onClose} title="Create New Donor">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
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

        {/* Email Address */}
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

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            Address
          </label>
          <Input
            {...register("address")}
            placeholder="Address"
            className={errors.address ? "border-red-500" : ""}
          />
          {errors.address && (
            <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>
          )}
        </div>

        {/* State & City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">
              State
            </label>
            <Select
              {...register("state")}
              options={usStates}
              className={errors.state ? "border-red-500" : ""}
            />
            {errors.state && (
              <p className="mt-1 text-xs text-red-500">{errors.state.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">
              City
            </label>
            <Select
              {...register("city")}
              options={usCities}
              className={errors.city ? "border-red-500" : ""}
            />
            {errors.city && (
              <p className="mt-1 text-xs text-red-500">{errors.city.message}</p>
            )}
          </div>
        </div>

        {/* Country & Post Code */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">
              Country
            </label>
            <Select
              {...register("country")}
              options={allCountries}
              className={errors.country ? "border-red-500" : ""}
            />
            {errors.country && (
              <p className="mt-1 text-xs text-red-500">{errors.country.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">
              Post Code
            </label>
            <Input
              {...register("postCode")}
              placeholder="Post Code"
              className={errors.postCode ? "border-red-500" : ""}
            />
            {errors.postCode && (
              <p className="mt-1 text-xs text-red-500">{errors.postCode.message}</p>
            )}
          </div>
        </div>

        {/* Church Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            Church Name
          </label>
          <Select
            {...register("churchName")}
            options={churches}
            className={errors.churchName ? "border-red-500" : ""}
          />
          {errors.churchName && (
            <p className="mt-1 text-xs text-red-500">{errors.churchName.message}</p>
          )}
        </div>

        {/* College Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            College Name
          </label>
          <Select
            {...register("collegeName")}
            options={colleges}
            className={errors.collegeName ? "border-red-500" : ""}
          />
          {errors.collegeName && (
            <p className="mt-1 text-xs text-red-500">{errors.collegeName.message}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            className="px-4 py-2 border-[#D3AF37]! text-zinc-900! hover:bg-yellow-50!"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="px-4 py-2 flex items-center gap-2 bg-[#D3AF37]! text-white! hover:bg-[#C19E2E]!"
          >
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>
      </form>
    </SlidePanel>
  );
}

